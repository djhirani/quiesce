// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { POST as compileContract } from "@/app/api/compile-contract/route";
import { POST as explainIncident } from "@/app/api/explain-incident/route";
import { CLOUD_CLEANUP_COMPILE_INPUT } from "@/lib/ai/contract-compiler";
import { MAX_JSON_BODY_BYTES, readLimitedJson } from "@/lib/ai/http";
import { NO_INCIDENT_MESSAGE } from "@/lib/ai/incident-narrator";
import { shutdownContract } from "@/lib/fixtures/shutdown-contract";

function jsonRequest(url: string, body: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe("readLimitedJson", () => {
  it("rejects a body above the limit based on actual bytes", async () => {
    const oversize = JSON.stringify({ pad: "x".repeat(MAX_JSON_BODY_BYTES) });
    const result = await readLimitedJson(
      jsonRequest("http://localhost/api/compile-contract", oversize),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("enforces the limit without a stream, ignoring Content-Length", async () => {
    const oversize = "x".repeat(MAX_JSON_BODY_BYTES + 1);
    const result = await readLimitedJson({
      body: null,
      text: async () => oversize,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it("parses a small valid body", async () => {
    const result = await readLimitedJson(
      jsonRequest("http://localhost/api/compile-contract", '{"a":1}'),
    );
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it("rejects invalid JSON with 400", async () => {
    const result = await readLimitedJson(
      jsonRequest("http://localhost/api/compile-contract", "not json"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});

describe("POST /api/compile-contract", () => {
  it("rejects a request exceeding 32 KB", async () => {
    const response = await compileContract(
      jsonRequest(
        "http://localhost/api/compile-contract",
        JSON.stringify({
          ...CLOUD_CLEANUP_COMPILE_INPUT,
          task: "x".repeat(MAX_JSON_BODY_BYTES),
        }),
      ),
    );
    expect(response.status).toBe(413);
  });

  it("rejects invalid input with 422", async () => {
    const response = await compileContract(
      jsonRequest("http://localhost/api/compile-contract", '{"task":42}'),
    );
    expect(response.status).toBe(422);
  });

  it("returns the fixture with honest provenance when no key is configured", async () => {
    const response = await compileContract(
      jsonRequest(
        "http://localhost/api/compile-contract",
        JSON.stringify(CLOUD_CLEANUP_COMPILE_INPUT),
      ),
    );
    expect(response.status).toBe(200);
    const outcome = await response.json();
    expect(outcome.contract).toEqual(
      JSON.parse(JSON.stringify(shutdownContract)),
    );
    expect(outcome.provenance.source).toBe("fixture");
    expect(outcome.provenance.reason).toBe("model_unavailable");
  });
});

describe("POST /api/explain-incident", () => {
  it("does not narrate a protected PASS run", async () => {
    const response = await explainIncident(
      jsonRequest(
        "http://localhost/api/explain-incident",
        '{"policy":"protected"}',
      ),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.narration).toEqual({
      status: "not_required",
      message: NO_INCIDENT_MESSAGE,
    });
    expect(payload.structural.verdict).toBe("PASS");
  });

  it("returns unavailable narration with authoritative structure when no key exists", async () => {
    const response = await explainIncident(
      jsonRequest(
        "http://localhost/api/explain-incident",
        '{"policy":"vulnerable"}',
      ),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.narration.status).toBe("unavailable");
    expect(payload.structural.verdict).toBe("FAIL");
    expect(payload.structural.escapedEffectIds).toHaveLength(1);
    expect(payload.structural.earliestUnsafeBoundaryEventId).toBe("E-005");
    expect(payload.structural.allowedEventIds).toContain("E-017");
  });

  it("rejects malformed request bodies", async () => {
    const badJson = await explainIncident(
      jsonRequest("http://localhost/api/explain-incident", "{"),
    );
    expect(badJson.status).toBe(400);
    const badShape = await explainIncident(
      jsonRequest("http://localhost/api/explain-incident", '{"policy":"x"}'),
    );
    expect(badShape.status).toBe(422);
  });
});
