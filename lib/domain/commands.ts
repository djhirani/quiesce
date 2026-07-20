export type SimulationPolicy = "vulnerable" | "protected";

export type SimulationCommand =
  | { readonly type: "START_RUN"; readonly policy: SimulationPolicy }
  | { readonly type: "ADVANCE_TO_READY" }
  | { readonly type: "INJECT_STOP" }
  | { readonly type: "ADVANCE_CLOCK"; readonly deltaMs: number };

export type SimulationPhase =
  | "idle"
  | "building_authority"
  | "ready_to_stop"
  | "stop_injected"
  | "survivors_evaluated";

export type NextLegalCommand = SimulationCommand["type"] | null;
