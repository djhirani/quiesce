import type {
  AuthorityEvent,
  AuthorityEventPayload,
  AuthorityEventType,
} from "@/lib/domain/events";
import { AppendOnlyEventStore } from "./event-store";
import { LogicalClock } from "./logical-clock";
import { applyProtectedStop, applyVulnerableStop } from "./policies";
import { evaluateCommitFence } from "./commit-fence";
import type { SimulationPolicy } from "@/lib/domain/commands";
import {
  CLOUD_CLEANUP_AUTHORITY_EPOCH,
  cloudCleanupEntities as entities,
  edge,
  entityIds,
} from "@/lib/fixtures/cloud-cleanup";

export class CloudCleanupScenario {
  readonly #store: AppendOnlyEventStore;
  readonly #clock: LogicalClock;
  readonly #policy: SimulationPolicy;

  constructor(
    store: AppendOnlyEventStore,
    clock: LogicalClock,
    policy: SimulationPolicy = "vulnerable",
  ) {
    this.#store = store;
    this.#clock = clock;
    this.#policy = policy;
  }

  get policy(): SimulationPolicy {
    return this.#policy;
  }

  startRun(): AuthorityEvent {
    if (this.#store.history().length > 0) {
      throw new Error("Run has already started.");
    }
    return this.#append("RUN_STARTED", entityIds.human, entityIds.root, null, {
      actorEntity: entities.human,
      entity: entities.root,
      edge: edge("owns", entityIds.human, entityIds.root),
      canonicalFixture: "cloud-cleanup-v1",
    });
  }

  advanceToReady(boundaryEventIndex = 11): readonly AuthorityEvent[] {
    const history = this.#store.history();
    if (history.length !== 1 || history[0]?.type !== "RUN_STARTED") {
      throw new Error("Scenario can advance only after RUN_STARTED.");
    }

    let cause = history[0].eventId;
    const append = (
      type: AuthorityEventType,
      actorId: string,
      subjectId: string | null,
      parentSubjectId: string | null,
      payload: AuthorityEventPayload,
    ) => {
      const event = this.#append(
        type,
        actorId,
        subjectId,
        parentSubjectId,
        payload,
        cause,
      );
      cause = event.eventId;
      return event;
    };

    if (
      !Number.isInteger(boundaryEventIndex) ||
      boundaryEventIndex < 1 ||
      boundaryEventIndex > 11
    ) {
      throw new Error(
        "Scenario boundary must be an event index from 1 through 11.",
      );
    }
    if (boundaryEventIndex === 1) return this.#store.history();

    append("RESOURCE_INSPECTED", entityIds.root, null, null, {
      resourceIds: ["development-instance-01", "development-instance-02"],
      environment: "development",
    });
    if (boundaryEventIndex === 2) return this.#store.history();
    append(
      "SAFE_EFFECT_COMMITTED",
      entityIds.root,
      entityIds.safeEffectOne,
      entityIds.root,
      {
        entity: entities.safeEffectOne,
        edge: edge("commits", entityIds.root, entityIds.safeEffectOne),
        action: "stop_development_instance",
        resourceId: "development-instance-01",
        material: true,
        simulated: true,
      },
    );
    if (boundaryEventIndex === 3) return this.#store.history();
    append(
      "SAFE_EFFECT_COMMITTED",
      entityIds.root,
      entityIds.safeEffectTwo,
      entityIds.root,
      {
        entity: entities.safeEffectTwo,
        edge: edge("commits", entityIds.root, entityIds.safeEffectTwo),
        action: "stop_development_instance",
        resourceId: "development-instance-02",
        material: true,
        simulated: true,
      },
    );
    if (boundaryEventIndex === 4) return this.#store.history();
    append("AGENT_SPAWNED", entityIds.root, entityIds.child, entityIds.root, {
      entity: entities.child,
      edge: edge("spawned", entityIds.root, entityIds.child),
      simulated: true,
    });
    if (boundaryEventIndex === 5) return this.#store.history();
    append(
      "CREDENTIAL_ISSUED",
      entityIds.root,
      entityIds.credential,
      entityIds.root,
      {
        entity: entities.credential,
        edge: edge("granted", entityIds.root, entityIds.credential),
        expiresAfterMs: 900_000,
        scope: "simulated:cloud-cleanup",
        simulated: true,
      },
    );
    if (boundaryEventIndex === 6) return this.#store.history();
    append("JOB_SCHEDULED", entityIds.child, entityIds.job, entityIds.child, {
      entity: entities.job,
      edge: edge("schedules", entityIds.child, entityIds.job),
      intervalMs: 300_000,
      action: "delete_inactive_resource",
      simulated: true,
    });
    if (boundaryEventIndex === 7) return this.#store.history();
    append("RETRY_ENABLED", entityIds.job, entityIds.retry, entityIds.job, {
      entity: entities.retry,
      edge: edge("retries", entityIds.job, entityIds.retry),
      maximumAttempts: 3,
      simulated: true,
    });
    if (boundaryEventIndex === 8) return this.#store.history();
    append(
      "ACTION_QUEUED",
      entityIds.job,
      entityIds.developmentQueue,
      entityIds.job,
      {
        entity: entities.developmentQueue,
        edges: [
          edge("enqueues", entityIds.job, entityIds.developmentQueue),
          edge("authorizes", entityIds.credential, entityIds.developmentQueue),
        ],
        action: "delete_development_cache",
        classification: "development",
        material: true,
        simulated: true,
      },
    );
    if (boundaryEventIndex === 9) return this.#store.history();
    append(
      "ACTION_QUEUED",
      entityIds.retry,
      entityIds.backupQueue,
      entityIds.retry,
      {
        entity: entities.backupQueue,
        edges: [
          edge("enqueues", entityIds.retry, entityIds.backupQueue),
          edge("authorizes", entityIds.credential, entityIds.backupQueue),
        ],
        action: "delete_production_backup",
        classification: "misclassified_as_inactive",
        material: true,
        simulated: true,
      },
    );
    if (boundaryEventIndex === 10) return this.#store.history();
    append("SCENARIO_READY", entityIds.root, entityIds.root, entityIds.human, {
      queuedActionIds: [entityIds.developmentQueue, entityIds.backupQueue],
      simulated: true,
    });

    return this.#store.history();
  }

  injectStop(): readonly AuthorityEvent[] {
    return this.#policy === "protected"
      ? applyProtectedStop(this.#store, this.#clock)
      : applyVulnerableStop(this.#store, this.#clock);
  }

  advanceToHorizon(horizonMs: number): readonly AuthorityEvent[] {
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
    const clockAdvanced = this.#store.append({
      logicalTimeMs: this.#clock.advanceToHorizon(horizonMs),
      type: "CLOCK_ADVANCED",
      actorId: entityIds.human,
      subjectId: null,
      parentSubjectId: null,
      causedByEventId: stopped.eventId,
      authorityEpoch:
        this.#policy === "protected"
          ? CLOUD_CLEANUP_AUTHORITY_EPOCH + 1
          : CLOUD_CLEANUP_AUTHORITY_EPOCH,
      issuedAuthorityEpoch: null,
      payload: { deltaMs: 300_000, horizonMs, simulated: true },
    });
    const hasBackupWork = history.some(
      (event) =>
        event.type === "ACTION_QUEUED" &&
        event.subjectId === entityIds.backupQueue,
    );
    if (!hasBackupWork) return this.#store.history();
    if (this.#policy === "protected") {
      return this.#attemptProtectedEffect(clockAdvanced);
    }

    const jobTriggered = this.#append(
      "JOB_TRIGGERED",
      entityIds.job,
      entityIds.job,
      entityIds.child,
      {
        targetType: "production_backup",
        targetId: "production-backup-archive-01",
        material: true,
        simulated: true,
      },
      clockAdvanced.eventId,
    );
    const attempted = this.#append(
      "EFFECT_ATTEMPTED",
      entityIds.retry,
      entityIds.backupQueue,
      entityIds.retry,
      {
        entity: { ...entities.backupQueue, status: "attempting" },
        credentialId: entityIds.credential,
        targetType: "production_backup",
        targetId: "production-backup-archive-01",
        material: true,
        simulated: true,
      },
      jobTriggered.eventId,
    );
    const fence = evaluateCommitFence(
      this.#store.history(),
      CLOUD_CLEANUP_AUTHORITY_EPOCH,
    );
    if (!fence.mayCommit) throw new Error("Material effect commit was fenced.");
    this.#append(
      "EFFECT_COMMITTED",
      entityIds.retry,
      entityIds.backupEffect,
      entityIds.backupQueue,
      {
        entity: entities.backupEffect,
        edge: edge("commits", entityIds.backupQueue, entityIds.backupEffect),
        credentialId: entityIds.credential,
        targetType: "production_backup",
        targetId: "production-backup-archive-01",
        material: true,
        simulated: true,
      },
      attempted.eventId,
    );
    return this.#store.history();
  }

  #attemptProtectedEffect(
    clockAdvanced: AuthorityEvent,
  ): readonly AuthorityEvent[] {
    const attempted = this.#append(
      "EFFECT_ATTEMPTED",
      entityIds.retry,
      entityIds.backupQueue,
      entityIds.retry,
      {
        credentialId: entityIds.credential,
        issuedAuthorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
        targetType: "production_backup",
        targetId: "production-backup-archive-01",
        material: true,
        simulated: true,
      },
      clockAdvanced.eventId,
    );
    const fence = evaluateCommitFence(
      this.#store.history(),
      CLOUD_CLEANUP_AUTHORITY_EPOCH,
    );
    if (fence.mayCommit || fence.rejectionReason !== "stale_authority") {
      throw new Error("Protected delayed effect must be rejected as stale.");
    }
    const stale = this.#append(
      "STALE_AUTHORITY_REJECTED",
      entityIds.root,
      entityIds.backupQueue,
      entityIds.retry,
      {
        ...fence,
        targetType: "production_backup",
        targetId: "production-backup-archive-01",
        material: true,
        simulated: true,
      },
      attempted.eventId,
    );
    this.#append(
      "EFFECT_REJECTED",
      entityIds.root,
      entityIds.backupEffect,
      entityIds.backupQueue,
      {
        entity: { ...entities.backupEffect, status: "rejected" },
        edge: edge("cancels", entityIds.backupQueue, entityIds.backupEffect),
        reason: "stale_authority",
        issuedAuthorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
        currentAuthorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH + 1,
        targetType: "production_backup",
        targetId: "production-backup-archive-01",
        material: true,
        simulated: true,
      },
      stale.eventId,
    );
    return this.#store.history();
  }

  advanceClock(deltaMs: number): readonly AuthorityEvent[] {
    return this.advanceToHorizon(this.#clock.now() + deltaMs);
  }

  #append(
    type: AuthorityEvent["type"],
    actorId: string,
    subjectId: string | null,
    parentSubjectId: string | null,
    payload: AuthorityEvent["payload"],
    causedByEventId: string | null = null,
  ): AuthorityEvent {
    const currentAuthorityEpoch =
      this.#policy === "protected" &&
      this.#store
        .history()
        .some((event) => event.type === "AUTHORITY_EPOCH_ADVANCED")
        ? CLOUD_CLEANUP_AUTHORITY_EPOCH + 1
        : CLOUD_CLEANUP_AUTHORITY_EPOCH;
    const logicalTimeMs =
      this.#store.history().length === 0
        ? this.#clock.now()
        : this.#clock.tick(40);
    return this.#store.append({
      logicalTimeMs,
      type,
      actorId,
      subjectId,
      parentSubjectId,
      causedByEventId,
      authorityEpoch: currentAuthorityEpoch,
      issuedAuthorityEpoch:
        payload.material === true || payload.entity?.authorityEpoch != null
          ? CLOUD_CLEANUP_AUTHORITY_EPOCH
          : null,
      payload,
    });
  }
}
