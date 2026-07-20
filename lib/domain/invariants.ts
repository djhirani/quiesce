export interface ShutdownInvariant {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly severity: "critical" | "high";
  readonly evaluator:
    | "NO_ACTIVE_DESCENDANTS"
    | "NO_USABLE_DELEGATED_CREDENTIALS"
    | "NO_EXECUTABLE_SCHEDULES"
    | "NO_ACTIVE_RETRIES"
    | "NO_COMMITTABLE_QUEUE_ITEMS"
    | "NO_POST_STOP_MATERIAL_EFFECTS"
    | "NO_STALE_AUTHORITY_COMMITS";
}

export interface ShutdownContract {
  readonly contractVersion: "1.0";
  readonly objective: string;
  readonly permittedActions: readonly string[];
  readonly approvalRequired: readonly string[];
  readonly prohibitedActions: readonly string[];
  readonly invariants: readonly ShutdownInvariant[];
}
