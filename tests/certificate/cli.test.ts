// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { completedBundle } from "./helpers";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "..", "..");
const tsxBin = join(repoRoot, "node_modules", ".bin", "tsx");
const cliScript = join(repoRoot, "scripts", "verify-certificate.ts");

async function runCli(
  certificatePath: string,
  tracePath: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      tsxBin,
      [cliScript, certificatePath, tracePath],
      { cwd: repoRoot },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: failure.code ?? 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

describe("verify:certificate CLI", () => {
  it("returns 0 for valid evidence and non-zero for tampered evidence", async () => {
    const bundle = await completedBundle("vulnerable");
    const dir = await mkdtemp(join(tmpdir(), "quiesce-cert-cli-"));
    const certificatePath = join(dir, "certificate.json");
    const tracePath = join(dir, "trace.jsonl");
    const tamperedPath = join(dir, "trace-tampered.jsonl");
    await writeFile(certificatePath, bundle.envelopeJson);
    await writeFile(tracePath, bundle.traceJsonl);
    await writeFile(
      tamperedPath,
      bundle.traceJsonl.replace(
        '"actor_id":"human-operator-01"',
        '"actor_id":"human-operator-99"',
      ),
    );

    const valid = await runCli(certificatePath, tracePath);
    expect(valid.code).toBe(0);
    expect(valid.stdout).toContain("VALID");
    expect(valid.stdout).toContain(bundle.certificate.certificateId);

    const tampered = await runCli(certificatePath, tamperedPath);
    expect(tampered.code).toBe(1);
    expect(tampered.stderr).toContain("INVALID");
  }, 60_000);
});
