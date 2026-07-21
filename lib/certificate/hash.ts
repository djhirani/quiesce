/**
 * SHA-256 over UTF-8 text via Web Crypto, available in both modern browsers
 * and Node without additional dependencies.
 */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Prefixed(text: string): Promise<string> {
  return `sha256:${await sha256Hex(text)}`;
}
