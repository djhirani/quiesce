import { readLimitedJson } from "@/lib/ai/http";
import {
  deriveIncidentEvidence,
  narrateIncident,
} from "@/lib/ai/incident-narrator";
import { getServerModelClient } from "@/lib/ai/openai-client";
import { explainIncidentRequestSchema } from "@/lib/ai/schemas";

export async function POST(request: Request): Promise<Response> {
  const body = await readLimitedJson(request);
  if (!body.ok) {
    return Response.json({ error: body.message }, { status: body.status });
  }
  const parsed = explainIncidentRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid explain-incident request." },
      { status: 422 },
    );
  }
  const evidence = await deriveIncidentEvidence(parsed.data.policy);
  const narration = await narrateIncident(evidence, getServerModelClient());
  return Response.json({
    narration,
    structural: {
      verdict: evidence.verdict,
      stopEventId: evidence.result.stopEventId,
      residualAuthorityIds: evidence.result.residualAuthorityIds,
      pendingWorkIds: evidence.result.pendingWorkIds,
      escapedEffectIds: evidence.result.escapedEffectIds,
      timeToQuiescenceMs: evidence.result.timeToQuiescenceMs,
      earliestUnsafeBoundaryEventId:
        evidence.sweep.earliestUnsafeBoundaryEventId,
      allowedEventIds: evidence.allowedEvents.map(({ eventId }) => eventId),
    },
  });
}
