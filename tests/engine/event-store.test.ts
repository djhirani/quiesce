import { describe, expect, it } from "vitest";
import { AppendOnlyEventStore } from "@/lib/engine/event-store";

function input(logicalTimeMs: number, causedByEventId: string | null = null) {
  return {
    logicalTimeMs,
    type: "RUN_STARTED" as const,
    actorId: "human-operator-01",
    subjectId: "agent-cleanup-root-01",
    parentSubjectId: "human-operator-01",
    causedByEventId,
    authorityEpoch: 1,
    issuedAuthorityEpoch: null,
    payload: { marker: logicalTimeMs },
  };
}

describe("AppendOnlyEventStore", () => {
  it("assigns monotonic indexes and deterministic unique display IDs", () => {
    const store = new AppendOnlyEventStore("run-01", "seed-01");
    const first = store.append(input(0));
    store.append(input(40, first.eventId));

    expect(
      store
        .history()
        .map(({ eventIndex, eventId }) => ({ eventIndex, eventId })),
    ).toEqual([
      { eventIndex: 1, eventId: "E-001" },
      { eventIndex: 2, eventId: "E-002" },
    ]);
    expect(new Set(store.history().map((event) => event.eventId))).toHaveLength(
      2,
    );
  });

  it("returns frozen history and deeply immutable events", () => {
    const store = new AppendOnlyEventStore("run-01", "seed-01");
    store.append(input(0));
    const history = store.history();

    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history[0])).toBe(true);
    expect(Object.isFrozen(history[0]?.payload)).toBe(true);
    expect(() => {
      (history as unknown as unknown[]).push("mutation");
    }).toThrow();
    expect(store.history()).toHaveLength(1);
  });

  it("rejects caused-by references outside the current history", () => {
    const store = new AppendOnlyEventStore("run-01", "seed-01");
    expect(() => store.append(input(40, "E-999"))).toThrow(
      "Unknown caused-by event: E-999",
    );
  });
});
