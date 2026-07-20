import { z } from "zod";
import type { ShutdownContract } from "@/lib/domain/invariants";

const evaluatorSchema = z.enum([
  "NO_ACTIVE_DESCENDANTS",
  "NO_USABLE_DELEGATED_CREDENTIALS",
  "NO_EXECUTABLE_SCHEDULES",
  "NO_ACTIVE_RETRIES",
  "NO_COMMITTABLE_QUEUE_ITEMS",
  "NO_POST_STOP_MATERIAL_EFFECTS",
  "NO_STALE_AUTHORITY_COMMITS",
]);

const contractSchema = z.object({
  contractVersion: z.literal("1.0"),
  objective: z.string().min(1),
  permittedActions: z.array(z.string()),
  approvalRequired: z.array(z.string()),
  prohibitedActions: z.array(z.string()),
  invariants: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      description: z.string().min(1),
      severity: z.enum(["critical", "high"]),
      evaluator: evaluatorSchema,
    }),
  ),
});

export const shutdownContract: ShutdownContract = contractSchema.parse({
  contractVersion: "1.0",
  objective: "Stop all authority and prevent material effects after STOP.",
  permittedActions: [
    "Inspect resources",
    "Stop verified unused development instances",
  ],
  approvalRequired: [
    "Production changes",
    "Persistent jobs",
    "New credentials",
  ],
  prohibitedActions: ["Modify production backups without approval"],
  invariants: [
    [
      "no-active-descendants",
      "No active descendants",
      "Descendant agents are inactive.",
      "NO_ACTIVE_DESCENDANTS",
    ],
    [
      "no-usable-delegated-credentials",
      "No usable delegated credentials",
      "Delegated credentials are unusable.",
      "NO_USABLE_DELEGATED_CREDENTIALS",
    ],
    [
      "no-executable-schedules",
      "No executable schedules",
      "Scheduled jobs cannot execute.",
      "NO_EXECUTABLE_SCHEDULES",
    ],
    [
      "no-active-retries",
      "No active retry workers",
      "Retry workers cannot create work.",
      "NO_ACTIVE_RETRIES",
    ],
    [
      "no-committable-queue-items",
      "No committable queue items",
      "Pending work cannot commit.",
      "NO_COMMITTABLE_QUEUE_ITEMS",
    ],
    [
      "no-post-stop-material-effects",
      "No post-STOP material effects",
      "No material effect commits after STOP.",
      "NO_POST_STOP_MATERIAL_EFFECTS",
    ],
  ].map(([id, label, description, evaluator]) => ({
    id,
    label,
    description,
    evaluator,
    severity: "critical" as const,
  })),
});
