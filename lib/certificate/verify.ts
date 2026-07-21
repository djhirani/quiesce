import { canonicalize } from "@/lib/certificate/canonical";
import { sha256Prefixed } from "@/lib/certificate/hash";
import {
  certificateEnvelopeSchema,
  computeCertificateId,
} from "@/lib/certificate/certificate";
import {
  computeTraceHash,
  exportedTraceEventSchema,
  fromExportedTraceEvent,
  traceToCanonicalJsonl,
  type ExportedTraceEvent,
} from "@/lib/certificate/trace";
import { projectPhase } from "@/lib/engine/projectors";
import { VERIFIER_VERSION, verifyQuiescence } from "@/lib/engine/verifier";

export type CertificateVerification =
  | { readonly valid: true; readonly certificateId: string }
  | { readonly valid: false; readonly reason: string };

function invalid(reason: string): CertificateVerification {
  return { valid: false, reason };
}

/**
 * Verifies a certificate envelope against an exported snake_case trace using
 * only the supplied evidence: strictly validates the exported trace schema,
 * recomputes the contract hash, the per-event hash chain, the trace hash, the
 * deterministic verifier result, and the certificate ID. Fails closed with a
 * precise reason on the first mismatch.
 */
export async function verifyCertificateEvidence(
  envelopeValue: unknown,
  traceJsonl: string,
): Promise<CertificateVerification> {
  try {
    const parsedEnvelope = certificateEnvelopeSchema.safeParse(envelopeValue);
    if (!parsedEnvelope.success) {
      return invalid("Certificate envelope failed schema validation.");
    }
    const { certificate, contract_snapshot } = parsedEnvelope.data;

    const contractHash = await sha256Prefixed(canonicalize(contract_snapshot));
    if (contractHash !== certificate.contract_hash) {
      return invalid(
        "Contract hash mismatch: contract_snapshot does not match contract_hash.",
      );
    }

    if (!traceJsonl.endsWith("\n")) {
      return invalid("Trace must end with exactly one trailing newline.");
    }
    const lines = traceJsonl.slice(0, -1).split("\n");
    if (lines.length === 0 || lines.some((line) => line.length === 0)) {
      return invalid("Trace contains empty lines or no events.");
    }
    const exportedEvents: ExportedTraceEvent[] = [];
    for (const [index, line] of lines.entries()) {
      let parsedLine: unknown;
      try {
        parsedLine = JSON.parse(line);
      } catch {
        return invalid(`Trace line ${index + 1} is not valid JSON.`);
      }
      const parsedEvent = exportedTraceEventSchema.safeParse(parsedLine);
      if (!parsedEvent.success) {
        return invalid(
          `Trace line ${index + 1} failed exported trace schema validation.`,
        );
      }
      exportedEvents.push(parsedEvent.data);
    }

    let expectedPrevious: string | null = null;
    for (const exported of exportedEvents) {
      if (exported.previous_event_hash !== expectedPrevious) {
        return invalid(
          `Event hash chain broken at ${exported.event_id}: previous_event_hash mismatch.`,
        );
      }
      const hashable: Record<string, unknown> = { ...exported };
      delete hashable.event_hash;
      const recomputed = await sha256Prefixed(canonicalize(hashable));
      if (recomputed !== exported.event_hash) {
        return invalid(
          `Event ${exported.event_id} content does not match its event hash.`,
        );
      }
      expectedPrevious = exported.event_hash;
    }

    const traceHash = await computeTraceHash(
      traceToCanonicalJsonl(exportedEvents),
    );
    if (traceHash !== certificate.trace_hash) {
      return invalid("Trace hash mismatch: trace content or order changed.");
    }

    const events = exportedEvents.map(fromExportedTraceEvent);
    if (projectPhase(events) !== "test_complete") {
      return invalid(
        "Trace is not a completed test run; certificates exist only after completion.",
      );
    }
    const result = verifyQuiescence(events);
    if (!result) {
      return invalid("Trace does not contain a verifiable completed test.");
    }
    if (certificate.verifier_version !== VERIFIER_VERSION) {
      return invalid(
        `Verifier version mismatch: expected ${VERIFIER_VERSION}.`,
      );
    }
    const firstEvent = events[0];
    if (
      certificate.run_id !== firstEvent.runId ||
      certificate.scenario_seed !== firstEvent.scenarioSeed
    ) {
      return invalid("Certificate run identity does not match the trace.");
    }
    const quiescenceEvent = events.find(
      (event) => event.type === "QUIESCENCE_REACHED",
    );
    const expected = {
      stop_event_id: result.stopEventId,
      verdict: result.verdict,
      residual_authorities: result.residualAuthorityIds.length,
      pending_work: result.pendingWorkIds.length,
      escaped_effects: result.escapedEffectIds.length,
      time_to_quiescence_ms: result.timeToQuiescenceMs,
      quiescence_event_id:
        result.verdict === "PASS" ? (quiescenceEvent?.eventId ?? null) : null,
    } as const;
    for (const [field, expectedValue] of Object.entries(expected)) {
      const actual = certificate[field as keyof typeof certificate];
      if (actual !== expectedValue) {
        return invalid(
          `Certificate field ${field} does not match the deterministic verifier output.`,
        );
      }
    }

    const expectedCertificateId = await computeCertificateId(
      certificate.run_id,
      traceHash,
    );
    if (certificate.certificate_id !== expectedCertificateId) {
      return invalid(
        "Certificate ID is inconsistent with the run identity and trace hash.",
      );
    }

    return { valid: true, certificateId: certificate.certificate_id };
  } catch (error) {
    return invalid(
      `Verification failed: ${error instanceof Error ? error.message : "unexpected error"}.`,
    );
  }
}
