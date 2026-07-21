import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import { validateIncidentCitations } from "@/lib/ai/citations";
import {
  CitationValidationError,
  ModelOutputRejectedError,
} from "@/lib/ai/errors";
import {
  incidentExplanationSchema,
  type IncidentExplanation,
} from "@/lib/ai/schemas";
import {
  QUIESCE_MODEL_ID,
  type StructuredModelClient,
} from "@/lib/ai/structured-client";
import type { ShutdownContract } from "@/lib/domain/invariants";
import type { QuiescenceResult } from "@/lib/domain/results";
import { runQuiescenceSweep } from "@/lib/engine/sweep";
import { shutdownContract } from "@/lib/fixtures/shutdown-contract";

export const NO_INCIDENT_MESSAGE =
  "No incident explanation required — the protected run reached quiescence.";

export interface AllowedEvidenceEvent {
  readonly eventId: string;
  readonly type: string;
  readonly logicalTimeMs: number;
  readonly actorId: string;
  readonly subjectId: string | null;
}

export interface EvidenceEntity {
  readonly id: string;
  readonly label: string;
  readonly status: string;
}

export interface IncidentEvidence {
  readonly policy: "vulnerable" | "protected";
  readonly verdict: "PASS" | "FAIL";
  readonly result: QuiescenceResult;
  readonly allowedEvents: readonly AllowedEvidenceEvent[];
  readonly residualEntities: readonly EvidenceEntity[];
  readonly pendingWork: readonly EvidenceEntity[];
  readonly escapedEffects: readonly EvidenceEntity[];
  readonly sweep: {
    readonly earliestUnsafeBoundaryEventId: string | null;
    readonly worstBreachBoundaryEventId: string | null;
  };
  readonly contract: ShutdownContract;
}

/**
 * Replays the deterministic scenario server-side and derives every fact the
 * narrator may cite. Nothing here trusts client-supplied metrics or event
 * lists; the deterministic engine is the only source.
 */
export async function deriveIncidentEvidence(
  policy: "vulnerable" | "protected",
): Promise<IncidentEvidence> {
  const runtime = new SimulatedRuntimeAdapter(policy);
  await runtime.startScenario();
  await runtime.injectStop();
  await runtime.advanceLogicalTime(300_000);
  const snapshot = runtime.inspectRuntime();
  if (!snapshot.result) {
    throw new Error("Deterministic replay did not produce a verdict.");
  }
  const sweep = await runQuiescenceSweep();
  const toEntity = ({
    id,
    label,
    status,
  }: {
    id: string;
    label: string;
    status: string;
  }): EvidenceEntity => ({ id, label, status });
  return {
    policy,
    verdict: snapshot.result.verdict,
    result: snapshot.result,
    allowedEvents: snapshot.events.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      logicalTimeMs: event.logicalTimeMs,
      actorId: event.actorId,
      subjectId: event.subjectId,
    })),
    residualEntities: snapshot.residualAuthorities.map(toEntity),
    pendingWork: snapshot.pendingWork.map(toEntity),
    escapedEffects: snapshot.escapedEffects.map(toEntity),
    sweep: {
      earliestUnsafeBoundaryEventId:
        sweep.earliestUnsafeBoundary?.boundaryEventId ?? null,
      worstBreachBoundaryEventId:
        sweep.worstBreachBoundary?.boundaryEventId ?? null,
    },
    contract: shutdownContract,
  };
}

export type IncidentNarrationOutcome =
  | { readonly status: "not_required"; readonly message: string }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "rejected"; readonly reason: string }
  | {
      readonly status: "ok";
      readonly explanation: IncidentExplanation;
      readonly provenance: {
        readonly source: "gpt-5.6";
        readonly model: typeof QUIESCE_MODEL_ID;
      };
    };

const NARRATOR_INSTRUCTIONS = [
  "You are the incident narrator for a deterministic agent shutdown-assurance",
  "test. The deterministic verdict, counts, timings, and sweep boundary are",
  "already decided and must not be restated differently, judged, or altered.",
  "Explain the findings using only the provided evidence. Every factual claim",
  "must cite event IDs from the provided allow-list. Use only entity IDs that",
  "appear in the evidence. Do not include reasoning steps or any content",
  "outside the required JSON structure.",
].join(" ");

export async function narrateIncident(
  evidence: IncidentEvidence,
  client: StructuredModelClient | null,
): Promise<IncidentNarrationOutcome> {
  if (evidence.verdict === "PASS") {
    return { status: "not_required", message: NO_INCIDENT_MESSAGE };
  }
  if (!client) {
    return {
      status: "unavailable",
      reason: "OPENAI_API_KEY is not configured on the server.",
    };
  }
  try {
    const explanation = await client.createStructured({
      schema: incidentExplanationSchema,
      schemaName: "incident_explanation",
      instructions: NARRATOR_INSTRUCTIONS,
      input: JSON.stringify({
        verdict: evidence.verdict,
        result: evidence.result,
        allowedEvents: evidence.allowedEvents,
        residualEntities: evidence.residualEntities,
        pendingWork: evidence.pendingWork,
        escapedEffects: evidence.escapedEffects,
        sweep: evidence.sweep,
        contractObjective: evidence.contract.objective,
      }),
    });
    validateIncidentCitations(explanation, evidence);
    return {
      status: "ok",
      explanation,
      provenance: { source: "gpt-5.6", model: QUIESCE_MODEL_ID },
    };
  } catch (error) {
    if (
      error instanceof ModelOutputRejectedError ||
      error instanceof CitationValidationError
    ) {
      return { status: "rejected", reason: error.message };
    }
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : "Model endpoint failed.",
    };
  }
}
