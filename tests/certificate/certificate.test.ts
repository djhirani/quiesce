// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import {
  CertificateGenerationError,
  generateCertificateBundle,
} from "@/lib/certificate/certificate";
import { VERIFIER_VERSION } from "@/lib/engine/verifier";
import { completedBundle, completedSnapshot } from "./helpers";

describe("certificate generation", () => {
  it("matches the deterministic verifier output for a FAIL run", async () => {
    const snapshot = await completedSnapshot("vulnerable");
    const bundle = await generateCertificateBundle(snapshot);
    const result = snapshot.result;
    if (!result) throw new Error("expected completed result");
    expect(bundle.certificateJson.verdict).toBe("FAIL");
    expect(bundle.certificateJson.stop_event_id).toBe(result.stopEventId);
    expect(bundle.certificateJson.residual_authorities).toBe(
      result.residualAuthorityIds.length,
    );
    expect(bundle.certificateJson.pending_work).toBe(
      result.pendingWorkIds.length,
    );
    expect(bundle.certificateJson.escaped_effects).toBe(
      result.escapedEffectIds.length,
    );
    expect(bundle.certificateJson.quiescence_event_id).toBeNull();
    expect(bundle.certificateJson.time_to_quiescence_ms).toBeNull();
    expect(bundle.certificateJson.verifier_version).toBe(VERIFIER_VERSION);
  });

  it("matches the deterministic verifier output for a PASS run", async () => {
    const snapshot = await completedSnapshot("protected");
    const bundle = await generateCertificateBundle(snapshot);
    const result = snapshot.result;
    if (!result) throw new Error("expected completed result");
    const quiescence = snapshot.events.find(
      (event) => event.type === "QUIESCENCE_REACHED",
    );
    expect(bundle.certificateJson.verdict).toBe("PASS");
    expect(bundle.certificateJson.quiescence_event_id).toBe(
      quiescence?.eventId,
    );
    expect(bundle.certificateJson.time_to_quiescence_ms).toBe(420);
    expect(bundle.certificateJson.time_to_quiescence_ms).toBe(
      result.timeToQuiescenceMs,
    );
    expect(bundle.certificateJson.residual_authorities).toBe(0);
    expect(bundle.certificateJson.escaped_effects).toBe(0);
  });

  it("builds a deterministic export-time hash chain", async () => {
    const bundle = await completedBundle("vulnerable");
    expect(bundle.enrichedEvents[0].previous_event_hash).toBeNull();
    for (let index = 1; index < bundle.enrichedEvents.length; index += 1) {
      expect(bundle.enrichedEvents[index].previous_event_hash).toBe(
        bundle.enrichedEvents[index - 1].event_hash,
      );
    }
    expect(
      bundle.enrichedEvents.every((event) =>
        event.event_hash?.startsWith("sha256:"),
      ),
    ).toBe(true);
    expect(bundle.traceJsonl.endsWith("\n")).toBe(true);
    expect(bundle.traceJsonl.endsWith("\n\n")).toBe(false);
  });

  it("exports snake_case trace fields only", async () => {
    const bundle = await completedBundle("vulnerable");
    expect(bundle.traceJsonl).toContain('"previous_event_hash"');
    expect(bundle.traceJsonl).toContain('"event_hash"');
    expect(bundle.traceJsonl).toContain('"event_id"');
    expect(bundle.traceJsonl).toContain('"actor_id"');
    expect(bundle.traceJsonl).not.toContain('"previousEventHash"');
    expect(bundle.traceJsonl).not.toContain('"eventHash"');
    expect(bundle.traceJsonl).not.toContain('"eventId"');
    expect(bundle.traceJsonl).not.toContain('"actorId"');
  });

  it("produces identical hashes and certificate IDs for identical runs", async () => {
    const first = await completedBundle("vulnerable");
    const second = await completedBundle("vulnerable");
    expect(second.envelopeJson).toBe(first.envelopeJson);
    expect(second.traceJsonl).toBe(first.traceJsonl);
    expect(second.certificate.certificateId).toBe(
      first.certificate.certificateId,
    );
    expect(first.certificate.certificateId).toMatch(/^QC-[0-9A-F]{16}$/);
  });

  it("refuses to generate before the test completes", async () => {
    const runtime = new SimulatedRuntimeAdapter("vulnerable");
    await runtime.startScenario();
    await runtime.injectStop();
    await expect(
      generateCertificateBundle(runtime.inspectRuntime()),
    ).rejects.toThrow(CertificateGenerationError);
  });
});
