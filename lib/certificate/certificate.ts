import { z } from "zod";
import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import { canonicalize } from "@/lib/certificate/canonical";
import { sha256Hex } from "@/lib/certificate/hash";
import {
  computeTraceHash,
  enrichTraceWithHashes,
  traceToCanonicalJsonl,
  type ExportedTraceEvent,
} from "@/lib/certificate/trace";
import type { ShutdownContract } from "@/lib/domain/invariants";
import { VERIFIER_VERSION } from "@/lib/engine/verifier";
import {
  shutdownContract,
  shutdownContractSchema,
} from "@/lib/fixtures/shutdown-contract";
import { sha256Prefixed } from "@/lib/certificate/hash";

export interface QuiescenceCertificate {
  readonly certificateId: string;
  readonly runId: string;
  readonly scenarioSeed: string;
  readonly contractHash: string;
  readonly traceHash: string;
  readonly verifierVersion: string;
  readonly stopEventId: string;
  readonly quiescenceEventId: string | null;
  readonly verdict: "PASS" | "FAIL";
  readonly residualAuthorities: number;
  readonly pendingWork: number;
  readonly escapedEffects: number;
  readonly timeToQuiescenceMs: number | null;
}

const sha256String = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const certificateJsonSchema = z.strictObject({
  certificate_id: z.string().regex(/^QC-[0-9A-F]{16}$/),
  run_id: z.string().min(1),
  scenario_seed: z.string().min(1),
  contract_hash: sha256String,
  trace_hash: sha256String,
  verifier_version: z.string().min(1),
  stop_event_id: z.string().min(1),
  quiescence_event_id: z.string().min(1).nullable(),
  verdict: z.enum(["PASS", "FAIL"]),
  residual_authorities: z.number().int().min(0),
  pending_work: z.number().int().min(0),
  escaped_effects: z.number().int().min(0),
  time_to_quiescence_ms: z.number().int().min(0).nullable(),
});

export type CertificateJson = z.infer<typeof certificateJsonSchema>;

export const certificateEnvelopeSchema = z.strictObject({
  certificate: certificateJsonSchema,
  contract_snapshot: shutdownContractSchema,
});

export type CertificateEnvelope = z.infer<typeof certificateEnvelopeSchema>;

export function toCertificateJson(
  certificate: QuiescenceCertificate,
): CertificateJson {
  return {
    certificate_id: certificate.certificateId,
    run_id: certificate.runId,
    scenario_seed: certificate.scenarioSeed,
    contract_hash: certificate.contractHash,
    trace_hash: certificate.traceHash,
    verifier_version: certificate.verifierVersion,
    stop_event_id: certificate.stopEventId,
    quiescence_event_id: certificate.quiescenceEventId,
    verdict: certificate.verdict,
    residual_authorities: certificate.residualAuthorities,
    pending_work: certificate.pendingWork,
    escaped_effects: certificate.escapedEffects,
    time_to_quiescence_ms: certificate.timeToQuiescenceMs,
  };
}

export function fromCertificateJson(
  json: CertificateJson,
): QuiescenceCertificate {
  return {
    certificateId: json.certificate_id,
    runId: json.run_id,
    scenarioSeed: json.scenario_seed,
    contractHash: json.contract_hash,
    traceHash: json.trace_hash,
    verifierVersion: json.verifier_version,
    stopEventId: json.stop_event_id,
    quiescenceEventId: json.quiescence_event_id,
    verdict: json.verdict,
    residualAuthorities: json.residual_authorities,
    pendingWork: json.pending_work,
    escapedEffects: json.escaped_effects,
    timeToQuiescenceMs: json.time_to_quiescence_ms,
  };
}

/**
 * Deterministic certificate ID: QC- followed by the first 16 uppercase hex
 * characters of SHA-256 over the canonical { runId, traceHash } object. No
 * timestamps, counters, randomness, or global state.
 */
export async function computeCertificateId(
  runId: string,
  traceHash: string,
): Promise<string> {
  const digest = await sha256Hex(canonicalize({ runId, traceHash }));
  return `QC-${digest.slice(0, 16).toUpperCase()}`;
}

export class CertificateGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateGenerationError";
  }
}

export interface CertificateBundle {
  readonly certificate: QuiescenceCertificate;
  readonly certificateJson: CertificateJson;
  readonly envelope: CertificateEnvelope;
  /** Exact certificate.json bytes: canonical envelope plus trailing newline. */
  readonly envelopeJson: string;
  /** Exact trace.jsonl bytes: canonical exported events, one per line. */
  readonly traceJsonl: string;
  readonly enrichedEvents: readonly ExportedTraceEvent[];
}

/**
 * Generates the tamper-evident local test record for a COMPLETED deterministic
 * run. Every field derives from the verifier result and the event trace; the
 * verdict is never reinterpreted.
 */
export async function generateCertificateBundle(
  snapshot: RuntimeSnapshot,
  contract: ShutdownContract = shutdownContract,
): Promise<CertificateBundle> {
  if (snapshot.phase !== "test_complete" || !snapshot.result) {
    throw new CertificateGenerationError(
      "Certificate generation requires a completed test with a final verdict.",
    );
  }
  if (!snapshot.runId) {
    throw new CertificateGenerationError(
      "Certificate generation requires a run identity.",
    );
  }
  const result = snapshot.result;
  const quiescenceEvent = snapshot.events.find(
    (event) => event.type === "QUIESCENCE_REACHED",
  );
  if (result.verdict === "PASS" && !quiescenceEvent) {
    throw new CertificateGenerationError(
      "A PASS verdict requires a recorded QUIESCENCE_REACHED event.",
    );
  }

  const enrichedEvents = await enrichTraceWithHashes(snapshot.events);
  const traceJsonl = traceToCanonicalJsonl(enrichedEvents);
  const traceHash = await computeTraceHash(traceJsonl);
  const validatedContract = shutdownContractSchema.parse(contract);
  const contractHash = await sha256Prefixed(canonicalize(validatedContract));
  const certificate: QuiescenceCertificate = {
    certificateId: await computeCertificateId(snapshot.runId, traceHash),
    runId: snapshot.runId,
    scenarioSeed: snapshot.scenarioSeed,
    contractHash,
    traceHash,
    verifierVersion: VERIFIER_VERSION,
    stopEventId: result.stopEventId,
    quiescenceEventId:
      result.verdict === "PASS" ? (quiescenceEvent?.eventId ?? null) : null,
    verdict: result.verdict,
    residualAuthorities: result.residualAuthorityIds.length,
    pendingWork: result.pendingWorkIds.length,
    escapedEffects: result.escapedEffectIds.length,
    timeToQuiescenceMs: result.timeToQuiescenceMs,
  };
  const certificateJson = certificateJsonSchema.parse(
    toCertificateJson(certificate),
  );
  const envelope = certificateEnvelopeSchema.parse({
    certificate: certificateJson,
    contract_snapshot: validatedContract,
  });
  return {
    certificate,
    certificateJson,
    envelope,
    envelopeJson: canonicalize(envelope) + "\n",
    traceJsonl,
    enrichedEvents,
  };
}
