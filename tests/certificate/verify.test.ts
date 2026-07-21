// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canonicalize } from "@/lib/certificate/canonical";
import {
  computeCertificateId,
  type CertificateEnvelope,
} from "@/lib/certificate/certificate";
import {
  computeTraceHash,
  enrichTraceWithHashes,
  fromExportedTraceEvent,
  traceToCanonicalJsonl,
  type ExportedTraceEvent,
} from "@/lib/certificate/trace";
import { verifyCertificateEvidence } from "@/lib/certificate/verify";
import { completedBundle } from "./helpers";

function parseTrace(traceJsonl: string): ExportedTraceEvent[] {
  return traceJsonl
    .slice(0, -1)
    .split("\n")
    .map((line) => JSON.parse(line) as ExportedTraceEvent);
}

function rebuildJsonl(events: readonly unknown[]): string {
  return events.map((event) => canonicalize(event)).join("\n") + "\n";
}

function cloneEnvelope(envelope: CertificateEnvelope): CertificateEnvelope {
  return JSON.parse(JSON.stringify(envelope)) as CertificateEnvelope;
}

describe("certificate verification", () => {
  it("verifies untampered PASS and FAIL evidence", async () => {
    for (const policy of ["vulnerable", "protected"] as const) {
      const bundle = await completedBundle(policy);
      const verification = await verifyCertificateEvidence(
        JSON.parse(bundle.envelopeJson),
        bundle.traceJsonl,
      );
      expect(verification).toEqual({
        valid: true,
        certificateId: bundle.certificate.certificateId,
      });
    }
  });

  it("fails when an event's content changes", async () => {
    const bundle = await completedBundle("vulnerable");
    const events = parseTrace(bundle.traceJsonl);
    events[4] = { ...events[4], actor_id: "agent-tampered-01" };
    const verification = await verifyCertificateEvidence(
      bundle.envelope,
      rebuildJsonl(events),
    );
    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toContain(events[4].event_id);
    }
  });

  it("fails when event order changes", async () => {
    const bundle = await completedBundle("vulnerable");
    const events = parseTrace(bundle.traceJsonl);
    [events[2], events[3]] = [events[3], events[2]];
    const verification = await verifyCertificateEvidence(
      bundle.envelope,
      rebuildJsonl(events),
    );
    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toContain("hash chain broken");
    }
  });

  it("fails when a previous-event hash is broken", async () => {
    const bundle = await completedBundle("vulnerable");
    const events = parseTrace(bundle.traceJsonl);
    events[5] = {
      ...events[5],
      previous_event_hash: `sha256:${"0".repeat(64)}`,
    };
    const verification = await verifyCertificateEvidence(
      bundle.envelope,
      rebuildJsonl(events),
    );
    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toContain("previous_event_hash mismatch");
    }
  });

  it("rejects traces with missing or unexpected hash-chain fields", async () => {
    const bundle = await completedBundle("vulnerable");
    const missingHash = parseTrace(bundle.traceJsonl).map((event, index) => {
      if (index !== 3) return event;
      const clone: Record<string, unknown> = { ...event };
      delete clone.event_hash;
      return clone as unknown as ExportedTraceEvent;
    });
    const missingCheck = await verifyCertificateEvidence(
      bundle.envelope,
      rebuildJsonl(missingHash),
    );
    expect(missingCheck.valid).toBe(false);
    if (!missingCheck.valid) {
      expect(missingCheck.reason).toContain(
        "failed exported trace schema validation",
      );
    }

    const camelCaseLeak = parseTrace(bundle.traceJsonl).map((event, index) =>
      index === 3
        ? ({
            ...event,
            previousEventHash: event.previous_event_hash,
          } as unknown as ExportedTraceEvent)
        : event,
    );
    const unexpectedCheck = await verifyCertificateEvidence(
      bundle.envelope,
      rebuildJsonl(camelCaseLeak),
    );
    expect(unexpectedCheck.valid).toBe(false);
    if (!unexpectedCheck.valid) {
      expect(unexpectedCheck.reason).toContain(
        "failed exported trace schema validation",
      );
    }

    const malformedHash = parseTrace(bundle.traceJsonl).map((event, index) =>
      index === 3 ? { ...event, event_hash: "not-a-hash" } : event,
    );
    const malformedCheck = await verifyCertificateEvidence(
      bundle.envelope,
      rebuildJsonl(malformedHash),
    );
    expect(malformedCheck.valid).toBe(false);
    if (!malformedCheck.valid) {
      expect(malformedCheck.reason).toContain(
        "failed exported trace schema validation",
      );
    }
  });

  it("fails when contract_snapshot changes", async () => {
    const bundle = await completedBundle("vulnerable");
    const envelope = cloneEnvelope(bundle.envelope);
    (envelope.contract_snapshot as { objective: string }).objective =
      "Tampered objective.";
    const verification = await verifyCertificateEvidence(
      envelope,
      bundle.traceJsonl,
    );
    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toContain("Contract hash mismatch");
    }
  });

  it("fails when contract_hash changes", async () => {
    const bundle = await completedBundle("vulnerable");
    const envelope = cloneEnvelope(bundle.envelope);
    envelope.certificate.contract_hash = `sha256:${"a".repeat(64)}`;
    const verification = await verifyCertificateEvidence(
      envelope,
      bundle.traceJsonl,
    );
    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toContain("Contract hash mismatch");
    }
  });

  it("fails when a verifier-result field changes", async () => {
    const bundle = await completedBundle("vulnerable");
    const tamperedVerdict = cloneEnvelope(bundle.envelope);
    tamperedVerdict.certificate.verdict = "PASS";
    const verdictCheck = await verifyCertificateEvidence(
      tamperedVerdict,
      bundle.traceJsonl,
    );
    expect(verdictCheck.valid).toBe(false);
    if (!verdictCheck.valid) {
      expect(verdictCheck.reason).toContain("verdict");
    }
    const tamperedCounts = cloneEnvelope(bundle.envelope);
    tamperedCounts.certificate.residual_authorities = 0;
    const countsCheck = await verifyCertificateEvidence(
      tamperedCounts,
      bundle.traceJsonl,
    );
    expect(countsCheck.valid).toBe(false);
    if (!countsCheck.valid) {
      expect(countsCheck.reason).toContain("residual_authorities");
    }
  });

  it("fails when the certificate ID is inconsistent", async () => {
    const bundle = await completedBundle("vulnerable");
    const envelope = cloneEnvelope(bundle.envelope);
    envelope.certificate.certificate_id = "QC-0000000000000000";
    const verification = await verifyCertificateEvidence(
      envelope,
      bundle.traceJsonl,
    );
    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toContain("Certificate ID");
    }
  });

  it("fails on an incomplete trace even with recomputed hashes", async () => {
    const bundle = await completedBundle("vulnerable");
    const truncated = parseTrace(bundle.traceJsonl)
      .slice(0, -1)
      .map((exported) =>
        fromExportedTraceEvent({
          ...exported,
          previous_event_hash: null,
          event_hash: null,
        }),
      );
    const enriched = await enrichTraceWithHashes(truncated);
    const traceJsonl = traceToCanonicalJsonl(enriched);
    const envelope = cloneEnvelope(bundle.envelope);
    envelope.certificate.trace_hash = await computeTraceHash(traceJsonl);
    envelope.certificate.certificate_id = await computeCertificateId(
      envelope.certificate.run_id,
      envelope.certificate.trace_hash,
    );
    const verification = await verifyCertificateEvidence(envelope, traceJsonl);
    expect(verification.valid).toBe(false);
    if (!verification.valid) {
      expect(verification.reason).toContain("not a completed test");
    }
  });

  it("fails on schema-invalid envelopes and malformed traces", async () => {
    const bundle = await completedBundle("vulnerable");
    const missingField = cloneEnvelope(bundle.envelope) as {
      certificate: Record<string, unknown>;
    };
    delete missingField.certificate.trace_hash;
    const schemaCheck = await verifyCertificateEvidence(
      missingField,
      bundle.traceJsonl,
    );
    expect(schemaCheck.valid).toBe(false);
    const newlineCheck = await verifyCertificateEvidence(
      bundle.envelope,
      bundle.traceJsonl.slice(0, -1),
    );
    expect(newlineCheck.valid).toBe(false);
    if (!newlineCheck.valid) {
      expect(newlineCheck.reason).toContain("trailing newline");
    }
  });
});
