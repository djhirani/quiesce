import { describe, expect, it, vi } from "vitest";
import {
  CLOUD_CLEANUP_COMPILE_INPUT,
  compileShutdownContract,
} from "@/lib/ai/contract-compiler";
import { ModelOutputRejectedError } from "@/lib/ai/errors";
import type { StructuredModelClient } from "@/lib/ai/structured-client";
import { shutdownContract } from "@/lib/fixtures/shutdown-contract";

const modelContract = {
  ...shutdownContract,
  objective: "Model-proposed objective for the cleanup task.",
};

function clientReturning(value: unknown): StructuredModelClient {
  return {
    createStructured: vi.fn(async () => value as never),
  };
}

function clientThrowing(error: Error): StructuredModelClient {
  return {
    createStructured: vi.fn(async () => {
      throw error;
    }),
  };
}

describe("contract compiler", () => {
  it("returns model output with gpt-5.6 provenance on mocked success", async () => {
    const outcome = await compileShutdownContract(
      CLOUD_CLEANUP_COMPILE_INPUT,
      clientReturning(modelContract),
    );
    expect(outcome.contract).toEqual(modelContract);
    expect(outcome.provenance).toEqual({ source: "gpt-5.6", model: "gpt-5.6" });
  });

  it("falls back to the deterministic fixture when no client exists", async () => {
    const outcome = await compileShutdownContract(
      CLOUD_CLEANUP_COMPILE_INPUT,
      null,
    );
    expect(outcome.contract).toEqual(shutdownContract);
    expect(outcome.provenance.source).toBe("fixture");
    if (outcome.provenance.source === "fixture") {
      expect(outcome.provenance.reason).toBe("model_unavailable");
    }
  });

  it("falls back with rejected provenance on malformed model output", async () => {
    const outcome = await compileShutdownContract(
      CLOUD_CLEANUP_COMPILE_INPUT,
      clientThrowing(
        new ModelOutputRejectedError("Model output failed schema validation."),
      ),
    );
    expect(outcome.contract).toEqual(shutdownContract);
    expect(outcome.provenance.source).toBe("fixture");
    if (outcome.provenance.source === "fixture") {
      expect(outcome.provenance.reason).toBe("model_output_rejected");
    }
  });

  it("falls back with endpoint provenance on client failure", async () => {
    const outcome = await compileShutdownContract(
      CLOUD_CLEANUP_COMPILE_INPUT,
      clientThrowing(new Error("connect ETIMEDOUT")),
    );
    expect(outcome.contract).toEqual(shutdownContract);
    expect(outcome.provenance.source).toBe("fixture");
    if (outcome.provenance.source === "fixture") {
      expect(outcome.provenance.reason).toBe("model_endpoint_failed");
      expect(outcome.provenance.detail).toContain("ETIMEDOUT");
    }
  });
});
