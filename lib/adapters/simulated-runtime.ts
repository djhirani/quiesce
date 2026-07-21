import type {
  AgentRuntimeAdapter,
  RuntimeSnapshot,
} from "@/lib/adapters/runtime-adapter";
import { AppendOnlyEventStore } from "@/lib/engine/event-store";
import {
  handleCommand,
  type ScenarioDriver,
} from "@/lib/engine/command-handler";
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
import { ScriptedScenario } from "@/lib/engine/scripted-scenario";
import { verifyQuiescence } from "@/lib/engine/verifier";
import {
  CLOUD_CLEANUP_RUN_ID,
  CLOUD_CLEANUP_SEED,
} from "@/lib/fixtures/cloud-cleanup";
import {
  getScriptedDefinition,
  type ScenarioKey,
} from "@/lib/fixtures/incident-scenarios";

const CLOUD_READY_BOUNDARY = 11;

export class SimulatedRuntimeAdapter implements AgentRuntimeAdapter {
  readonly #policy;
  readonly #scenarioKey: ScenarioKey;
  readonly #runId: string;
  readonly #scenarioSeed: string;
  readonly #readyBoundary: number;
  readonly #store: AppendOnlyEventStore;
  readonly #clock = new LogicalClock();
  readonly #scenario: ScenarioDriver;

  constructor(
    policy: "vulnerable" | "protected" = "vulnerable",
    scenarioKey: ScenarioKey = "cloud-cleanup",
  ) {
    this.#policy = policy;
    this.#scenarioKey = scenarioKey;
    if (scenarioKey === "cloud-cleanup") {
      this.#runId = CLOUD_CLEANUP_RUN_ID;
      this.#scenarioSeed = CLOUD_CLEANUP_SEED;
      this.#readyBoundary = CLOUD_READY_BOUNDARY;
      this.#store = new AppendOnlyEventStore(this.#runId, this.#scenarioSeed);
      this.#scenario = new CloudCleanupScenario(
        this.#store,
        this.#clock,
        policy,
      );
    } else {
      const definition = getScriptedDefinition(scenarioKey);
      this.#runId = definition.runId;
      this.#scenarioSeed = definition.scenarioSeed;
      this.#readyBoundary = definition.build.length;
      this.#store = new AppendOnlyEventStore(this.#runId, this.#scenarioSeed);
      this.#scenario = new ScriptedScenario(
        this.#store,
        this.#clock,
        policy,
        definition,
      );
    }
  }

  get scenarioKey(): ScenarioKey {
    return this.#scenarioKey;
  }

  async startScenario(boundaryEventIndex = this.#readyBoundary): Promise<void> {
    handleCommand(this.#scenario, {
      type: "START_RUN",
      policy: this.#policy,
    });
    if (boundaryEventIndex === this.#readyBoundary) {
      handleCommand(this.#scenario, { type: "ADVANCE_TO_READY" });
    } else {
      this.#scenario.advanceToReady(boundaryEventIndex);
    }
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
      runId: events.length > 0 ? this.#runId : null,
      policy: this.#policy,
      scenarioSeed: this.#scenarioSeed,
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
