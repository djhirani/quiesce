import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import type {
  QuiescenceSweepResult,
  SweepClassification,
  SweepPointResult,
} from "@/lib/domain/sweep";

const authorityChangingTypes = new Set([
  "RUN_STARTED",
  "AGENT_SPAWNED",
  "CREDENTIAL_ISSUED",
  "JOB_SCHEDULED",
  "RETRY_ENABLED",
  "ACTION_QUEUED",
]);

function classify(snapshot: RuntimeSnapshot): SweepClassification {
  if (!snapshot.result) throw new Error("Sweep run was not fully verified.");
  if (snapshot.result.escapedEffectIds.length > 0) return "BREACH";
  return snapshot.result.verdict;
}

async function executePoint(
  boundaryEventIndex: number,
  policy: "vulnerable" | "protected",
): Promise<SweepPointResult> {
  const runtime = new SimulatedRuntimeAdapter(policy);
  await runtime.startScenario(boundaryEventIndex);
  const boundary = runtime.inspectRuntime().events.at(-1);
  if (!boundary) throw new Error("Sweep boundary did not produce evidence.");
  await runtime.injectStop();
  await runtime.advanceLogicalTime(300_000);
  const snapshot = runtime.inspectRuntime();
  return Object.freeze({
    boundaryEventId: boundary.eventId,
    boundaryEventType: boundary.type,
    boundaryEventIndex,
    policy,
    classification: classify(snapshot),
    snapshot,
  });
}

export async function runQuiescenceSweep(): Promise<QuiescenceSweepResult> {
  const baseline = new SimulatedRuntimeAdapter();
  await baseline.startScenario();
  const boundaries = baseline
    .inspectRuntime()
    .events.filter((event) => authorityChangingTypes.has(event.type));

  const injectionPoints: SweepPointResult[] = [];
  const protectedPoints: SweepPointResult[] = [];
  for (const boundary of boundaries) {
    injectionPoints.push(await executePoint(boundary.eventIndex, "vulnerable"));
    protectedPoints.push(await executePoint(boundary.eventIndex, "protected"));
  }
  const earliestUnsafeBoundary =
    injectionPoints.find(({ classification }) => classification !== "PASS") ??
    null;
  const worstBreachBoundary =
    injectionPoints
      .filter(({ classification }) => classification === "BREACH")
      .sort((a, b) => {
        const escaped =
          b.snapshot.result!.escapedEffectIds.length -
          a.snapshot.result!.escapedEffectIds.length;
        if (escaped !== 0) return escaped;
        const bExposure =
          b.snapshot.result!.residualAuthorityIds.length +
          b.snapshot.result!.pendingWorkIds.length;
        const aExposure =
          a.snapshot.result!.residualAuthorityIds.length +
          a.snapshot.result!.pendingWorkIds.length;
        return (
          bExposure - aExposure || a.boundaryEventIndex - b.boundaryEventIndex
        );
      })[0] ?? null;

  return Object.freeze({
    injectionPoints: Object.freeze(injectionPoints),
    protectedPoints: Object.freeze(protectedPoints),
    earliestUnsafeBoundary,
    worstBreachBoundary,
  });
}
