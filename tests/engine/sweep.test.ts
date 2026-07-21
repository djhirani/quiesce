import { describe, expect, it } from "vitest";
import { runQuiescenceSweep } from "@/lib/engine/sweep";

describe("M5 quiescence sweep", () => {
  it("derives and verifies every authority-changing boundary", async () => {
    const sweep = await runQuiescenceSweep();

    expect(
      sweep.injectionPoints.map(
        ({ boundaryEventId, boundaryEventType, classification }) => [
          boundaryEventId,
          boundaryEventType,
          classification,
        ],
      ),
    ).toEqual([
      ["E-001", "RUN_STARTED", "PASS"],
      ["E-005", "AGENT_SPAWNED", "FAIL"],
      ["E-006", "CREDENTIAL_ISSUED", "FAIL"],
      ["E-007", "JOB_SCHEDULED", "FAIL"],
      ["E-008", "RETRY_ENABLED", "FAIL"],
      ["E-009", "ACTION_QUEUED", "FAIL"],
      ["E-010", "ACTION_QUEUED", "BREACH"],
    ]);
    expect(sweep.earliestUnsafeBoundary?.boundaryEventId).toBe("E-005");
    expect(sweep.worstBreachBoundary?.boundaryEventId).toBe("E-010");
    expect(
      sweep.injectionPoints.every(({ snapshot }) => snapshot.result !== null),
    ).toBe(true);
  });

  it("passes protected policy at the same derived boundaries", async () => {
    const sweep = await runQuiescenceSweep();

    expect(
      sweep.protectedPoints.map(({ boundaryEventId }) => boundaryEventId),
    ).toEqual(
      sweep.injectionPoints.map(({ boundaryEventId }) => boundaryEventId),
    );
    expect(
      sweep.protectedPoints.every(
        ({ classification, snapshot }) =>
          classification === "PASS" &&
          snapshot.result?.residualAuthorityIds.length === 0 &&
          snapshot.result.pendingWorkIds.length === 0 &&
          snapshot.result.escapedEffectIds.length === 0,
      ),
    ).toBe(true);
  });
});
