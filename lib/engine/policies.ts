import type { AuthorityEvent } from "@/lib/domain/events";
import { AppendOnlyEventStore } from "@/lib/engine/event-store";
import { LogicalClock } from "@/lib/engine/logical-clock";
import { cloudCleanupEntities, entityIds } from "@/lib/fixtures/cloud-cleanup";

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
    authorityEpoch: null,
    issuedAuthorityEpoch: null,
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
    authorityEpoch: null,
    issuedAuthorityEpoch: null,
    payload: {
      entity: { ...cloudCleanupEntities.root, status: "stopped" },
      propagation: "none",
      simulated: true,
    },
  });

  return Object.freeze([stop, rootStopped]);
}
