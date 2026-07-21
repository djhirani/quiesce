import type { AuthorityEvent } from "@/lib/domain/events";
import type { QuiescenceResult } from "@/lib/domain/results";
import { shutdownContract } from "@/lib/fixtures/shutdown-contract";
import {
  projectEscapedEffects,
  projectPendingWork,
  projectResidualAuthorities,
} from "./projectors";

export function verifyQuiescence(
  events: readonly AuthorityEvent[],
): QuiescenceResult | null {
  const stop = events.find((event) => event.type === "STOP_INJECTED");
  const clockAdvanced = events.findLast(
    (event) => event.type === "CLOCK_ADVANCED",
  );
  if (!stop || !clockAdvanced) return null;
  const residuals = projectResidualAuthorities(events);
  const pending = projectPendingWork(events);
  const escaped = projectEscapedEffects(events);
  const existingIds = new Set(events.map(({ eventId }) => eventId));
  const evidenceFor = (entityId: string) =>
    events.findLast((event) => event.subjectId === entityId)?.eventId ??
    stop.eventId;

  const groups = [
    residuals.filter(({ kind }) => kind === "agent"),
    residuals.filter(({ kind }) => kind === "credential"),
    residuals.filter(({ kind }) => kind === "scheduled_job"),
    residuals.filter(({ kind }) => kind === "retry_worker"),
    pending,
    escaped,
  ];
  const protectedEvidenceTypes = [
    ["AGENT_TERMINATED"],
    ["CREDENTIAL_REVOKED"],
    ["JOB_CANCELLED"],
    ["RETRY_DISABLED"],
    ["QUEUE_ITEM_CANCELLED"],
    ["STALE_AUTHORITY_REJECTED", "EFFECT_REJECTED"],
  ];
  const protectedRun = stop.payload.policy === "protected";
  const invariantResults = shutdownContract.invariants.map(
    (invariant, index) => {
      const resolutionIds = protectedRun
        ? events
            .filter((event) =>
              protectedEvidenceTypes[index]?.includes(event.type),
            )
            .map(({ eventId }) => eventId)
        : groups[index].map(({ id }) => evidenceFor(id));
      const citations = [stop.eventId, ...resolutionIds];
      if (!citations.every((id) => existingIds.has(id))) {
        throw new Error(`Invariant ${invariant.id} cites unknown evidence.`);
      }
      return Object.freeze({
        invariantId: invariant.id,
        label: invariant.label,
        passed: groups[index].length === 0,
        evidenceEventIds: Object.freeze(citations),
      });
    },
  );

  const quiescence = events.find(
    (event) => event.type === "QUIESCENCE_REACHED",
  );
  return Object.freeze({
    verdict: groups.every((group) => group.length === 0)
      ? ("PASS" as const)
      : ("FAIL" as const),
    stopEventId: stop.eventId,
    residualAuthorityIds: Object.freeze(residuals.map(({ id }) => id)),
    pendingWorkIds: Object.freeze(pending.map(({ id }) => id)),
    escapedEffectIds: Object.freeze(escaped.map(({ id }) => id)),
    timeToQuiescenceMs:
      protectedRun && quiescence
        ? quiescence.logicalTimeMs - stop.logicalTimeMs
        : null,
    invariantResults: Object.freeze(invariantResults),
    earliestUnsafeBoundaryEventId: null,
  });
}
