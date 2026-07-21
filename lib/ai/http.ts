export const MAX_JSON_BODY_BYTES = 32 * 1024;

export type LimitedJsonResult =
  | { readonly ok: true; readonly value: unknown }
  | {
      readonly ok: false;
      readonly status: 400 | 413;
      readonly message: string;
    };

interface BodySource {
  readonly body?: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

/**
 * Reads and parses a JSON request body while enforcing the byte limit against
 * the actual received bytes, not a client-supplied Content-Length header.
 * Streams when possible and stops reading as soon as the limit is exceeded.
 */
export async function readLimitedJson(
  request: BodySource,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<LimitedJsonResult> {
  const overLimit = {
    ok: false,
    status: 413,
    message: `Request body exceeds the ${maxBytes}-byte limit.`,
  } as const;

  let text: string;
  const stream = request.body;
  if (stream && typeof stream.getReader === "function") {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return overLimit;
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    text = new TextDecoder().decode(merged);
  } else {
    text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      return overLimit;
    }
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: 400,
      message: "Request body is not valid JSON.",
    };
  }
}
