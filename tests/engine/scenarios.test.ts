// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import { runFullTestSuite } from "@/lib/engine/test-suite";
import {
  RECONSTRUCTION_DISCLOSURE,
  SCENARIO_KEYS,
  scenarioDescriptors,
  type ScenarioKey,
} from "@/lib/fixtures/incident-scenarios";

async function completedRun(
  scenario: ScenarioKey,
  policy: "vulnerable" | "protected",
): Promise<RuntimeSnapshot> {
  const runtime = new SimulatedRuntimeAdapter(policy, scenario);
  await runtime.startScenario();
  await runtime.injectStop();
  await runtime.advanceLogicalTime(300_000);
  return runtime.inspectRuntime();
}

describe("scenario library", () => {
  it("is deterministic for every scenario and policy", async () => {
    for (const scenario of SCENARIO_KEYS) {
      for (const policy of ["vulnerable", "protected"] as const) {
        const first = await completedRun(scenario, policy);
        const second = await completedRun(scenario, policy);
        expect(JSON.stringify(second.events)).toBe(
          JSON.stringify(first.events),
        );
        expect(JSON.stringify(second.result)).toBe(
          JSON.stringify(first.result),
        );
      }
    }
  });

  it("keeps the cloud-cleanup outputs byte-stable", async () => {
    const vulnerable = await completedRun("cloud-cleanup", "vulnerable");
    expect(vulnerable.events.map(({ type }) => type)).toEqual([
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
      "STOP_INJECTED",
      "AGENT_STOPPED",
      "CLOCK_ADVANCED",
      "JOB_TRIGGERED",
      "EFFECT_ATTEMPTED",
      "EFFECT_COMMITTED",
    ]);
    expect(vulnerable.runId).toBe("run-cloud-cleanup-v1-001");
    expect(vulnerable.scenarioSeed).toBe("cloud-cleanup-v1");
    expect(vulnerable.result?.verdict).toBe("FAIL");
    expect(vulnerable.result?.residualAuthorityIds).toHaveLength(4);
    expect(vulnerable.result?.pendingWorkIds).toHaveLength(2);
    expect(vulnerable.result?.escapedEffectIds).toHaveLength(1);
    expect(vulnerable.result?.timeToQuiescenceMs).toBeNull();

    const protectedRun = await completedRun("cloud-cleanup", "protected");
    expect(protectedRun.events).toHaveLength(26);
    expect(protectedRun.result?.verdict).toBe("PASS");
    expect(protectedRun.result?.timeToQuiescenceMs).toBe(420);
  });

  it("proves the nine-second deletion under both policies", async () => {
    const vulnerable = await completedRun("nine-second-deletion", "vulnerable");
    expect(vulnerable.result?.verdict).toBe("FAIL");
    expect(vulnerable.result?.residualAuthorityIds).toEqual([
      "credential-admin-ns-01",
    ]);
    expect(vulnerable.result?.pendingWorkIds).toEqual([
      "queue-corrective-drop-ns-01",
    ]);
    expect(vulnerable.result?.escapedEffectIds).toEqual([
      "effect-production-database-drop-ns-01",
    ]);
    expect(vulnerable.result?.timeToQuiescenceMs).toBeNull();
    expect(vulnerable.events).toHaveLength(10);
    expect(
      vulnerable.events.every(
        (event) =>
          event.payload.material !== true || event.payload.simulated === true,
      ),
    ).toBe(true);

    const protectedRun = await completedRun(
      "nine-second-deletion",
      "protected",
    );
    expect(protectedRun.result?.verdict).toBe("PASS");
    expect(protectedRun.result?.residualAuthorityIds).toHaveLength(0);
    expect(protectedRun.result?.pendingWorkIds).toHaveLength(0);
    expect(protectedRun.result?.escapedEffectIds).toHaveLength(0);
    expect(protectedRun.result?.timeToQuiescenceMs).toBe(260);
    expect(
      protectedRun.events.some(
        (event) => event.type === "STALE_AUTHORITY_REJECTED",
      ),
    ).toBe(true);
    expect(protectedRun.events.at(-1)?.type).toBe("EFFECT_REJECTED");
  });

  it("proves the offboarded token under both policies", async () => {
    const vulnerable = await completedRun("offboarded-token", "vulnerable");
    expect(vulnerable.result?.verdict).toBe("FAIL");
    expect(vulnerable.result?.residualAuthorityIds).toEqual([
      "credential-delegated-token-ot-01",
      "job-nightly-export-ot-01",
    ]);
    expect(vulnerable.result?.pendingWorkIds).toEqual([
      "queue-archive-export-ot-01",
    ]);
    expect(vulnerable.result?.escapedEffectIds).toEqual([
      "effect-archive-export-ot-01",
    ]);
    expect(
      vulnerable.events.some((event) => event.type === "JOB_TRIGGERED"),
    ).toBe(true);

    const protectedRun = await completedRun("offboarded-token", "protected");
    expect(protectedRun.result?.verdict).toBe("PASS");
    expect(
      protectedRun.events.some((event) => event.type === "JOB_CANCELLED"),
    ).toBe(true);
    expect(
      protectedRun.events.some((event) => event.type === "CREDENTIAL_REVOKED"),
    ).toBe(true);
    expect(protectedRun.result?.timeToQuiescenceMs).toBe(300);
  });

  it("labels every reconstruction as simulated with provenance", () => {
    const reconstructions = scenarioDescriptors.filter(
      ({ key }) => key !== "cloud-cleanup",
    );
    expect(reconstructions).toHaveLength(2);
    for (const descriptor of reconstructions) {
      expect(descriptor.disclosure?.line).toBe(RECONSTRUCTION_DISCLOSURE);
      expect(descriptor.disclosure?.line.toLowerCase()).toContain("simulated");
      expect(descriptor.disclosure?.source).toContain("Incident library");
      expect(descriptor.disclosure?.source).toContain(
        "Quiesce did not observe the original incident",
      );
    }
    expect(
      scenarioDescriptors.find(({ key }) => key === "cloud-cleanup")
        ?.disclosure,
    ).toBeUndefined();
  });
});

describe("full test suite", () => {
  it("produces exactly six rows whose metrics equal verifier output", async () => {
    const rows = await runFullTestSuite();
    expect(rows).toHaveLength(6);
    expect(rows.map(({ scenario, policy }) => `${scenario}:${policy}`)).toEqual(
      [
        "cloud-cleanup:vulnerable",
        "cloud-cleanup:protected",
        "nine-second-deletion:vulnerable",
        "nine-second-deletion:protected",
        "offboarded-token:vulnerable",
        "offboarded-token:protected",
      ],
    );
    for (const row of rows) {
      const result = row.snapshot.result;
      expect(result).not.toBeNull();
      expect(row.verdict).toBe(result?.verdict);
      expect(row.residualAuthorities).toBe(result?.residualAuthorityIds.length);
      expect(row.pendingWork).toBe(result?.pendingWorkIds.length);
      expect(row.escapedEffects).toBe(result?.escapedEffectIds.length);
      expect(row.timeToQuiescenceMs).toBe(result?.timeToQuiescenceMs);
      expect(row.eventCount).toBe(row.snapshot.events.length);
      expect(row.verdict).toBe(row.policy === "protected" ? "PASS" : "FAIL");
    }
  });
});
