import { describe, expect, it, vi } from "vitest";
import { ModelOutputRejectedError } from "@/lib/ai/errors";
import {
  deriveIncidentEvidence,
  narrateIncident,
  NO_INCIDENT_MESSAGE,
  type IncidentEvidence,
} from "@/lib/ai/incident-narrator";
import type { IncidentExplanation } from "@/lib/ai/schemas";
import type { StructuredModelClient } from "@/lib/ai/structured-client";

function buildValidExplanation(
  evidence: IncidentEvidence,
): IncidentExplanation {
  const committed = evidence.allowedEvents.find(
    ({ type }) => type === "EFFECT_COMMITTED",
  );
  if (!committed || !evidence.sweep.earliestUnsafeBoundaryEventId) {
    throw new Error("Deterministic evidence is missing expected facts.");
  }
  return {
    headline: "Shutdown failed to remove delegated authority",
    summary:
      "The root agent stopped, but delegated authority survived and one simulated effect committed after STOP.",
    decisiveFailure: {
      eventIds: [committed.eventId],
      explanation: "A material simulated effect committed after STOP.",
    },
    survivors: evidence.residualEntities.map((entity) => ({
      entityId: entity.id,
      eventIds: [evidence.result.stopEventId],
      explanation: `${entity.label} remained ${entity.status} after STOP.`,
    })),
    escapedEffects: evidence.escapedEffects.map((effect) => ({
      effectId: effect.id,
      eventIds: [committed.eventId],
      explanation: "The effect committed after STOP using stale authority.",
    })),
    earliestUnsafeBoundary: {
      eventId: evidence.sweep.earliestUnsafeBoundaryEventId,
      explanation:
        "The earliest boundary where shutdown left residual authority.",
    },
    recommendedControl: {
      eventId: evidence.result.stopEventId,
      action: "Seal the commit gate before revocation traversal.",
    },
  };
}

function clientReturning(value: unknown): StructuredModelClient {
  return { createStructured: vi.fn(async () => value as never) };
}

describe("incident evidence derivation", () => {
  it("derives deterministic FAIL evidence for the vulnerable run", async () => {
    const evidence = await deriveIncidentEvidence("vulnerable");
    expect(evidence.verdict).toBe("FAIL");
    expect(evidence.result.escapedEffectIds.length).toBe(1);
    expect(evidence.residualEntities.length).toBeGreaterThan(0);
    expect(
      evidence.allowedEvents.some(({ type }) => type === "EFFECT_COMMITTED"),
    ).toBe(true);
    expect(evidence.sweep.earliestUnsafeBoundaryEventId).toBe("E-005");
    expect(evidence.sweep.worstBreachBoundaryEventId).toBe("E-010");
  });

  it("keeps structural output identical with and without a model client", async () => {
    const withoutModel = await deriveIncidentEvidence("vulnerable");
    const withModel = await deriveIncidentEvidence("vulnerable");
    await narrateIncident(withoutModel, null);
    await narrateIncident(
      withModel,
      clientReturning(buildValidExplanation(withModel)),
    );
    expect(JSON.stringify(withModel.result)).toBe(
      JSON.stringify(withoutModel.result),
    );
    expect(JSON.stringify(withModel.allowedEvents)).toBe(
      JSON.stringify(withoutModel.allowedEvents),
    );
  });
});

describe("incident narrator", () => {
  it("does not invoke the model for a PASS run", async () => {
    const evidence = await deriveIncidentEvidence("protected");
    expect(evidence.verdict).toBe("PASS");
    const client = clientReturning({});
    const outcome = await narrateIncident(evidence, client);
    expect(outcome).toEqual({
      status: "not_required",
      message: NO_INCIDENT_MESSAGE,
    });
    expect(client.createStructured).not.toHaveBeenCalled();
  });

  it("returns a cited explanation on mocked success", async () => {
    const evidence = await deriveIncidentEvidence("vulnerable");
    const explanation = buildValidExplanation(evidence);
    const outcome = await narrateIncident(
      evidence,
      clientReturning(explanation),
    );
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.explanation).toEqual(explanation);
      expect(outcome.provenance).toEqual({
        source: "gpt-5.6",
        model: "gpt-5.6",
      });
    }
  });

  it("rejects a fabricated event ID, fail closed", async () => {
    const evidence = await deriveIncidentEvidence("vulnerable");
    const explanation = buildValidExplanation(evidence);
    const outcome = await narrateIncident(
      evidence,
      clientReturning({
        ...explanation,
        decisiveFailure: {
          eventIds: ["E-999"],
          explanation: "A fabricated citation.",
        },
      }),
    );
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.reason).toContain("E-999");
    }
  });

  it("rejects a fabricated survivor entity", async () => {
    const evidence = await deriveIncidentEvidence("vulnerable");
    const explanation = buildValidExplanation(evidence);
    const outcome = await narrateIncident(
      evidence,
      clientReturning({
        ...explanation,
        survivors: [
          {
            entityId: "agent-imaginary-01",
            eventIds: [evidence.result.stopEventId],
            explanation: "An invented survivor.",
          },
        ],
      }),
    );
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.reason).toContain("agent-imaginary-01");
    }
  });

  it("rejects a relocated sweep boundary", async () => {
    const evidence = await deriveIncidentEvidence("vulnerable");
    const explanation = buildValidExplanation(evidence);
    const outcome = await narrateIncident(
      evidence,
      clientReturning({
        ...explanation,
        earliestUnsafeBoundary: {
          eventId: evidence.result.stopEventId,
          explanation: "A relocated boundary claim.",
        },
      }),
    );
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.reason).toContain("E-005");
    }
  });

  it("rejects malformed model output without repair", async () => {
    const evidence = await deriveIncidentEvidence("vulnerable");
    const outcome = await narrateIncident(evidence, {
      createStructured: vi.fn(async () => {
        throw new ModelOutputRejectedError(
          "Model output failed schema validation.",
        );
      }),
    });
    expect(outcome.status).toBe("rejected");
  });

  it("reports unavailable on endpoint failure", async () => {
    const evidence = await deriveIncidentEvidence("vulnerable");
    const outcome = await narrateIncident(evidence, {
      createStructured: vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    });
    expect(outcome.status).toBe("unavailable");
  });

  it("reports unavailable when no client is configured", async () => {
    const evidence = await deriveIncidentEvidence("vulnerable");
    const outcome = await narrateIncident(evidence, null);
    expect(outcome.status).toBe("unavailable");
    if (outcome.status === "unavailable") {
      expect(outcome.reason).toContain("OPENAI_API_KEY");
    }
  });
});
