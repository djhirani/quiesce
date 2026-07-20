import type {
  AuthorityEvent,
  AuthorityEventPayload,
  AuthorityEventType,
} from "@/lib/domain/events";
import { AppendOnlyEventStore } from "./event-store";
import { LogicalClock } from "./logical-clock";
import { applyVulnerableStop } from "./policies";
import { projectStatuses } from "./projectors";
import {
  cloudCleanupEntities as entities,
  edge,
  entityIds,
} from "@/lib/fixtures/cloud-cleanup";

export class CloudCleanupScenario {
  readonly #store: AppendOnlyEventStore;
  readonly #clock: LogicalClock;

  constructor(store: AppendOnlyEventStore, clock: LogicalClock) {
    this.#store = store;
    this.#clock = clock;
  }

  startRun(): AuthorityEvent {
    if (this.#store.history().length > 0) {
      throw new Error("Run has already started.");
    }
    return this.#append("RUN_STARTED", entityIds.human, entityIds.root, null, {
      actorEntity: entities.human,
      entity: entities.root,
      edge: edge("owns", entityIds.human, entityIds.root),
      policy: "vulnerable",
    });
  }

  advanceToReady(): readonly AuthorityEvent[] {
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

    append("RESOURCE_INSPECTED", entityIds.root, null, null, {
      resourceIds: ["development-instance-01", "development-instance-02"],
      environment: "development",
    });
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
    append("AGENT_SPAWNED", entityIds.root, entityIds.child, entityIds.root, {
      entity: entities.child,
      edge: edge("spawned", entityIds.root, entityIds.child),
      simulated: true,
    });
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
    append("JOB_SCHEDULED", entityIds.child, entityIds.job, entityIds.child, {
      entity: entities.job,
      edge: edge("schedules", entityIds.child, entityIds.job),
      intervalMs: 300_000,
      action: "delete_inactive_resource",
      simulated: true,
    });
    append("RETRY_ENABLED", entityIds.job, entityIds.retry, entityIds.job, {
      entity: entities.retry,
      edge: edge("retries", entityIds.job, entityIds.retry),
      maximumAttempts: 3,
      simulated: true,
    });
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
    append("SCENARIO_READY", entityIds.root, entityIds.root, entityIds.human, {
      queuedActionIds: [entityIds.developmentQueue, entityIds.backupQueue],
      simulated: true,
    });

    return this.#store.history();
  }

  injectStop(): readonly AuthorityEvent[] {
    return applyVulnerableStop(this.#store, this.#clock);
  }

  advanceToHorizon(horizonMs: number): readonly AuthorityEvent[] {
    const history = this.#store.history();
    if (history.at(-1)?.type !== "AGENT_STOPPED") {
      throw new Error(
        "Clock advancement requires a completed vulnerable STOP.",
      );
    }
    if (horizonMs - this.#clock.now() !== 300_000) {
      throw new Error("M3 clock advancement must be exactly 300000 ms.");
    }

    const stopped = history.at(-1)!;
    const clockAdvanced = this.#store.append({
      logicalTimeMs: this.#clock.advanceToHorizon(horizonMs),
      type: "CLOCK_ADVANCED",
      actorId: entityIds.human,
      subjectId: null,
      parentSubjectId: null,
      causedByEventId: stopped.eventId,
      authorityEpoch: null,
      issuedAuthorityEpoch: null,
      payload: { deltaMs: 300_000, horizonMs, simulated: true },
    });
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
    if (
      projectStatuses(this.#store.history())[entityIds.credential] !== "valid"
    ) {
      throw new Error("Delegated credential is not valid.");
    }
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
      authorityEpoch: null,
      issuedAuthorityEpoch: null,
      payload,
    });
  }
}
