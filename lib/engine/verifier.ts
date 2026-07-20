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
  const committed = events.findLast(
    (event) => event.type === "EFFECT_COMMITTED",
  );
  if (!stop || !committed) return null;
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
  const invariantResults = shutdownContract.invariants.map(
    (invariant, index) => {
      const citations = [
        stop.eventId,
        ...groups[index].map(({ id }) => evidenceFor(id)),
      ];
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

  return Object.freeze({
    verdict: "FAIL" as const,
    stopEventId: stop.eventId,
    residualAuthorityIds: Object.freeze(residuals.map(({ id }) => id)),
    pendingWorkIds: Object.freeze(pending.map(({ id }) => id)),
    escapedEffectIds: Object.freeze(escaped.map(({ id }) => id)),
    timeToQuiescenceMs: null,
    invariantResults: Object.freeze(invariantResults),
    earliestUnsafeBoundaryEventId: null,
  });
}
