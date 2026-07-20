export type SimulationPolicy = "vulnerable" | "protected";

export type SimulationCommand =
  | { readonly type: "START_RUN"; readonly policy: SimulationPolicy }
  | { readonly type: "ADVANCE_TO_READY" };

export type SimulationPhase = "idle" | "building_authority" | "ready_to_stop";

export type NextLegalCommand = SimulationCommand["type"] | null;
