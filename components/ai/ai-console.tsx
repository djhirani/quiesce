"use client";

import { useState } from "react";
import {
  CLOUD_CLEANUP_COMPILE_INPUT,
  type ContractCompileOutcome,
} from "@/lib/ai/contract-compiler";
import type { IncidentNarrationOutcome } from "@/lib/ai/incident-narrator";

type ContractState =
  | { readonly phase: "idle" }
  | { readonly phase: "loading" }
  | { readonly phase: "error"; readonly message: string }
  | { readonly phase: "ready"; readonly outcome: ContractCompileOutcome };

type NarrationState =
  | { readonly phase: "idle" }
  | { readonly phase: "loading" }
  | { readonly phase: "error"; readonly message: string }
  | { readonly phase: "ready"; readonly narration: IncidentNarrationOutcome };

const fixtureReasonLabels: Record<string, string> = {
  model_unavailable: "Model unavailable",
  model_endpoint_failed: "Model endpoint failed",
  model_output_rejected: "Model output rejected",
};

function ProvenanceBadge({ outcome }: { outcome: ContractCompileOutcome }) {
  if (outcome.provenance.source === "gpt-5.6") {
    return (
      <span className="provenance provenance--live">Live GPT-5.6 output</span>
    );
  }
  return (
    <span className="provenance provenance--fixture">
      Deterministic fixture fallback ·{" "}
      {fixtureReasonLabels[outcome.provenance.reason] ??
        outcome.provenance.reason}
    </span>
  );
}

function CitationChips({
  eventIds,
  onFocusEvent,
}: {
  eventIds: readonly string[];
  onFocusEvent: (eventId: string) => void;
}) {
  return (
    <span className="citation-chips">
      {eventIds.map((eventId) => (
        <button
          className="citation-chip"
          type="button"
          aria-label={`Focus event ${eventId} in the evidence ledger`}
          onClick={() => onFocusEvent(eventId)}
          key={eventId}
        >
          {eventId}
        </button>
      ))}
    </span>
  );
}

export function AiConsole({
  verdict,
  onFocusEvent,
}: {
  verdict: "PASS" | "FAIL" | null;
  onFocusEvent: (eventId: string) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contract, setContract] = useState<ContractState>({ phase: "idle" });
  const [narration, setNarration] = useState<NarrationState>({ phase: "idle" });

  async function compileContract() {
    setContract({ phase: "loading" });
    try {
      const response = await fetch("/api/compile-contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(CLOUD_CLEANUP_COMPILE_INPUT),
      });
      if (!response.ok) {
        throw new Error(`Contract endpoint returned ${response.status}.`);
      }
      const outcome = (await response.json()) as ContractCompileOutcome;
      setContract({ phase: "ready", outcome });
    } catch (error) {
      setContract({
        phase: "error",
        message:
          error instanceof Error ? error.message : "Contract request failed.",
      });
    }
  }

  function toggleDrawer() {
    const next = !drawerOpen;
    setDrawerOpen(next);
    if (next && contract.phase === "idle") {
      void compileContract();
    }
  }

  async function explainIncident() {
    setNarration({ phase: "loading" });
    try {
      const response = await fetch("/api/explain-incident", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ policy: "vulnerable" }),
      });
      if (!response.ok) {
        throw new Error(`Explanation endpoint returned ${response.status}.`);
      }
      const payload = (await response.json()) as {
        narration: IncidentNarrationOutcome;
      };
      setNarration({ phase: "ready", narration: payload.narration });
    } catch (error) {
      setNarration({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "Explanation request failed.",
      });
    }
  }

  return (
    <section className="ai-console" aria-labelledby="ai-title">
      <div className="region-heading">
        <span className="region-index">07</span>
        <h3 id="ai-title">Bounded model assistance</h3>
        <span className="ai-badge">Advisory · never determines results</span>
      </div>
      <p className="ai-note">
        GPT-5.6 may propose a shutdown contract and explain deterministic
        findings with event citations. It never determines PASS/FAIL, counts,
        status, or time. Deterministic evidence above remains authoritative.
      </p>
      <div className="ai-console__grid">
        <article className="ai-panel">
          <button
            className="ai-drawer-toggle"
            type="button"
            aria-expanded={drawerOpen}
            onClick={toggleDrawer}
          >
            Proposed by GPT-5.6
            <span aria-hidden="true">{drawerOpen ? "▴" : "▾"}</span>
          </button>
          {drawerOpen ? (
            <div className="ai-drawer">
              {contract.phase === "loading" ? (
                <p className="ai-status" role="status">
                  Compiling shutdown contract…
                </p>
              ) : contract.phase === "error" ? (
                <div className="ai-status ai-status--error" role="alert">
                  <p>Contract request failed · {contract.message}</p>
                  <button
                    className="ai-retry"
                    type="button"
                    onClick={compileContract}
                  >
                    Retry
                  </button>
                </div>
              ) : contract.phase === "ready" ? (
                <div className="contract-body">
                  <ProvenanceBadge outcome={contract.outcome} />
                  {contract.outcome.provenance.source === "fixture" ? (
                    <p className="ai-detail">
                      {contract.outcome.provenance.detail}
                    </p>
                  ) : null}
                  <h4>Objective</h4>
                  <p>{contract.outcome.contract.objective}</p>
                  <div className="contract-columns">
                    <div>
                      <h4>Permitted</h4>
                      <ul>
                        {contract.outcome.contract.permittedActions.map(
                          (action) => (
                            <li key={action}>{action}</li>
                          ),
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4>Approval required</h4>
                      <ul>
                        {contract.outcome.contract.approvalRequired.map(
                          (action) => (
                            <li key={action}>{action}</li>
                          ),
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4>Prohibited</h4>
                      <ul>
                        {contract.outcome.contract.prohibitedActions.map(
                          (action) => (
                            <li key={action}>{action}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                  <h4>Shutdown invariants</h4>
                  <ul className="contract-invariants">
                    {contract.outcome.contract.invariants.map((invariant) => (
                      <li key={invariant.id}>
                        <code>{invariant.evaluator}</code>
                        <span>
                          {invariant.label} · {invariant.severity.toUpperCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
        <article className="ai-panel">
          <h4 className="ai-panel__title">GPT-5.6 explanation</h4>
          {verdict === "PASS" ? (
            <p className="ai-status">
              No incident explanation required — the protected run reached
              quiescence.
            </p>
          ) : verdict === "FAIL" ? (
            narration.phase === "idle" ? (
              <button
                className="ai-explain"
                type="button"
                onClick={explainIncident}
              >
                Explain incident
              </button>
            ) : narration.phase === "loading" ? (
              <p className="ai-status" role="status">
                Requesting explanation…
              </p>
            ) : narration.phase === "error" ? (
              <div className="ai-status ai-status--error" role="alert">
                <p>Explanation request failed · {narration.message}</p>
                <button
                  className="ai-retry"
                  type="button"
                  onClick={explainIncident}
                >
                  Retry
                </button>
              </div>
            ) : narration.narration.status === "unavailable" ? (
              <p className="ai-status">
                GPT-5.6 unavailable · {narration.narration.reason} The
                deterministic findings above are unaffected.
              </p>
            ) : narration.narration.status === "rejected" ? (
              <p className="ai-status ai-status--error" role="alert">
                Model output rejected · {narration.narration.reason} The
                deterministic findings above remain authoritative.
              </p>
            ) : narration.narration.status === "not_required" ? (
              <p className="ai-status">{narration.narration.message}</p>
            ) : (
              <div className="narration-body">
                <span className="provenance provenance--live">
                  Live GPT-5.6 output
                </span>
                <h5>{narration.narration.explanation.headline}</h5>
                <p>{narration.narration.explanation.summary}</p>
                <dl className="narration-blocks">
                  <div>
                    <dt>Decisive failure</dt>
                    <dd>
                      {
                        narration.narration.explanation.decisiveFailure
                          .explanation
                      }{" "}
                      <CitationChips
                        eventIds={
                          narration.narration.explanation.decisiveFailure
                            .eventIds
                        }
                        onFocusEvent={onFocusEvent}
                      />
                    </dd>
                  </div>
                  {narration.narration.explanation.survivors.map((survivor) => (
                    <div key={survivor.entityId}>
                      <dt>Survivor · {survivor.entityId}</dt>
                      <dd>
                        {survivor.explanation}{" "}
                        <CitationChips
                          eventIds={survivor.eventIds}
                          onFocusEvent={onFocusEvent}
                        />
                      </dd>
                    </div>
                  ))}
                  {narration.narration.explanation.escapedEffects.map(
                    (escaped) => (
                      <div key={escaped.effectId}>
                        <dt>Escaped effect · {escaped.effectId}</dt>
                        <dd>
                          {escaped.explanation}{" "}
                          <CitationChips
                            eventIds={escaped.eventIds}
                            onFocusEvent={onFocusEvent}
                          />
                        </dd>
                      </div>
                    ),
                  )}
                  <div>
                    <dt>Earliest unsafe boundary</dt>
                    <dd>
                      {
                        narration.narration.explanation.earliestUnsafeBoundary
                          .explanation
                      }{" "}
                      <CitationChips
                        eventIds={[
                          narration.narration.explanation.earliestUnsafeBoundary
                            .eventId,
                        ]}
                        onFocusEvent={onFocusEvent}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Recommended control</dt>
                    <dd>
                      {
                        narration.narration.explanation.recommendedControl
                          .action
                      }{" "}
                      <CitationChips
                        eventIds={[
                          narration.narration.explanation.recommendedControl
                            .eventId,
                        ]}
                        onFocusEvent={onFocusEvent}
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            )
          ) : (
            <p className="ai-status">
              Available after the deterministic test reaches a verdict.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
