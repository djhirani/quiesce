import type { AuthorityEvent } from "@/lib/domain/events";
import { AppendOnlyEventStore } from "@/lib/engine/event-store";
import { LogicalClock } from "@/lib/engine/logical-clock";
import {
  CLOUD_CLEANUP_AUTHORITY_EPOCH,
  cloudCleanupEntities,
  entityIds,
} from "@/lib/fixtures/cloud-cleanup";

export function applyVulnerableStop(
  store: AppendOnlyEventStore,
  clock: LogicalClock,
): readonly AuthorityEvent[] {
  const history = store.history();
  if (history.some((event) => event.type === "STOP_INJECTED")) {
    throw new Error("STOP has already been injected.");
  }
  if (history.at(-1)?.type !== "SCENARIO_READY") {
    throw new Error("STOP requires SCENARIO_READY.");
  }

  const scenarioReady = history.at(-1)!;
  const stop = store.append({
    logicalTimeMs: clock.tick(40),
    type: "STOP_INJECTED",
    actorId: entityIds.human,
    subjectId: entityIds.root,
    parentSubjectId: entityIds.human,
    causedByEventId: scenarioReady.eventId,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    issuedAuthorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    payload: {
      policy: "vulnerable",
      scope: "root_only",
      simulated: true,
    },
  });
  const rootStopped = store.append({
    logicalTimeMs: clock.tick(40),
    type: "AGENT_STOPPED",
    actorId: entityIds.human,
    subjectId: entityIds.root,
    parentSubjectId: entityIds.human,
    causedByEventId: stop.eventId,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    issuedAuthorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    payload: {
      entity: { ...cloudCleanupEntities.root, status: "stopped" },
      propagation: "none",
      simulated: true,
    },
  });

  return Object.freeze([stop, rootStopped]);
}

export function applyProtectedStop(
  store: AppendOnlyEventStore,
  clock: LogicalClock,
): readonly AuthorityEvent[] {
  const history = store.history();
  if (history.some((event) => event.type === "STOP_INJECTED")) {
    throw new Error("STOP has already been injected.");
  }
  if (history.at(-1)?.type !== "SCENARIO_READY") {
    throw new Error("STOP requires SCENARIO_READY.");
  }

  const appended: AuthorityEvent[] = [];
  let causedByEventId = history.at(-1)!.eventId;
  const append = (
    type: AuthorityEvent["type"],
    actorId: string,
    subjectId: string | null,
    payload: AuthorityEvent["payload"],
    offsetMs = 40,
  ) => {
    const subject = Object.values(cloudCleanupEntities).find(
      (entity) => entity.id === subjectId,
    );
    const event = store.append({
      logicalTimeMs: clock.tick(offsetMs),
      type,
      actorId,
      subjectId,
      parentSubjectId: subject?.parentId ?? null,
      causedByEventId,
      authorityEpoch:
        type === "STOP_INJECTED"
          ? CLOUD_CLEANUP_AUTHORITY_EPOCH
          : CLOUD_CLEANUP_AUTHORITY_EPOCH + 1,
      issuedAuthorityEpoch:
        subjectId === entityIds.developmentQueue ||
        subjectId === entityIds.backupQueue
          ? CLOUD_CLEANUP_AUTHORITY_EPOCH
          : null,
      payload,
    });
    appended.push(event);
    causedByEventId = event.eventId;
    return event;
  };

  append("STOP_INJECTED", entityIds.human, entityIds.root, {
    policy: "protected",
    protocol: "SEAL_REVOKE_DRAIN_PROVE",
    simulated: true,
  });
  append("AUTHORITY_EPOCH_ADVANCED", entityIds.human, entityIds.root, {
    previousEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    currentEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH + 1,
    simulated: true,
  });
  append("COMMIT_GATE_SEALED", entityIds.human, entityIds.root, {
    minimumValidAuthorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH + 1,
    gateStatus: "sealed",
    simulated: true,
  });
  for (const queueId of [entityIds.developmentQueue, entityIds.backupQueue]) {
    const queue =
      queueId === entityIds.developmentQueue
        ? cloudCleanupEntities.developmentQueue
        : cloudCleanupEntities.backupQueue;
    append("QUEUE_ITEM_CANCELLED", entityIds.root, queueId, {
      entity: { ...queue, status: "cancelled", committable: false },
      issuedAuthorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
      simulated: true,
    });
  }
  append("JOB_CANCELLED", entityIds.root, entityIds.job, {
    entity: { ...cloudCleanupEntities.job, status: "cancelled" },
    simulated: true,
  });
  append("RETRY_DISABLED", entityIds.root, entityIds.retry, {
    entity: { ...cloudCleanupEntities.retry, status: "cancelled" },
    simulated: true,
  });
  append("CREDENTIAL_REVOKED", entityIds.root, entityIds.credential, {
    entity: { ...cloudCleanupEntities.credential, status: "revoked" },
    simulated: true,
  });
  append("AGENT_TERMINATED", entityIds.root, entityIds.child, {
    entity: { ...cloudCleanupEntities.child, status: "terminated" },
    simulated: true,
  });
  append("AGENT_TERMINATED", entityIds.human, entityIds.root, {
    entity: { ...cloudCleanupEntities.root, status: "terminated" },
    simulated: true,
  });
  append(
    "QUIESCENCE_REACHED",
    entityIds.human,
    entityIds.root,
    {
      authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH + 1,
      residualAuthorityIds: [],
      pendingWorkIds: [],
      simulated: true,
    },
    60,
  );

  return Object.freeze(appended);
}
