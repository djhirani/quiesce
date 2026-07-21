import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import type { SimulationPolicy } from "@/lib/domain/commands";
import {
  SCENARIO_KEYS,
  getScenarioDescriptor,
  type ScenarioKey,
} from "@/lib/fixtures/incident-scenarios";

export interface SuiteRow {
  readonly scenario: ScenarioKey;
  readonly scenarioLabel: string;
  readonly policy: SimulationPolicy;
  readonly verdict: "PASS" | "FAIL";
  readonly residualAuthorities: number;
  readonly pendingWork: number;
  readonly escapedEffects: number;
  readonly timeToQuiescenceMs: number | null;
  readonly eventCount: number;
  readonly snapshot: RuntimeSnapshot;
}

/**
 * Runs every scenario under both policies through the deterministic engine.
 * Every value in a row is copied from the verifier result and the event log —
 * nothing is computed in the UI and no model is involved.
 */
export async function runFullTestSuite(): Promise<readonly SuiteRow[]> {
  const rows: SuiteRow[] = [];
  for (const scenario of SCENARIO_KEYS) {
    for (const policy of ["vulnerable", "protected"] as const) {
      const runtime = new SimulatedRuntimeAdapter(policy, scenario);
      await runtime.startScenario();
      await runtime.injectStop();
      await runtime.advanceLogicalTime(300_000);
      const snapshot = runtime.inspectRuntime();
      if (!snapshot.result) {
        throw new Error(
          `Suite run for ${scenario}/${policy} did not complete.`,
        );
      }
      rows.push({
        scenario,
        scenarioLabel: getScenarioDescriptor(scenario).label,
        policy,
        verdict: snapshot.result.verdict,
        residualAuthorities: snapshot.result.residualAuthorityIds.length,
        pendingWork: snapshot.result.pendingWorkIds.length,
        escapedEffects: snapshot.result.escapedEffectIds.length,
        timeToQuiescenceMs: snapshot.result.timeToQuiescenceMs,
        eventCount: snapshot.events.length,
        snapshot,
      });
    }
  }
  return Object.freeze(rows);
}
