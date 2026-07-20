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

  async function startRun() {
    if (snapshot.nextLegalCommand !== "START_RUN") return;
    await adapter.startScenario();
    setSnapshot(adapter.inspectRuntime());
    document
      .querySelector("#workspace")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  const ready = snapshot.phase === "ready_to_stop";

  return (
    <main>
      <section
        className={`hero ${ready ? "hero--run" : ""}`}
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
          <button
            className="run-button"
            type="button"
            onClick={startRun}
            disabled={ready}
          >
            <span>{ready ? "Scenario ready" : "Run shutdown test"}</span>
            <span aria-hidden="true">{ready ? "✓" : "→"}</span>
          </button>
        </div>
        <div className="hero__disclosure">
          <span className="status-dot" />
          Deterministic simulation <b>·</b> No real infrastructure
        </div>
      </section>
      <WorkspaceShell snapshot={snapshot} />
    </main>
  );
}
