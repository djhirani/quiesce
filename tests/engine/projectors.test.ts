import { describe, expect, it } from "vitest";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import { entityIds } from "@/lib/fixtures/cloud-cleanup";

describe("event projectors", () => {
  it("derives the exact entity and authority graph shape from events", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    const snapshot = runtime.inspectRuntime();

    expect(snapshot.entities.map((entity) => entity.id)).toEqual([
      entityIds.human,
      entityIds.root,
      entityIds.safeEffectOne,
      entityIds.safeEffectTwo,
      entityIds.child,
      entityIds.credential,
      entityIds.job,
      entityIds.retry,
      entityIds.developmentQueue,
      entityIds.backupQueue,
    ]);
    expect(
      snapshot.edges.map(
        ({ sourceId, relationship, targetId }) =>
          `${sourceId} --${relationship}--> ${targetId}`,
      ),
    ).toEqual([
      `${entityIds.human} --owns--> ${entityIds.root}`,
      `${entityIds.root} --commits--> ${entityIds.safeEffectOne}`,
      `${entityIds.root} --commits--> ${entityIds.safeEffectTwo}`,
      `${entityIds.root} --spawned--> ${entityIds.child}`,
      `${entityIds.root} --granted--> ${entityIds.credential}`,
      `${entityIds.child} --schedules--> ${entityIds.job}`,
      `${entityIds.job} --retries--> ${entityIds.retry}`,
      `${entityIds.job} --enqueues--> ${entityIds.developmentQueue}`,
      `${entityIds.credential} --authorizes--> ${entityIds.developmentQueue}`,
      `${entityIds.retry} --enqueues--> ${entityIds.backupQueue}`,
      `${entityIds.credential} --authorizes--> ${entityIds.backupQueue}`,
    ]);
    expect(snapshot.statuses[entityIds.root]).toBe("active");
    expect(snapshot.statuses[entityIds.credential]).toBe("valid");
    expect(snapshot.statuses[entityIds.job]).toBe("armed");
    expect(snapshot.statuses[entityIds.backupQueue]).toBe("queued");
  });

  it("contains valid caused-by references forming one deterministic chain", async () => {
    const runtime = new SimulatedRuntimeAdapter();
    await runtime.startScenario();
    const events = runtime.inspectRuntime().events;
    const ids = new Set(events.map((event) => event.eventId));

    expect(events[0]?.causedByEventId).toBeNull();
    for (const [index, event] of events.entries()) {
      if (index === 0) continue;
      expect(ids.has(event.causedByEventId ?? "")).toBe(true);
      expect(event.causedByEventId).toBe(events[index - 1]?.eventId);
    }
  });
});
