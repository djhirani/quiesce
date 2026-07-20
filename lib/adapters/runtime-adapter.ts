import type { NextLegalCommand, SimulationPhase } from "@/lib/domain/commands";
import type { AuthorityEdge, AuthorityEntity } from "@/lib/domain/entities";
import type { AuthorityEvent } from "@/lib/domain/events";
import type { InvariantResult } from "@/lib/domain/results";

export interface RuntimeSnapshot {
  readonly runId: string | null;
  readonly scenarioSeed: string;
  readonly logicalTimeMs: number;
  readonly phase: SimulationPhase;
  readonly nextLegalCommand: NextLegalCommand;
  readonly events: readonly AuthorityEvent[];
  readonly entities: readonly AuthorityEntity[];
  readonly edges: readonly AuthorityEdge[];
  readonly statuses: Readonly<Record<string, AuthorityEntity["status"]>>;
  readonly residualAuthorities: readonly AuthorityEntity[];
  readonly pendingWork: readonly AuthorityEntity[];
  readonly invariantResults: readonly InvariantResult[];
}

export interface AgentRuntimeAdapter {
  startScenario(): Promise<void>;
  injectStop(): Promise<void>;
  advanceLogicalTime(deltaMs: number): Promise<void>;
  inspectRuntime(): RuntimeSnapshot;
}
