import type {
  SimulationCommand,
  SimulationPolicy,
} from "@/lib/domain/commands";
import type { AuthorityEvent } from "@/lib/domain/events";

export interface ScenarioDriver {
  readonly policy: SimulationPolicy;
  startRun(): AuthorityEvent;
  advanceToReady(boundaryEventIndex?: number): readonly AuthorityEvent[];
  injectStop(): readonly AuthorityEvent[];
  advanceClock(deltaMs: number): readonly AuthorityEvent[];
}

export function handleCommand(
  scenario: ScenarioDriver,
  command: SimulationCommand,
): readonly AuthorityEvent[] {
  if (command.type === "START_RUN") {
    if (command.policy !== scenario.policy) {
      throw new Error(
        "Command policy does not match the fresh runtime policy.",
      );
    }
    return [scenario.startRun()];
  }
  if (command.type === "ADVANCE_TO_READY") {
    return scenario.advanceToReady();
  }
  if (command.type === "INJECT_STOP") {
    return scenario.injectStop();
  }
  return scenario.advanceClock(command.deltaMs);
}
