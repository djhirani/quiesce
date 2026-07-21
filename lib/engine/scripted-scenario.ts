import type { SimulationPolicy } from "@/lib/domain/commands";
import type { AuthorityEvent } from "@/lib/domain/events";
import type {
  ScriptedEventSpec,
  ScriptedScenarioDefinition,
} from "@/lib/fixtures/incident-scenarios";
import { evaluateCommitFence } from "./commit-fence";
import { AppendOnlyEventStore } from "./event-store";
import { LogicalClock } from "./logical-clock";

/**
 * Deterministic driver that replays a declarative scenario definition through
 * the existing engine. It mirrors the cloud-cleanup driver's conventions —
 * 40 ms ticks, base/advanced authority epochs, commit-fence assertions, and
 * the same phase guards — so the verifier, sweep, projectors, and certificate
 * logic apply unchanged. No engine semantics are altered.
 */
export class ScriptedScenario {
  readonly #store: AppendOnlyEventStore;
  readonly #clock: LogicalClock;
  readonly #policy: SimulationPolicy;
  readonly #definition: ScriptedScenarioDefinition;

  constructor(
    store: AppendOnlyEventStore,
    clock: LogicalClock,
    policy: SimulationPolicy,
    definition: ScriptedScenarioDefinition,
  ) {
    this.#store = store;
    this.#clock = clock;
    this.#policy = policy;
    this.#definition = definition;
  }

  get policy(): SimulationPolicy {
    return this.#policy;
  }

  get readyBoundary(): number {
    return this.#definition.build.length;
  }

  startRun(): AuthorityEvent {
    if (this.#store.history().length > 0) {
      throw new Error("Run has already started.");
    }
    return this.#append(this.#definition.build[0], null);
  }

  advanceToReady(
    boundaryEventIndex = this.#definition.build.length,
  ): readonly AuthorityEvent[] {
    const history = this.#store.history();
    if (history.length !== 1 || history[0]?.type !== "RUN_STARTED") {
      throw new Error("Scenario can advance only after RUN_STARTED.");
    }
    const limit = this.#definition.build.length;
    if (
      !Number.isInteger(boundaryEventIndex) ||
      boundaryEventIndex < 1 ||
      boundaryEventIndex > limit
    ) {
      throw new Error(
        `Scenario boundary must be an event index from 1 through ${limit}.`,
      );
    }
    let cause: string | null = history[0].eventId;
    for (const spec of this.#definition.build.slice(1, boundaryEventIndex)) {
      cause = this.#append(spec, cause).eventId;
    }
    return this.#store.history();
  }

  injectStop(): readonly AuthorityEvent[] {
    const history = this.#store.history();
    if (history.some((event) => event.type === "STOP_INJECTED")) {
      throw new Error("STOP has already been injected.");
    }
    if (history.length === 0) {
      throw new Error("STOP requires SCENARIO_READY.");
    }
    const specs =
      this.#policy === "protected"
        ? this.#definition.protectedStop
        : this.#definition.vulnerableStop;
    const presentIds = this.#presentEntityIds();
    const appended: AuthorityEvent[] = [];
    let cause: string | null = history.at(-1)!.eventId;
    for (const spec of specs) {
      if (spec.requiresEntityId && !presentIds.has(spec.requiresEntityId)) {
        continue;
      }
      const event = this.#append(spec, cause);
      appended.push(event);
      cause = event.eventId;
    }
    return Object.freeze(appended);
  }

  advanceToHorizon(horizonMs: number): readonly AuthorityEvent[] {
    const definition = this.#definition;
    const history = this.#store.history();
    const expectedBoundary =
      this.#policy === "protected" ? "QUIESCENCE_REACHED" : "AGENT_STOPPED";
    if (history.at(-1)?.type !== expectedBoundary) {
      throw new Error(
        `Clock advancement requires a completed ${this.#policy} STOP.`,
      );
    }
    if (horizonMs - this.#clock.now() !== 300_000) {
      throw new Error("Logical clock advancement must be exactly 300000 ms.");
    }
    const stopped = history.at(-1)!;
    const humanId = definition.build[0].actorId;
    const clockAdvanced = this.#store.append({
      logicalTimeMs: this.#clock.advanceToHorizon(horizonMs),
      type: "CLOCK_ADVANCED",
      actorId: humanId,
      subjectId: null,
      parentSubjectId: null,
      causedByEventId: stopped.eventId,
      authorityEpoch:
        this.#policy === "protected"
          ? definition.authorityEpoch + 1
          : definition.authorityEpoch,
      issuedAuthorityEpoch: null,
      payload: { deltaMs: 300_000, horizonMs, simulated: true },
    });
    const hasDueWork = history.some(
      (event) =>
        event.type === "ACTION_QUEUED" &&
        event.subjectId === definition.dueQueueId,
    );
    if (!hasDueWork) return this.#store.history();

    const specs =
      this.#policy === "protected"
        ? definition.protectedAdvance
        : definition.vulnerableAdvance;
    let cause: string | null = clockAdvanced.eventId;
    for (const spec of specs) {
      if (spec.type === "EFFECT_COMMITTED") {
        const fence = evaluateCommitFence(
          this.#store.history(),
          definition.authorityEpoch,
          definition.credentialId,
        );
        if (!fence.mayCommit) {
          throw new Error("Material effect commit was fenced.");
        }
      }
      if (spec.type === "STALE_AUTHORITY_REJECTED") {
        const fence = evaluateCommitFence(
          this.#store.history(),
          definition.authorityEpoch,
          definition.credentialId,
        );
        if (fence.mayCommit || fence.rejectionReason !== "stale_authority") {
          throw new Error(
            "Protected delayed effect must be rejected as stale.",
          );
        }
        cause = this.#append(
          { ...spec, payload: { ...fence, ...spec.payload } },
          cause,
        ).eventId;
        continue;
      }
      cause = this.#append(spec, cause).eventId;
    }
    return this.#store.history();
  }

  advanceClock(deltaMs: number): readonly AuthorityEvent[] {
    return this.advanceToHorizon(this.#clock.now() + deltaMs);
  }

  #presentEntityIds(): ReadonlySet<string> {
    return new Set(
      this.#store
        .history()
        .map((event) => event.payload.entity?.id)
        .filter((id): id is string => Boolean(id)),
    );
  }

  #append(spec: ScriptedEventSpec, causedByEventId: string | null) {
    const baseEpoch = this.#definition.authorityEpoch;
    const epochAdvanced =
      this.#policy === "protected" &&
      (spec.type === "AUTHORITY_EPOCH_ADVANCED" ||
        this.#store
          .history()
          .some((event) => event.type === "AUTHORITY_EPOCH_ADVANCED"));
    const logicalTimeMs =
      this.#store.history().length === 0
        ? this.#clock.now()
        : this.#clock.tick(spec.offsetMs ?? 40);
    return this.#store.append({
      logicalTimeMs,
      type: spec.type,
      actorId: spec.actorId,
      subjectId: spec.subjectId,
      parentSubjectId: spec.parentSubjectId,
      causedByEventId,
      authorityEpoch: epochAdvanced ? baseEpoch + 1 : baseEpoch,
      issuedAuthorityEpoch:
        spec.issuedAtBaseEpoch ||
        spec.payload.material === true ||
        spec.payload.entity?.authorityEpoch != null
          ? baseEpoch
          : null,
      payload: spec.payload,
    });
  }
}
