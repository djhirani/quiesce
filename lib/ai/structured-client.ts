import type { ZodType } from "zod";

export const QUIESCE_MODEL_ID = "gpt-5.6";

export interface StructuredModelRequest<T> {
  readonly schema: ZodType<T>;
  readonly schemaName: string;
  readonly instructions: string;
  readonly input: string;
}

export interface StructuredModelClient {
  createStructured<T>(request: StructuredModelRequest<T>): Promise<T>;
}
