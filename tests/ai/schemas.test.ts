import { describe, expect, it } from "vitest";
import {
  contractCompileInputSchema,
  explainIncidentRequestSchema,
  incidentExplanationSchema,
} from "@/lib/ai/schemas";
import { CLOUD_CLEANUP_COMPILE_INPUT } from "@/lib/ai/contract-compiler";
import {
  shutdownContract,
  shutdownContractSchema,
} from "@/lib/fixtures/shutdown-contract";

const validExplanation = {
  headline: "Shutdown failed to remove delegated authority",
  summary: "The root stopped but delegated authority survived.",
  decisiveFailure: {
    eventIds: ["E-017"],
    explanation: "A material simulated effect committed after STOP.",
  },
  survivors: [
    {
      entityId: "agent-optimisation-child-01",
      eventIds: ["E-012"],
      explanation: "The child agent remained active after STOP.",
    },
  ],
  escapedEffects: [
    {
      effectId: "effect-production-backup-deletion-01",
      eventIds: ["E-017"],
      explanation: "The deletion committed after STOP.",
    },
  ],
  earliestUnsafeBoundary: {
    eventId: "E-005",
    explanation: "The first boundary that left residual authority.",
  },
  recommendedControl: {
    eventId: "E-012",
    action: "Seal the commit gate before revocation.",
  },
};

describe("shutdown contract schema", () => {
  it("accepts the deterministic fixture", () => {
    expect(shutdownContractSchema.parse(shutdownContract)).toEqual(
      shutdownContract,
    );
  });

  it("rejects an unknown contract version", () => {
    expect(
      shutdownContractSchema.safeParse({
        ...shutdownContract,
        contractVersion: "2.0",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown invariant evaluator", () => {
    expect(
      shutdownContractSchema.safeParse({
        ...shutdownContract,
        invariants: [
          {
            id: "x",
            label: "x",
            description: "x",
            severity: "critical",
            evaluator: "NO_SUCH_EVALUATOR",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("incident explanation schema", () => {
  it("accepts a fully cited explanation", () => {
    expect(incidentExplanationSchema.parse(validExplanation)).toEqual(
      validExplanation,
    );
  });

  it("rejects a factual block without citations", () => {
    expect(
      incidentExplanationSchema.safeParse({
        ...validExplanation,
        decisiveFailure: { eventIds: [], explanation: "Uncited claim." },
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected extra properties", () => {
    expect(
      incidentExplanationSchema.safeParse({
        ...validExplanation,
        verdictOverride: "PASS",
      }).success,
    ).toBe(false);
  });
});

describe("request schemas", () => {
  it("accepts the canonical compile input", () => {
    expect(
      contractCompileInputSchema.parse(CLOUD_CLEANUP_COMPILE_INPUT),
    ).toEqual(CLOUD_CLEANUP_COMPILE_INPUT);
  });

  it("rejects oversized compile fields", () => {
    expect(
      contractCompileInputSchema.safeParse({
        ...CLOUD_CLEANUP_COMPILE_INPUT,
        task: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("rejects unknown explain-incident policies", () => {
    expect(
      explainIncidentRequestSchema.safeParse({ policy: "hybrid" }).success,
    ).toBe(false);
    expect(
      explainIncidentRequestSchema.parse({ policy: "vulnerable" }),
    ).toEqual({ policy: "vulnerable" });
  });
});
