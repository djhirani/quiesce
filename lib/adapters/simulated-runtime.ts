import type {
  AgentRuntimeAdapter,
  RuntimeSnapshot,
} from "@/lib/adapters/runtime-adapter";
import { AppendOnlyEventStore } from "@/lib/engine/event-store";
import { handleCommand } from "@/lib/engine/command-handler";
import { LogicalClock } from "@/lib/engine/logical-clock";
import {
  projectEntities,
  projectGraph,
  projectNextLegalCommand,
  projectPhase,
  projectStatuses,
} from "@/lib/engine/projectors";
import { CloudCleanupScenario } from "@/lib/engine/scenario";
import {
  CLOUD_CLEANUP_RUN_ID,
  CLOUD_CLEANUP_SEED,
} from "@/lib/fixtures/cloud-cleanup";

export class SimulatedRuntimeAdapter implements AgentRuntimeAdapter {
  readonly #store = new AppendOnlyEventStore(
    CLOUD_CLEANUP_RUN_ID,
    CLOUD_CLEANUP_SEED,
  );
  readonly #clock = new LogicalClock();
  readonly #scenario = new CloudCleanupScenario(this.#store, this.#clock);

  async startScenario(): Promise<void> {
    handleCommand(this.#scenario, {
      type: "START_RUN",
      policy: "vulnerable",
    });
    handleCommand(this.#scenario, { type: "ADVANCE_TO_READY" });
  }

  async injectStop(): Promise<void> {
    throw new Error("STOP is not implemented in M1.");
  }

  async advanceLogicalTime(deltaMs: number): Promise<void> {
    void deltaMs;
    throw new Error("Logical-time advancement is not implemented in M1.");
  }

  inspectRuntime(): RuntimeSnapshot {
    const events = this.#store.history();
    const graph = projectGraph(events);
    return Object.freeze({
      runId: events.length > 0 ? CLOUD_CLEANUP_RUN_ID : null,
      scenarioSeed: CLOUD_CLEANUP_SEED,
      logicalTimeMs: this.#clock.now(),
      phase: projectPhase(events),
      nextLegalCommand: projectNextLegalCommand(events),
      events,
      entities: projectEntities(events),
      edges: graph.edges,
      statuses: projectStatuses(events),
    });
  }
}
