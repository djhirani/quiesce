"use client";

import {
  scenarioDescriptors,
  type ScenarioKey,
} from "@/lib/fixtures/incident-scenarios";
import type { SuiteRow } from "@/lib/engine/test-suite";

export interface SuiteState {
  readonly phase: "idle" | "running" | "done";
  readonly rows: readonly SuiteRow[];
}

export function ScenarioConsole({
  activeKey,
  onSelectScenario,
  suite,
  onRunSuite,
  onSelectSuiteRow,
}: {
  activeKey: ScenarioKey;
  onSelectScenario: (key: ScenarioKey) => void;
  suite: SuiteState;
  onRunSuite: () => void;
  onSelectSuiteRow: (row: SuiteRow) => void;
}) {
  const active = scenarioDescriptors.find(({ key }) => key === activeKey);
  return (
    <section className="scenario-console" aria-labelledby="scenario-title">
      <div className="scenario-console__bar">
        <div className="region-heading">
          <span className="region-index">00</span>
          <h3 id="scenario-title">Scenario library</h3>
        </div>
        <div
          className="scenario-picker"
          role="group"
          aria-label="Select scenario"
        >
          {scenarioDescriptors.map((descriptor) => (
            <button
              type="button"
              aria-pressed={descriptor.key === activeKey}
              onClick={() => onSelectScenario(descriptor.key)}
              key={descriptor.key}
            >
              {descriptor.label}
            </button>
          ))}
        </div>
        <button
          className="suite-run"
          type="button"
          onClick={onRunSuite}
          disabled={suite.phase === "running"}
        >
          {suite.phase === "running"
            ? "Running full test suite…"
            : "Run full test suite"}
        </button>
      </div>
      {active?.disclosure ? (
        <p className="scenario-disclosure">
          <strong>{active.disclosure.line}</strong>{" "}
          <span>{active.disclosure.source}</span>
        </p>
      ) : null}
      {suite.phase === "running" ? (
        <p className="suite-status" role="status">
          Executing 3 scenarios × 2 policies through the deterministic verifier…
        </p>
      ) : null}
      {suite.phase === "done" ? (
        <div className="suite-block">
          <div className="suite-wrap">
            <table className="suite-table">
              <thead>
                <tr>
                  <th scope="col">Scenario</th>
                  <th scope="col">Policy</th>
                  <th scope="col">Verdict</th>
                  <th scope="col">Residual authorities</th>
                  <th scope="col">Pending work</th>
                  <th scope="col">Escaped effects</th>
                  <th scope="col">Time to Quiescence</th>
                  <th scope="col">Evidence event count</th>
                </tr>
              </thead>
              <tbody>
                {suite.rows.map((row) => (
                  <tr key={`${row.scenario}:${row.policy}`}>
                    <td>
                      <button
                        className="suite-focus"
                        type="button"
                        aria-label={`Focus ${row.scenarioLabel} ${row.policy} result`}
                        onClick={() => onSelectSuiteRow(row)}
                      >
                        {row.scenarioLabel}
                      </button>
                    </td>
                    <td>{row.policy}</td>
                    <td
                      className={row.verdict === "PASS" ? "is-pass" : "is-fail"}
                    >
                      {row.verdict}
                    </td>
                    <td>{row.residualAuthorities}</td>
                    <td>{row.pendingWork}</td>
                    <td>{row.escapedEffects}</td>
                    <td>
                      {row.timeToQuiescenceMs === null
                        ? "NOT ACHIEVED"
                        : `${row.timeToQuiescenceMs} MS`}
                    </td>
                    <td>{row.eventCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="suite-complete" role="status">
            Suite complete · 6 deterministic runs · every value copied from the
            verifier result.
          </p>
        </div>
      ) : null}
    </section>
  );
}
