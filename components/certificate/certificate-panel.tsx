"use client";

import { useEffect, useState } from "react";
import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import {
  generateCertificateBundle,
  type CertificateBundle,
} from "@/lib/certificate/certificate";
import {
  verifyCertificateEvidence,
  type CertificateVerification,
} from "@/lib/certificate/verify";

type BundleState =
  | { readonly phase: "generating" }
  | { readonly phase: "error"; readonly message: string }
  | { readonly phase: "ready"; readonly bundle: CertificateBundle };

type VerificationState =
  | { readonly phase: "idle" }
  | { readonly phase: "checking" }
  | { readonly phase: "done"; readonly result: CertificateVerification };

function download(filename: string, bytes: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CertificatePanel({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const [state, setState] = useState<BundleState>({ phase: "generating" });
  const [viewOpen, setViewOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [verification, setVerification] = useState<VerificationState>({
    phase: "idle",
  });

  useEffect(() => {
    let cancelled = false;
    generateCertificateBundle(snapshot)
      .then((bundle) => {
        if (!cancelled) setState({ phase: "ready", bundle });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            phase: "error",
            message:
              error instanceof Error
                ? error.message
                : "Certificate generation failed.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  async function copyCertificate(bundle: CertificateBundle) {
    try {
      await navigator.clipboard.writeText(bundle.envelopeJson);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2000);
  }

  async function runVerification(bundle: CertificateBundle) {
    setVerification({ phase: "checking" });
    const result = await verifyCertificateEvidence(
      JSON.parse(bundle.envelopeJson),
      bundle.traceJsonl,
    );
    setVerification({ phase: "done", result });
  }

  return (
    <section className="certificate-region" aria-labelledby="certificate-title">
      <div className="region-heading">
        <span className="region-index">08</span>
        <h3 id="certificate-title">Quiescence Certificate</h3>
        <span className="cert-label">Tamper-evident local test record.</span>
      </div>
      <p className="cert-note">
        SHA-256 content binding over the shutdown contract and the append-only
        event trace. Not a legal certificate, not a compliance guarantee, and
        not proof against a party who can regenerate every hash.
      </p>
      {state.phase === "generating" ? (
        <p className="cert-status" role="status">
          Deriving certificate from the completed evidence…
        </p>
      ) : state.phase === "error" ? (
        <p className="cert-status cert-status--invalid" role="alert">
          Certificate unavailable · {state.message}
        </p>
      ) : (
        <div className="cert-body">
          <dl className="cert-summary">
            <div>
              <dt>Certificate</dt>
              <dd>{state.bundle.certificate.certificateId}</dd>
            </div>
            <div>
              <dt>Verdict</dt>
              <dd>{state.bundle.certificate.verdict}</dd>
            </div>
            <div>
              <dt>Trace hash</dt>
              <dd>{state.bundle.certificate.traceHash.slice(0, 23)}…</dd>
            </div>
            <div>
              <dt>Contract hash</dt>
              <dd>{state.bundle.certificate.contractHash.slice(0, 23)}…</dd>
            </div>
          </dl>
          <div className="cert-actions">
            <button
              type="button"
              aria-expanded={viewOpen}
              onClick={() => setViewOpen((open) => !open)}
            >
              View certificate
            </button>
            <button type="button" onClick={() => copyCertificate(state.bundle)}>
              {copyState === "copied"
                ? "Copied"
                : copyState === "failed"
                  ? "Copy failed"
                  : "Copy certificate"}
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  "certificate.json",
                  state.bundle.envelopeJson,
                  "application/json",
                )
              }
            >
              Download certificate.json
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  "trace.jsonl",
                  state.bundle.traceJsonl,
                  "application/x-ndjson",
                )
              }
            >
              Download trace.jsonl
            </button>
            <button type="button" onClick={() => runVerification(state.bundle)}>
              Verify certificate
            </button>
          </div>
          {verification.phase === "checking" ? (
            <p className="cert-status" role="status">
              Recomputing hashes and verifier result…
            </p>
          ) : verification.phase === "done" ? (
            verification.result.valid ? (
              <p className="cert-status cert-status--valid" role="status">
                VALID · {verification.result.certificateId} · hash chain, trace
                hash, contract hash, certificate ID and verifier result all
                confirmed.
              </p>
            ) : (
              <p className="cert-status cert-status--invalid" role="alert">
                INVALID · {verification.result.reason}
              </p>
            )
          ) : null}
          {viewOpen ? (
            <pre
              className="cert-json"
              tabIndex={0}
              aria-label="Certificate envelope JSON"
            >
              {state.bundle.envelopeJson}
            </pre>
          ) : null}
        </div>
      )}
    </section>
  );
}
