import { CitationValidationError } from "@/lib/ai/errors";
import type { IncidentExplanation } from "@/lib/ai/schemas";
import type { IncidentEvidence } from "@/lib/ai/incident-narrator";

/**
 * Fails closed. Every cited event ID must exist in the server-derived
 * allow-list, every named entity must exist in the deterministic evidence, and
 * the model may not relocate the deterministic sweep boundary.
 */
export function validateIncidentCitations(
  explanation: IncidentExplanation,
  evidence: IncidentEvidence,
): void {
  const allowedEventIds = new Set(
    evidence.allowedEvents.map(({ eventId }) => eventId),
  );
  const assertKnownEvents = (eventIds: readonly string[], where: string) => {
    for (const eventId of eventIds) {
      if (!allowedEventIds.has(eventId)) {
        throw new CitationValidationError(
          `${where} cites unknown event ID ${eventId}.`,
        );
      }
    }
  };

  assertKnownEvents(explanation.decisiveFailure.eventIds, "decisiveFailure");
  assertKnownEvents(
    [explanation.recommendedControl.eventId],
    "recommendedControl",
  );
  assertKnownEvents(
    [explanation.earliestUnsafeBoundary.eventId],
    "earliestUnsafeBoundary",
  );

  const deterministicBoundary = evidence.sweep.earliestUnsafeBoundaryEventId;
  if (
    deterministicBoundary !== null &&
    explanation.earliestUnsafeBoundary.eventId !== deterministicBoundary
  ) {
    throw new CitationValidationError(
      `earliestUnsafeBoundary must cite the deterministic boundary ${deterministicBoundary}, received ${explanation.earliestUnsafeBoundary.eventId}.`,
    );
  }

  const residualIds = new Set(evidence.residualEntities.map(({ id }) => id));
  for (const survivor of explanation.survivors) {
    if (!residualIds.has(survivor.entityId)) {
      throw new CitationValidationError(
        `survivors names ${survivor.entityId}, which is not a deterministic residual authority.`,
      );
    }
    assertKnownEvents(survivor.eventIds, `survivor ${survivor.entityId}`);
  }

  const escapedIds = new Set(evidence.escapedEffects.map(({ id }) => id));
  for (const escaped of explanation.escapedEffects) {
    if (!escapedIds.has(escaped.effectId)) {
      throw new CitationValidationError(
        `escapedEffects names ${escaped.effectId}, which is not a deterministic escaped effect.`,
      );
    }
    assertKnownEvents(escaped.eventIds, `escaped effect ${escaped.effectId}`);
  }
}
