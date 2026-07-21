"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SimulatedRuntimeAdapter } from "@/lib/adapters/simulated-runtime";
import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import { Wordmark } from "@/components/brand/wordmark";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type {
  QuiescenceSweepResult,
  SweepPointResult,
} from "@/lib/domain/sweep";
import { runQuiescenceSweep } from "@/lib/engine/sweep";
import { runFullTestSuite, type SuiteRow } from "@/lib/engine/test-suite";
import {
  ScenarioConsole,
  type SuiteState,
} from "@/components/scenarios/scenario-console";
import {
  getScenarioDescriptor,
  type ScenarioKey,
} from "@/lib/fixtures/incident-scenarios";

export function QuiesceExperience() {
  const [adapter, setAdapter] = useState(() => new SimulatedRuntimeAdapter());
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(() =>
    adapter.inspectRuntime(),
  );
  const [stopStage, setStopStage] = useState<"idle" | "freeze" | "revealed">(
    "idle",
  );
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [vulnerableResult, setVulnerableResult] =
    useState<RuntimeSnapshot | null>(null);
  const [sweep, setSweep] = useState<QuiescenceSweepResult | null>(null);
  const [sweepError, setSweepError] = useState<string | null>(null);
  const [selectedSweepPoint, setSelectedSweepPoint] = useState<string | null>(
    null,
  );
  const [liveSnapshot, setLiveSnapshot] = useState<RuntimeSnapshot | null>(
    null,
  );
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("cloud-cleanup");
  const [suite, setSuite] = useState<SuiteState>({ phase: "idle", rows: [] });

  useEffect(() => {
    if (!snapshot.result || sweep || sweepError) return;
    void runQuiescenceSweep(scenarioKey)
      .then(setSweep)
      .catch((error: unknown) => {
        setSweepError(
          error instanceof Error ? error.message : "sweep replay failed",
        );
      });
  }, [snapshot.result, sweep, sweepError, scenarioKey]);

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

  async function advanceClock() {
    if (snapshot.nextLegalCommand !== "ADVANCE_CLOCK") return;
    await adapter.advanceLogicalTime(300_000);
    setSnapshot(adapter.inspectRuntime());
  }

  async function replayProtected() {
    if (snapshot.policy !== "vulnerable" || snapshot.result?.verdict !== "FAIL")
      return;
    setVulnerableResult(liveSnapshot ?? snapshot);
    const protectedAdapter = new SimulatedRuntimeAdapter(
      "protected",
      scenarioKey,
    );
    await protectedAdapter.startScenario();
    await protectedAdapter.injectStop();
    setAdapter(protectedAdapter);
    setSnapshot(protectedAdapter.inspectRuntime());
    setSelectedEffectId(null);
    setSelectedSweepPoint(null);
    setLiveSnapshot(null);
    setStopStage("revealed");
  }

  function selectSweepPoint(point: SweepPointResult) {
    setLiveSnapshot((previous) => previous ?? snapshot);
    setSnapshot(point.snapshot);
    setSelectedSweepPoint(`${point.policy}:${point.boundaryEventId}`);
    setSelectedEffectId(null);
    setStopStage("revealed");
  }

  function selectScenario(key: ScenarioKey) {
    if (key === scenarioKey) return;
    const nextAdapter = new SimulatedRuntimeAdapter("vulnerable", key);
    setScenarioKey(key);
    setAdapter(nextAdapter);
    setSnapshot(nextAdapter.inspectRuntime());
    setStopStage("idle");
    setSelectedEffectId(null);
    setVulnerableResult(null);
    setSweep(null);
    setSweepError(null);
    setSelectedSweepPoint(null);
    setLiveSnapshot(null);
  }

  async function runSuite() {
    if (suite.phase === "running") return;
    setSuite({ phase: "running", rows: [] });
    setSuite({ phase: "done", rows: await runFullTestSuite() });
  }

  function selectSuiteRow(row: SuiteRow) {
    setScenarioKey(row.scenario);
    setSnapshot(row.snapshot);
    setSelectedEffectId(null);
    setVulnerableResult(null);
    setSweep(null);
    setSweepError(null);
    setSelectedSweepPoint(null);
    setLiveSnapshot(null);
    setStopStage("revealed");
  }

  function returnToRun() {
    if (!liveSnapshot) return;
    setSnapshot(liveSnapshot);
    setLiveSnapshot(null);
    setSelectedSweepPoint(null);
    setSelectedEffectId(null);
    setStopStage("revealed");
  }

  const ready = snapshot.phase === "ready_to_stop";
  const stopped = snapshot.events.some(
    (event) => event.type === "STOP_INJECTED",
  );
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
          <nav className="hero__links" aria-label="Site">
            <Link className="nav-link" href="/methodology">
              Methodology
            </Link>
            <span className="simulation-badge">
              <i /> Deterministic simulation
            </span>
          </nav>
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
              <span>
                {snapshot.result
                  ? `Quiescence test ${snapshot.result.verdict === "PASS" ? "passed" : "failed"}`
                  : ready
                    ? "Scenario ready"
                    : "STOP recorded"}
              </span>
              <span aria-hidden="true">
                {snapshot.result
                  ? snapshot.result.verdict === "PASS"
                    ? "✓"
                    : "!"
                  : ready
                    ? "✓"
                    : "■"}
              </span>
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
        onAdvanceClock={advanceClock}
        onReplayProtected={replayProtected}
        vulnerableResult={vulnerableResult}
        selectedEffectId={selectedEffectId}
        onSelectEffect={setSelectedEffectId}
        sweep={sweep}
        sweepError={sweepError}
        selectedSweepPoint={selectedSweepPoint}
        onSelectSweepPoint={selectSweepPoint}
        onReturnToRun={returnToRun}
        scenarioKey={scenarioKey}
        scenarioLabel={getScenarioDescriptor(scenarioKey).label}
        scenarioConsole={
          <ScenarioConsole
            activeKey={scenarioKey}
            onSelectScenario={selectScenario}
            suite={suite}
            onRunSuite={runSuite}
            onSelectSuiteRow={selectSuiteRow}
          />
        }
      />
      <p className="sr-only" aria-live="polite">
        {snapshot.result
          ? snapshot.result.verdict === "PASS"
            ? `Protected replay passed. No residual authority remains. Time to quiescence was ${snapshot.result.timeToQuiescenceMs} milliseconds.`
            : `Quiescence test failed. ${snapshot.result.escapedEffectIds.length} material simulated effect committed after STOP.`
          : stopStage === "revealed"
            ? `Stop injected. Root agent stopped. ${snapshot.residualAuthorities.length} residual authorities remain. ${snapshot.pendingWork.length} pending operations remain queued.`
            : ""}
      </p>
    </main>
  );
}
