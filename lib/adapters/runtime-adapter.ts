import type {
  NextLegalCommand,
  SimulationPhase,
  SimulationPolicy,
} from "@/lib/domain/commands";
import type { AuthorityEdge, AuthorityEntity } from "@/lib/domain/entities";
import type { AuthorityEvent } from "@/lib/domain/events";
import type { InvariantResult, QuiescenceResult } from "@/lib/domain/results";

export interface RuntimeSnapshot {
  readonly runId: string | null;
  readonly policy: SimulationPolicy;
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
  readonly escapedEffects: readonly AuthorityEntity[];
  readonly result: QuiescenceResult | null;
}

export interface AgentRuntimeAdapter {
  startScenario(): Promise<void>;
  injectStop(): Promise<void>;
  advanceLogicalTime(deltaMs: number): Promise<void>;
  inspectRuntime(): RuntimeSnapshot;
}
