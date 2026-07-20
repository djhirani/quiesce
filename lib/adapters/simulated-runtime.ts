import type {
  AgentRuntimeAdapter,
  RuntimeSnapshot,
} from "@/lib/adapters/runtime-adapter";
import { AppendOnlyEventStore } from "@/lib/engine/event-store";
import { handleCommand } from "@/lib/engine/command-handler";
import { LogicalClock } from "@/lib/engine/logical-clock";
import {
  projectEntities,
  projectEscapedEffects,
  projectGraph,
  projectNextLegalCommand,
  projectPendingWork,
  projectPhase,
  projectResidualAuthorities,
  projectShutdownInvariants,
  projectStatuses,
} from "@/lib/engine/projectors";
import { CloudCleanupScenario } from "@/lib/engine/scenario";
import { verifyQuiescence } from "@/lib/engine/verifier";
import {
  CLOUD_CLEANUP_RUN_ID,
  CLOUD_CLEANUP_SEED,
} from "@/lib/fixtures/cloud-cleanup";

export class SimulatedRuntimeAdapter implements AgentRuntimeAdapter {
  readonly #policy;
  readonly #store = new AppendOnlyEventStore(
    CLOUD_CLEANUP_RUN_ID,
    CLOUD_CLEANUP_SEED,
  );
  readonly #clock = new LogicalClock();
  readonly #scenario;

  constructor(policy: "vulnerable" | "protected" = "vulnerable") {
    this.#policy = policy;
    this.#scenario = new CloudCleanupScenario(this.#store, this.#clock, policy);
  }

  async startScenario(): Promise<void> {
    handleCommand(this.#scenario, {
      type: "START_RUN",
      policy: this.#policy,
    });
    handleCommand(this.#scenario, { type: "ADVANCE_TO_READY" });
  }

  async injectStop(): Promise<void> {
    handleCommand(this.#scenario, { type: "INJECT_STOP" });
  }

  async advanceLogicalTime(deltaMs: number): Promise<void> {
    handleCommand(this.#scenario, { type: "ADVANCE_CLOCK", deltaMs });
  }

  inspectRuntime(): RuntimeSnapshot {
    const events = this.#store.history();
    const graph = projectGraph(events);
    const result = verifyQuiescence(events);
    return Object.freeze({
      runId: events.length > 0 ? CLOUD_CLEANUP_RUN_ID : null,
      policy: this.#policy,
      scenarioSeed: CLOUD_CLEANUP_SEED,
      logicalTimeMs: this.#clock.now(),
      phase: projectPhase(events),
      nextLegalCommand: projectNextLegalCommand(events),
      events,
      entities: projectEntities(events),
      edges: graph.edges,
      statuses: projectStatuses(events),
      residualAuthorities: projectResidualAuthorities(events),
      pendingWork: projectPendingWork(events),
      invariantResults:
        result?.invariantResults ?? projectShutdownInvariants(events),
      escapedEffects: projectEscapedEffects(events),
      result,
    });
  }
}
