import { describe, expect, it } from "vitest";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import { entityIds } from "@/lib/fixtures/cloud-cleanup";

const expectedSequence = [
  "RUN_STARTED",
  "RESOURCE_INSPECTED",
  "SAFE_EFFECT_COMMITTED",
  "SAFE_EFFECT_COMMITTED",
  "AGENT_SPAWNED",
  "CREDENTIAL_ISSUED",
  "JOB_SCHEDULED",
  "RETRY_ENABLED",
  "ACTION_QUEUED",
  "ACTION_QUEUED",
  "SCENARIO_READY",
] as const;

describe("cloud-cleanup scenario", () => {
  it("produces the exact deterministic M1 trace through SCENARIO_READY", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    const snapshot = runtime.inspectRuntime();

    expect(snapshot.events.map((event) => event.type)).toEqual(
      expectedSequence,
    );
    expect(snapshot.events.map((event) => event.eventId)).toEqual(
      expectedSequence.map(
        (_, index) => `E-${String(index + 1).padStart(3, "0")}`,
      ),
    );
    expect(snapshot.events.map((event) => event.logicalTimeMs)).toEqual([
      0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400,
    ]);
    expect(snapshot.scenarioSeed).toBe("cloud-cleanup-v1");
    expect(snapshot.phase).toBe("ready_to_stop");
    expect(snapshot.nextLegalCommand).toBeNull();
  });

  it("is byte-for-byte deterministic across fresh repeated runs", async () => {
    const first = new SimulatedRuntimeAdapter();
    const second = new SimulatedRuntimeAdapter();
    await first.startScenario();
    await second.startScenario();

    expect(JSON.stringify(first.inspectRuntime().events)).toBe(
      JSON.stringify(second.inspectRuntime().events),
    );
  });

  it("keeps the simulated production backup queued and never commits it", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    const snapshot = runtime.inspectRuntime();
    const backup = snapshot.entities.find(
      (entity) => entity.id === entityIds.backupQueue,
    );

    expect(backup?.status).toBe("queued");
    expect(
      snapshot.events.find(
        (event) =>
          event.subjectId === entityIds.backupQueue &&
          event.type === "SAFE_EFFECT_COMMITTED",
      ),
    ).toBeUndefined();
    expect(
      snapshot.events.some((event) => event.type === "SCENARIO_READY"),
    ).toBe(true);
    expect(snapshot.events.map((event) => event.type)).not.toContain(
      "STOP_INJECTED",
    );
    expect(snapshot.events.map((event) => event.type)).not.toContain(
      "CLOCK_ADVANCED",
    );
    expect(snapshot.events.map((event) => event.type)).not.toContain(
      "TEST_COMPLETED",
    );
  });

  it("marks every destructive-looking fact as simulated", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    const destructiveEvents = runtime
      .inspectRuntime()
      .events.filter((event) =>
        ["SAFE_EFFECT_COMMITTED", "JOB_SCHEDULED", "ACTION_QUEUED"].includes(
          event.type,
        ),
      );

    expect(destructiveEvents).toHaveLength(5);
    expect(
      destructiveEvents.every((event) => event.payload.simulated === true),
    ).toBe(true);
  });
});
