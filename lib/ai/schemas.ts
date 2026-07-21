import { z } from "zod";

const eventIdList = z.array(z.string().min(1)).min(1);

export const incidentExplanationSchema = z.strictObject({
  headline: z.string().min(1),
  summary: z.string().min(1),
  decisiveFailure: z.strictObject({
    eventIds: eventIdList,
    explanation: z.string().min(1),
  }),
  survivors: z.array(
    z.strictObject({
      entityId: z.string().min(1),
      eventIds: eventIdList,
      explanation: z.string().min(1),
    }),
  ),
  escapedEffects: z.array(
    z.strictObject({
      effectId: z.string().min(1),
      eventIds: eventIdList,
      explanation: z.string().min(1),
    }),
  ),
  earliestUnsafeBoundary: z.strictObject({
    eventId: z.string().min(1),
    explanation: z.string().min(1),
  }),
  recommendedControl: z.strictObject({
    eventId: z.string().min(1),
    action: z.string().min(1),
  }),
});

export type IncidentExplanation = z.infer<typeof incidentExplanationSchema>;

const boundedLine = z.string().min(1).max(400);

export const contractCompileInputSchema = z.strictObject({
  task: z.string().min(1).max(2000),
  tools: z.array(boundedLine).max(32),
  approvalBoundaries: z.array(boundedLine).max(32),
  persistenceCapabilities: z.array(boundedLine).max(32),
  delegationCapabilities: z.array(boundedLine).max(32),
});

export type ContractCompileInput = z.infer<typeof contractCompileInputSchema>;

export const explainIncidentRequestSchema = z.strictObject({
  policy: z.enum(["vulnerable", "protected"]),
});

export type ExplainIncidentRequest = z.infer<
  typeof explainIncidentRequestSchema
>;
