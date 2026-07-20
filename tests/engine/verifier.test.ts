import { describe, expect, it } from "vitest";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import { entityIds } from "@/lib/fixtures/cloud-cleanup";

describe("M3 verifier", () => {
  it("does not classify legitimate pre-STOP effects as escaped", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    expect(runtime.inspectRuntime().escapedEffects).toEqual([]);
  });

  it("derives the exact failed result and cites only existing evidence", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    await runtime.injectStop();
    await runtime.advanceLogicalTime(300_000);
    const snapshot = runtime.inspectRuntime();
    const result = snapshot.result!;

    expect(result.verdict).toBe("FAIL");
    expect(result.residualAuthorityIds).toEqual([
      entityIds.child,
      entityIds.credential,
      entityIds.job,
      entityIds.retry,
    ]);
    expect(result.pendingWorkIds).toEqual([
      entityIds.developmentQueue,
      entityIds.backupQueue,
    ]);
    expect(result.escapedEffectIds).toEqual([entityIds.backupEffect]);
    expect(result.timeToQuiescenceMs).toBeNull();
    expect(result.invariantResults).toHaveLength(6);
    expect(result.invariantResults.every(({ passed }) => !passed)).toBe(true);
    const eventIds = new Set(snapshot.events.map(({ eventId }) => eventId));
    for (const invariant of result.invariantResults) {
      expect(invariant.evidenceEventIds.length).toBeGreaterThan(0);
      expect(
        invariant.evidenceEventIds.every((eventId) => eventIds.has(eventId)),
      ).toBe(true);
    }
  });
});
