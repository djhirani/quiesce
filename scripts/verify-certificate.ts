import { readFile } from "node:fs/promises";
import { verifyCertificateEvidence } from "@/lib/certificate/verify";

async function main(): Promise<number> {
  const [certificatePath, tracePath] = process.argv.slice(2);
  if (!certificatePath || !tracePath) {
    console.error(
      "Usage: npm run verify:certificate -- certificate.json trace.jsonl",
    );
    return 2;
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(await readFile(certificatePath, "utf8"));
  } catch (error) {
    console.error(
      `INVALID · certificate.json could not be read or parsed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return 1;
  }

  let trace: string;
  try {
    trace = await readFile(tracePath, "utf8");
  } catch (error) {
    console.error(
      `INVALID · trace.jsonl could not be read: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return 1;
  }

  const verification = await verifyCertificateEvidence(envelope, trace);
  if (verification.valid) {
    console.log(
      `VALID · ${verification.certificateId} · tamper-evident local test record verified against the supplied trace`,
    );
    return 0;
  }
  console.error(`INVALID · ${verification.reason}`);
  return 1;
}

void main().then((code) => {
  process.exitCode = code;
});
