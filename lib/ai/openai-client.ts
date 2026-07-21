import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ModelOutputRejectedError } from "@/lib/ai/errors";
import {
  QUIESCE_MODEL_ID,
  type StructuredModelClient,
  type StructuredModelRequest,
} from "@/lib/ai/structured-client";

/**
 * Server-side factory for the official OpenAI SDK using the Responses API.
 * Returns null when OPENAI_API_KEY is absent so callers take the deterministic
 * fallback or graceful unavailable path. Never runs in the browser.
 */
export function getServerModelClient(): StructuredModelClient | null {
  if (typeof window !== "undefined") {
    throw new Error("The model client is server-side only.");
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const openai = new OpenAI({ apiKey });
  return {
    async createStructured<T>({
      schema,
      schemaName,
      instructions,
      input,
    }: StructuredModelRequest<T>): Promise<T> {
      const response = await openai.responses.parse({
        model: QUIESCE_MODEL_ID,
        instructions,
        input,
        text: {
          format: zodTextFormat(schema, schemaName),
        },
      });
      const parsed: unknown = response.output_parsed;
      if (parsed === null || parsed === undefined) {
        throw new ModelOutputRejectedError(
          "The model returned no parseable structured output.",
        );
      }
      const revalidated = schema.safeParse(parsed);
      if (!revalidated.success) {
        throw new ModelOutputRejectedError(
          `Model output failed schema validation: ${revalidated.error.message}`,
        );
      }
      return revalidated.data;
    },
  };
}
