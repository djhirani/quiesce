import type { SimulationCommand } from "@/lib/domain/commands";
import type { AuthorityEvent } from "@/lib/domain/events";
import { CloudCleanupScenario } from "./scenario";

export function handleCommand(
  scenario: CloudCleanupScenario,
  command: SimulationCommand,
): readonly AuthorityEvent[] {
  if (command.type === "START_RUN") {
    if (command.policy !== "vulnerable") {
      throw new Error("Protected policy is not available in M1.");
    }
    return [scenario.startRun()];
  }
  return scenario.advanceToReady();
}
