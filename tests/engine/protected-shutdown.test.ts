import { describe, expect, it } from "vitest";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import { evaluateCommitFence } from "@/lib/engine/commit-fence";
import {
  CLOUD_CLEANUP_AUTHORITY_EPOCH,
  entityIds,
} from "@/lib/fixtures/cloud-cleanup";

const protectedStopTypes = [
  "STOP_INJECTED",
  "AUTHORITY_EPOCH_ADVANCED",
  "COMMIT_GATE_SEALED",
  "QUEUE_ITEM_CANCELLED",
  "QUEUE_ITEM_CANCELLED",
  "JOB_CANCELLED",
  "RETRY_DISABLED",
  "CREDENTIAL_REVOKED",
  "AGENT_TERMINATED",
  "AGENT_TERMINATED",
  "QUIESCENCE_REACHED",
] as const;

async function ready(policy: "vulnerable" | "protected") {
  const runtime = new SimulatedRuntimeAdapter(policy);
  await runtime.startScenario();
  return runtime;
}

describe("M4 protected shutdown", () => {
  it("uses one canonical epoch-aware pre-STOP fixture for both policies", async () => {
    const vulnerable = await ready("vulnerable");
    const protectedRuntime = await ready("protected");
    const vulnerableEvents = vulnerable.inspectRuntime().events;
    const protectedEvents = protectedRuntime.inspectRuntime().events;

    expect(protectedEvents).toEqual(vulnerableEvents);
    expect(
      protectedEvents.every(
        (event) => event.authorityEpoch === CLOUD_CLEANUP_AUTHORITY_EPOCH,
      ),
    ).toBe(true);
    expect(
      protectedEvents
        .filter((event) => event.payload.material === true)
        .every(
          (event) =>
            event.issuedAuthorityEpoch === CLOUD_CLEANUP_AUTHORITY_EPOCH,
        ),
    ).toBe(true);
  });

  it("appends the exact protected STOP order and reaches quiescence at 420 ms", async () => {
    const runtime = await ready("protected");
    await runtime.injectStop();
    const events = runtime.inspectRuntime().events;
    const protectedEvents = events.slice(11);

    expect(protectedEvents.map(({ type }) => type)).toEqual(protectedStopTypes);
    expect(
      protectedEvents.map(({ eventId, logicalTimeMs }) => ({
        eventId,
        logicalTimeMs,
      })),
    ).toEqual([
      { eventId: "E-012", logicalTimeMs: 440 },
      { eventId: "E-013", logicalTimeMs: 480 },
      { eventId: "E-014", logicalTimeMs: 520 },
      { eventId: "E-015", logicalTimeMs: 560 },
      { eventId: "E-016", logicalTimeMs: 600 },
      { eventId: "E-017", logicalTimeMs: 640 },
      { eventId: "E-018", logicalTimeMs: 680 },
      { eventId: "E-019", logicalTimeMs: 720 },
      { eventId: "E-020", logicalTimeMs: 760 },
      { eventId: "E-021", logicalTimeMs: 800 },
      { eventId: "E-022", logicalTimeMs: 860 },
    ]);
    expect(events[13]?.type).toBe("COMMIT_GATE_SEALED");
    expect(
      events.findIndex((event) => event.type === "COMMIT_GATE_SEALED"),
    ).toBeLessThan(
      events.findIndex((event) => event.type === "CREDENTIAL_REVOKED"),
    );
    expect(runtime.inspectRuntime().residualAuthorities).toEqual([]);
    expect(runtime.inspectRuntime().pendingWork).toEqual([]);
  });

  it("rejects the same delayed operation as stale without committing it", async () => {
    const runtime = await ready("protected");
    await runtime.injectStop();
    await runtime.advanceLogicalTime(300_000);
    const snapshot = runtime.inspectRuntime();
    expect(snapshot.events.slice(-4).map(({ type }) => type)).toEqual([
      "CLOCK_ADVANCED",
      "EFFECT_ATTEMPTED",
      "STALE_AUTHORITY_REJECTED",
      "EFFECT_REJECTED",
    ]);
    expect(
      snapshot.events.slice(-4).map(({ logicalTimeMs }) => logicalTimeMs),
    ).toEqual([300_860, 300_900, 300_940, 300_980]);
    expect(
      snapshot.events.some(({ type }) => type === "EFFECT_COMMITTED"),
    ).toBe(false);
    expect(snapshot.statuses[entityIds.backupEffect]).toBe("rejected");
    expect(
      snapshot.events.slice(-3).map(({ authorityEpoch }) => authorityEpoch),
    ).toEqual([8, 8, 8]);
    expect(
      snapshot.events
        .slice(-3)
        .map(({ issuedAuthorityEpoch }) => issuedAuthorityEpoch),
    ).toEqual([7, 7, 7]);
    expect(
      evaluateCommitFence(snapshot.events, CLOUD_CLEANUP_AUTHORITY_EPOCH),
    ).toMatchObject({
      issuedAuthorityEpoch: 7,
      minimumValidAuthorityEpoch: 8,
      currentAuthorityEpoch: 8,
      credentialStatus: "revoked",
      commitGateStatus: "sealed",
      mayCommit: false,
      rejectionReason: "stale_authority",
    });
    expect(snapshot.result).toMatchObject({
      verdict: "PASS",
      residualAuthorityIds: [],
      pendingWorkIds: [],
      escapedEffectIds: [],
      timeToQuiescenceMs: 420,
    });
    expect(
      snapshot.result?.invariantResults.every(({ passed }) => passed),
    ).toBe(true);
  });

  it("commits in vulnerable mode and rejects in protected mode", async () => {
    const vulnerable = await ready("vulnerable");
    await vulnerable.injectStop();
    await vulnerable.advanceLogicalTime(300_000);
    const protectedRuntime = await ready("protected");
    await protectedRuntime.injectStop();
    await protectedRuntime.advanceLogicalTime(300_000);

    const vulnerableEffect = vulnerable
      .inspectRuntime()
      .events.find((event) => event.type === "EFFECT_COMMITTED");
    const protectedEffect = protectedRuntime
      .inspectRuntime()
      .events.find((event) => event.type === "EFFECT_REJECTED");
    expect(vulnerableEffect?.payload.targetId).toBe(
      "production-backup-archive-01",
    );
    expect(protectedEffect?.payload.targetId).toBe(
      vulnerableEffect?.payload.targetId,
    );
  });
});
