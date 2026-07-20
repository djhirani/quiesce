"use client";

import { useState } from "react";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import { Wordmark } from "@/components/brand/wordmark";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export function QuiesceExperience() {
  const [adapter] = useState(() => new SimulatedRuntimeAdapter());
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(() =>
    adapter.inspectRuntime(),
  );
  const [stopStage, setStopStage] = useState<"idle" | "freeze" | "revealed">(
    "idle",
  );

  async function startRun() {
    if (snapshot.nextLegalCommand !== "START_RUN") return;
    await adapter.startScenario();
    setSnapshot(adapter.inspectRuntime());
    document
      .querySelector("#workspace")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function injectStop() {
    if (snapshot.nextLegalCommand !== "INJECT_STOP") return;
    await adapter.injectStop();
    setSnapshot(adapter.inspectRuntime());
    setStopStage("freeze");
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.setTimeout(() => setStopStage("revealed"), reduceMotion ? 0 : 300);
  }

  const ready = snapshot.phase === "ready_to_stop";
  const stopped = snapshot.phase === "survivors_evaluated";
  const primaryLabel = stopped
    ? "Advance logical time +5 min"
    : ready
      ? "Inject STOP"
      : "Run shutdown test";

  return (
    <main>
      <section
        className={`hero ${ready || stopped ? "hero--run" : ""}`}
        aria-labelledby="hero-title"
      >
        <div className="hero__grid" aria-hidden="true" />
        <header className="hero__nav">
          <Wordmark />
          <span className="simulation-badge">
            <i /> Deterministic simulation
          </span>
        </header>
        <div className="hero__content">
          <p className="eyebrow">
            <span>Shutdown assurance</span>
            <span>System 01</span>
          </p>
          <h1 id="hero-title" aria-label="Prove your agents truly stop.">
            Prove your agents
            <br />
            truly stop.
          </h1>
          <p className="hero__lede">
            A stopped parent is not proof that everything it created stopped
            with it.
          </p>
          {snapshot.nextLegalCommand === "START_RUN" ? (
            <button className="run-button" type="button" onClick={startRun}>
              <span>{primaryLabel}</span>
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <div className="run-button run-button--state" role="status">
              <span>{ready ? "Scenario ready" : "STOP recorded"}</span>
              <span aria-hidden="true">{ready ? "✓" : "■"}</span>
            </div>
          )}
        </div>
        <div className="hero__disclosure">
          <span className="status-dot" />
          Deterministic simulation <b>·</b> No real infrastructure
        </div>
      </section>
      <WorkspaceShell
        snapshot={snapshot}
        stopStage={stopStage}
        onInjectStop={injectStop}
      />
      <p className="sr-only" aria-live="polite">
        {stopStage === "revealed"
          ? `Stop injected. Root agent stopped. ${snapshot.residualAuthorities.length} residual authorities remain. ${snapshot.pendingWork.length} pending operations remain queued.`
          : ""}
      </p>
    </main>
  );
}
