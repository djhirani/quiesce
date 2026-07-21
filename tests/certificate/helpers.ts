import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import {
  generateCertificateBundle,
  type CertificateBundle,
} from "@/lib/certificate/certificate";

export async function completedSnapshot(
  policy: "vulnerable" | "protected",
): Promise<RuntimeSnapshot> {
  const runtime = new SimulatedRuntimeAdapter(policy);
  await runtime.startScenario();
  await runtime.injectStop();
  await runtime.advanceLogicalTime(300_000);
  return runtime.inspectRuntime();
}

export async function completedBundle(
  policy: "vulnerable" | "protected",
): Promise<CertificateBundle> {
  return generateCertificateBundle(await completedSnapshot(policy));
}
