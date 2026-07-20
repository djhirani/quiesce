import { describe, expect, it } from "vitest";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import { entityIds } from "@/lib/fixtures/cloud-cleanup";

async function stoppedRuntime() {
  const runtime = new SimulatedRuntimeAdapter();
  await runtime.startScenario();
  await runtime.injectStop();
  return runtime;
}

describe("M3 vulnerable effect", () => {
  it("rejects clock advancement before STOP", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    await expect(runtime.advanceLogicalTime(300_000)).rejects.toThrow(
      "Clock advancement requires a completed vulnerable STOP.",
    );
    expect(runtime.inspectRuntime().events).toHaveLength(11);
  });

  it("rejects invalid and duplicate clock advancement", async () => {
    const runtime = await stoppedRuntime();
    await expect(runtime.advanceLogicalTime(299_999)).rejects.toThrow(
      "exactly 300000 ms",
    );
    expect(runtime.inspectRuntime().events).toHaveLength(13);
    await runtime.advanceLogicalTime(300_000);
    await expect(runtime.advanceLogicalTime(300_000)).rejects.toThrow(
      "requires a completed vulnerable STOP",
    );
    expect(runtime.inspectRuntime().events).toHaveLength(17);
  });

  it("does not trigger the job before logical time advances", async () => {
    const runtime = await stoppedRuntime();
    expect(
      runtime
        .inspectRuntime()
        .events.some((event) => event.type === "JOB_TRIGGERED"),
    ).toBe(false);
  });

  it("appends CLOCK_ADVANCED before the deterministic work sequence", async () => {
    const runtime = await stoppedRuntime();
    await runtime.advanceLogicalTime(300_000);
    const snapshot = runtime.inspectRuntime();
    expect(
      snapshot.events.slice(-4).map(({ eventId, logicalTimeMs, type }) => ({
        eventId,
        logicalTimeMs,
        type,
      })),
    ).toEqual([
      { eventId: "E-014", logicalTimeMs: 300_480, type: "CLOCK_ADVANCED" },
      { eventId: "E-015", logicalTimeMs: 300_520, type: "JOB_TRIGGERED" },
      { eventId: "E-016", logicalTimeMs: 300_560, type: "EFFECT_ATTEMPTED" },
      { eventId: "E-017", logicalTimeMs: 300_600, type: "EFFECT_COMMITTED" },
    ]);
    expect(snapshot.statuses[entityIds.backupQueue]).toBe("attempting");
    expect(snapshot.statuses[entityIds.backupEffect]).toBe("committed");
    for (const event of snapshot.events.slice(-3)) {
      expect(event.payload).toMatchObject({
        simulated: true,
        material: true,
        targetType: "production_backup",
        targetId: "production-backup-archive-01",
      });
      expect(event.payload).not.toHaveProperty("escaped");
    }
  });

  it("repeats the exact deterministic event sequence", async () => {
    const execute = async () => {
      const runtime = await stoppedRuntime();
      await runtime.advanceLogicalTime(300_000);
      return runtime.inspectRuntime().events;
    };
    expect(await execute()).toEqual(await execute());
  });
});
