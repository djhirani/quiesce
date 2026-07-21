import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import type { AuthorityEventType } from "./events";

export type SweepClassification = "PASS" | "FAIL" | "BREACH";

export interface SweepPointResult {
  readonly boundaryEventId: string;
  readonly boundaryEventType: AuthorityEventType;
  readonly boundaryEventIndex: number;
  readonly policy: "vulnerable" | "protected";
  readonly classification: SweepClassification;
  readonly snapshot: RuntimeSnapshot;
}

export interface QuiescenceSweepResult {
  readonly injectionPoints: readonly SweepPointResult[];
  readonly protectedPoints: readonly SweepPointResult[];
  readonly earliestUnsafeBoundary: SweepPointResult | null;
  readonly worstBreachBoundary: SweepPointResult | null;
}
