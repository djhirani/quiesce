import { describe, expect, it } from "vitest";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import { entityIds } from "@/lib/fixtures/cloud-cleanup";

describe("vulnerable STOP", () => {
  it("rejects STOP before SCENARIO_READY", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await expect(runtime.injectStop()).rejects.toThrow(
      "STOP requires SCENARIO_READY.",
    );
    expect(runtime.inspectRuntime().events).toHaveLength(0);
  });

  it("rejects duplicate STOP without appending more facts", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    await runtime.injectStop();
    const eventCount = runtime.inspectRuntime().events.length;

    await expect(runtime.injectStop()).rejects.toThrow(
      "STOP has already been injected.",
    );
    expect(runtime.inspectRuntime().events).toHaveLength(eventCount);
  });

  it("appends the exact STOP sequence and stops only the root", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    await runtime.injectStop();
    const snapshot = runtime.inspectRuntime();

    expect(
      snapshot.events.slice(-2).map(({ eventId, logicalTimeMs, type }) => ({
        eventId,
        logicalTimeMs,
        type,
      })),
    ).toEqual([
      { eventId: "E-012", logicalTimeMs: 440, type: "STOP_INJECTED" },
      { eventId: "E-013", logicalTimeMs: 480, type: "AGENT_STOPPED" },
    ]);
    expect(snapshot.statuses[entityIds.root]).toBe("stopped");
    expect(snapshot.statuses[entityIds.child]).toBe("active");
    expect(snapshot.statuses[entityIds.credential]).toBe("valid");
    expect(snapshot.statuses[entityIds.job]).toBe("armed");
    expect(snapshot.statuses[entityIds.retry]).toBe("active");
    expect(snapshot.phase).toBe("survivors_evaluated");
    expect(snapshot.nextLegalCommand).toBe("ADVANCE_CLOCK");
  });

  it("projects exact residual authority and committable pending work", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    await runtime.injectStop();
    const snapshot = runtime.inspectRuntime();

    expect(snapshot.residualAuthorities.map(({ id }) => id)).toEqual([
      entityIds.child,
      entityIds.credential,
      entityIds.job,
      entityIds.retry,
    ]);
    expect(snapshot.pendingWork.map(({ id }) => id)).toEqual([
      entityIds.developmentQueue,
      entityIds.backupQueue,
    ]);
    expect(snapshot.pendingWork.every(({ committable }) => committable)).toBe(
      true,
    );
    expect(
      snapshot.pendingWork.every(({ status }) => status === "queued"),
    ).toBe(true);
    expect(snapshot.invariantResults).toHaveLength(5);
    expect(snapshot.invariantResults.every(({ passed }) => !passed)).toBe(true);
  });

  it("does not commit a material effect after STOP", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    await runtime.injectStop();
    const events = runtime.inspectRuntime().events;
    const stopIndex = events.find(
      (event) => event.type === "STOP_INJECTED",
    )!.eventIndex;

    expect(
      events.filter(
        (event) =>
          event.eventIndex > stopIndex &&
          event.payload.material === true &&
          event.type.endsWith("COMMITTED"),
      ),
    ).toEqual([]);
  });
});
