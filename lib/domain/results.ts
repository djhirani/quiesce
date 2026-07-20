export interface InvariantResult {
  readonly invariantId: string;
  readonly label?: string;
  readonly passed: boolean;
  readonly evidenceEventIds: readonly string[];
}

/** Shape reserved for the later verifier milestone. M1 never constructs one. */
export interface QuiescenceResult {
  readonly verdict: "PASS" | "FAIL";
  readonly stopEventId: string;
  readonly residualAuthorityIds: readonly string[];
  readonly pendingWorkIds: readonly string[];
  readonly escapedEffectIds: readonly string[];
  readonly timeToQuiescenceMs: number | null;
  readonly invariantResults: readonly InvariantResult[];
  readonly earliestUnsafeBoundaryEventId: string | null;
}
