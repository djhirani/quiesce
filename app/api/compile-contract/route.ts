import { compileShutdownContract } from "@/lib/ai/contract-compiler";
import { readLimitedJson } from "@/lib/ai/http";
import { getServerModelClient } from "@/lib/ai/openai-client";
import { contractCompileInputSchema } from "@/lib/ai/schemas";

export async function POST(request: Request): Promise<Response> {
  const body = await readLimitedJson(request);
  if (!body.ok) {
    return Response.json({ error: body.message }, { status: body.status });
  }
  const parsed = contractCompileInputSchema.safeParse(body.value);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid contract compile input." },
      { status: 422 },
    );
  }
  const outcome = await compileShutdownContract(
    parsed.data,
    getServerModelClient(),
  );
  return Response.json(outcome);
}
