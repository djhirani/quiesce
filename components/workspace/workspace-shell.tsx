"use client";

import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import { useState, type CSSProperties } from "react";
import type { AuthorityEvent } from "@/lib/domain/events";
import type {
  QuiescenceSweepResult,
  SweepPointResult,
} from "@/lib/domain/sweep";
import { AiConsole } from "@/components/ai/ai-console";
import { CertificatePanel } from "@/components/certificate/certificate-panel";
import { EvidenceLedger } from "@/components/evidence/evidence-ledger";

const kindLabels = {
  human: "Human",
  agent: "Agent",
  credential: "Credential",
  scheduled_job: "Scheduled job",
  retry_worker: "Retry worker",
  queue_item: "Queue item",
  effect: "Effect",
} as const;

const roleLabels: Record<string, string> = {
  "human-operator-01": "Origin",
  "agent-cleanup-root-01": "Root",
  "agent-optimisation-child-01": "Child",
  "credential-cleanup-01": "Credential",
  "job-recurring-cleanup-01": "Job",
  "retry-cleanup-01": "Retry",
};

const effectPathIds = new Set([
  "credential-cleanup-01",
  "job-recurring-cleanup-01",
  "retry-cleanup-01",
  "queue-production-backup-01",
  "effect-production-backup-deletion-01",
]);

const traceChipTones: Record<string, string> = {
  STOP_INJECTED: "stop",
  EFFECT_COMMITTED: "breach",
  EFFECT_REJECTED: "safe",
  QUIESCENCE_REACHED: "quiescence",
};

export function WorkspaceShell({
  snapshot,
  stopStage,
  onInjectStop,
  onAdvanceClock,
  onReplayProtected,
  vulnerableResult,
  selectedEffectId,
  onSelectEffect,
  sweep,
  sweepError,
  selectedSweepPoint,
  onSelectSweepPoint,
  onReturnToRun,
}: {
  snapshot: RuntimeSnapshot;
  stopStage: "idle" | "freeze" | "revealed";
  onInjectStop: () => void;
  onAdvanceClock: () => void;
  onReplayProtected: () => void;
  vulnerableResult: RuntimeSnapshot | null;
  selectedEffectId: string | null;
  onSelectEffect: (id: string | null) => void;
  sweep: QuiescenceSweepResult | null;
  sweepError: string | null;
  selectedSweepPoint: string | null;
  onSelectSweepPoint: (point: SweepPointResult) => void;
  onReturnToRun: () => void;
}) {
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const started = snapshot.events.length > 0;
  const ready = snapshot.phase === "ready_to_stop";
  const stopEvent = snapshot.events.find(
    (event) => event.type === "STOP_INJECTED",
  );
  const clockEvent = snapshot.events.find(
    (event) => event.type === "CLOCK_ADVANCED",
  );
  const committedEvent = snapshot.events.find(
    (event) => event.type === "EFFECT_COMMITTED",
  );
  const rejectedEvent = snapshot.events.find(
    (event) => event.type === "EFFECT_REJECTED",
  );
  const quiescenceEvent = snapshot.events.find(
    (event) => event.type === "QUIESCENCE_REACHED",
  );
  const protectedRun = snapshot.policy === "protected";
  const projectedTimeToQuiescence =
    stopEvent && quiescenceEvent
      ? quiescenceEvent.logicalTimeMs - stopEvent.logicalTimeMs
      : null;
  const stopped = Boolean(stopEvent);
  const survivorsVisible = stopped && stopStage === "revealed";
  const residualIds = new Set(snapshot.residualAuthorities.map(({ id }) => id));
  const pendingIds = new Set(snapshot.pendingWork.map(({ id }) => id));
  const selected = selectedEffectId !== null || Boolean(rejectedEvent);
  const citedIds = new Set(
    selected
      ? (snapshot.result?.invariantResults
          .flatMap(({ evidenceEventIds }) => evidenceEventIds)
          .filter(
            (id) =>
              id === stopEvent?.eventId ||
              id === committedEvent?.eventId ||
              id === rejectedEvent?.eventId,
          ) ?? [])
      : [],
  );
  if (selected) {
    for (const event of snapshot.events) {
      if (
        [
          "JOB_TRIGGERED",
          "EFFECT_ATTEMPTED",
          "STALE_AUTHORITY_REJECTED",
        ].includes(event.type)
      ) {
        citedIds.add(event.eventId);
      }
    }
  }
  const traceChips = stopEvent
    ? [
        snapshot.events[0],
        stopEvent,
        clockEvent,
        committedEvent,
        rejectedEvent,
        quiescenceEvent,
      ].filter((event): event is AuthorityEvent => Boolean(event))
    : [];
  const envelopeVisible = Boolean(sweep || sweepError || snapshot.result);
  const activePoint =
    sweep && selectedSweepPoint
      ? [...sweep.injectionPoints, ...sweep.protectedPoints].find(
          (point) =>
            `${point.policy}:${point.boundaryEventId}` === selectedSweepPoint,
        )
      : null;

  return (
    <section
      className="workspace"
      id="workspace"
      aria-labelledby="workspace-title"
    >
      <header className="workspace__header">
        <div>
          <span className="micro-label">Test instrument</span>
          <h2 id="workspace-title">
            Cloud cleanup /{" "}
            {snapshot.result
              ? snapshot.result.verdict === "PASS"
                ? "protected proof complete"
                : "breach proven"
              : stopped
                ? "survivors detected"
                : ready
                  ? "ready to stop"
                  : "standby"}
          </h2>
        </div>
        <div className="workspace__meta">
          <span>
            {started ? snapshot.scenarioSeed : "Scenario not started"}
          </span>
          <span>SIMULATION</span>
        </div>
      </header>

      <div className="workspace__signals">
        <section className="signal-region" aria-labelledby="region-01">
          <span className="region-index">01</span>
          <div>
            <h3 id="region-01">Quiescence Trace</h3>
            <p>
              {rejectedEvent
                ? `Delayed effect rejected by ${rejectedEvent.eventId}. Trace settled.`
                : committedEvent
                  ? `Post-STOP breach proven by ${committedEvent.eventId}.`
                  : stopEvent
                    ? "STOP recorded. No post-STOP effect has occurred."
                    : "Recorded activity will appear here when a test begins."}
            </p>
            {traceChips.length > 0 ? (
              <ol className="trace-chips" aria-label="Key recorded events">
                {traceChips.map((event) => (
                  <li
                    className={`trace-chip trace-chip--${traceChipTones[event.type] ?? "neutral"}`}
                    key={event.eventId}
                  >
                    {`${event.eventId} · ${event.type}`}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          <div
            className={`signal-line ${stopEvent ? "signal-line--stopped" : ""} ${clockEvent ? "signal-line--advanced" : ""} ${committedEvent ? "signal-line--breach" : ""} ${quiescenceEvent ? "signal-line--flatline" : ""}`}
            aria-hidden="true"
          >
            <span />
            {stopEvent ? <b>STOP · {stopEvent.eventId}</b> : null}
            {committedEvent ? <em>BREACH · {committedEvent.eventId}</em> : null}
            {quiescenceEvent ? (
              <em className="quiescence-bracket">
                {projectedTimeToQuiescence} MS · {stopEvent?.eventId} →{" "}
                {quiescenceEvent.eventId}
              </em>
            ) : null}
          </div>
        </section>
        <section className="signal-region" aria-labelledby="region-02">
          <span className="region-index">02</span>
          <div>
            <h3 id="region-02">Logical-time ruler</h3>
            <p>
              {clockEvent
                ? `${clockEvent.eventId} advanced exactly 300000 ms.`
                : "Awaiting the post-STOP clock advance."}
            </p>
          </div>
          <div
            className={`signal-line signal-line--ruler ${clockEvent ? "signal-line--advanced" : ""}`}
            aria-hidden="true"
          >
            <span />
          </div>
        </section>
      </div>

      {envelopeVisible ? (
        <section className="shutdown-envelope" aria-labelledby="envelope-title">
          <div className="shutdown-envelope__heading">
            <span className="region-index">02A</span>
            <div>
              <h3 id="envelope-title">Shutdown Envelope</h3>
              {sweep ? (
                <div className="envelope-summary">
                  <span className="envelope-chip envelope-chip--fail">
                    Earliest unsafe ·{" "}
                    {sweep.earliestUnsafeBoundary?.boundaryEventId}
                  </span>
                  <span className="envelope-chip envelope-chip--breach">
                    Worst breach · {sweep.worstBreachBoundary?.boundaryEventId}
                  </span>
                </div>
              ) : sweepError ? (
                <p className="envelope-note envelope-note--error" role="alert">
                  Sweep unavailable · {sweepError}
                </p>
              ) : (
                <p className="envelope-note" role="status">
                  Deriving injection points · replaying every authority
                  boundary…
                </p>
              )}
              <ul
                className="envelope-legend"
                aria-label="Sweep classification legend"
              >
                <li>
                  <i
                    className="legend-dot legend-dot--pass"
                    aria-hidden="true"
                  />
                  PASS · quiescence proven
                </li>
                <li>
                  <i
                    className="legend-dot legend-dot--fail"
                    aria-hidden="true"
                  />
                  FAIL · residual authority survives
                </li>
                <li>
                  <i
                    className="legend-dot legend-dot--breach"
                    aria-hidden="true"
                  />
                  BREACH · effect commits after STOP
                </li>
              </ul>
            </div>
          </div>
          {sweep ? (
            <div className="envelope-runs">
              {[
                ["Vulnerable", sweep.injectionPoints],
                ["Protected", sweep.protectedPoints],
              ].map(([label, points]) => (
                <div className="envelope-run" key={label as string}>
                  <span>{label as string}</span>
                  <div>
                    {(points as readonly SweepPointResult[]).map((point) => {
                      const selection = `${point.policy}:${point.boundaryEventId}`;
                      return (
                        <button
                          className={`envelope-marker envelope-marker--${point.classification.toLowerCase()}`}
                          type="button"
                          aria-label={`${label} ${point.boundaryEventId} ${point.boundaryEventType} ${point.classification}`}
                          aria-pressed={selectedSweepPoint === selection}
                          onClick={() => onSelectSweepPoint(point)}
                          key={selection}
                        >
                          <i />
                          <code>{point.boundaryEventId}</code>
                          <span>{point.boundaryEventType}</span>
                          <small>{point.classification}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : !sweepError ? (
            <div className="envelope-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : null}
          {activePoint ? (
            <div className="envelope-context">
              <span>
                {`Viewing ${activePoint.policy} injection at ${activePoint.boundaryEventId} · ${activePoint.boundaryEventType} · ${activePoint.classification}`}
              </span>
              <button
                className="return-control"
                type="button"
                onClick={onReturnToRun}
              >
                Return to full run
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="workspace__core">
        <section className="graph-region" aria-labelledby="graph-title">
          <div className="region-heading">
            <span className="region-index">03</span>
            <h3 id="graph-title">Authority topology</h3>
          </div>
          {started ? (
            <div
              className={`topology ${stopStage === "freeze" ? "topology--frozen" : ""}`}
              aria-label="Current authority topology"
            >
              <ol className="topology__nodes">
                {snapshot.entities.map((entity, index) => (
                  <li
                    className={`topology-node topology-node--${entity.kind} ${entity.status === "stopped" ? "topology-node--stopped" : ""} ${survivorsVisible && residualIds.has(entity.id) ? "topology-node--survivor" : ""} ${survivorsVisible && pendingIds.has(entity.id) ? "topology-node--pending" : ""} ${clockEvent && entity.id === "job-recurring-cleanup-01" ? "topology-node--triggered" : ""} ${selected && effectPathIds.has(entity.id) ? "topology-node--selected" : ""} ${rejectedEvent && effectPathIds.has(entity.id) ? "topology-node--blocked" : ""}`}
                    key={entity.id}
                    style={{ "--reveal-depth": index } as CSSProperties}
                  >
                    <span>
                      {roleLabels[entity.id] ?? kindLabels[entity.kind]}
                    </span>
                    <strong>{entity.label}</strong>
                    <code>{entity.status.toUpperCase()}</code>
                  </li>
                ))}
              </ol>
              <ul
                className="topology__edges"
                aria-label="Authority relationships"
              >
                {snapshot.edges
                  .filter(
                    (edge) =>
                      !edge.targetId.startsWith("effect-development-instance"),
                  )
                  .map((edge) => (
                    <li
                      className={`${survivorsVisible && (residualIds.has(edge.sourceId) || residualIds.has(edge.targetId) || pendingIds.has(edge.targetId)) ? "is-surviving" : ""} ${selected && effectPathIds.has(edge.sourceId) && effectPathIds.has(edge.targetId) ? "is-selected" : ""} ${rejectedEvent && effectPathIds.has(edge.sourceId) && effectPathIds.has(edge.targetId) ? "is-blocked" : ""}`}
                      key={edge.id}
                    >
                      <code>{edge.sourceId}</code>
                      <span>{edge.relationship}</span>
                      <code>{edge.targetId}</code>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div className="empty-state">
              <div className="reticle" aria-hidden="true">
                <span />
              </div>
              <p>Authority graph awaiting a deterministic run.</p>
              <small>No topology is inferred before evidence exists.</small>
            </div>
          )}
        </section>

        <aside className="test-state" aria-labelledby="state-title">
          <div className="region-heading">
            <span className="region-index">04</span>
            <h3 id="state-title">Test state</h3>
          </div>
          <dl>
            <div>
              <dt>Status</dt>
              <dd
                className={
                  snapshot.result
                    ? snapshot.result.verdict === "PASS"
                      ? "value-pass"
                      : "value-fail"
                    : stopped
                      ? "value-warn"
                      : ""
                }
              >
                {snapshot.result
                  ? snapshot.result.verdict === "PASS"
                    ? "PASSED"
                    : "FAILED"
                  : stopped
                    ? "STOP_INJECTED"
                    : ready
                      ? "SCENARIO_READY"
                      : "STANDBY"}
              </dd>
            </div>
            <div>
              <dt>Event count</dt>
              <dd>{started ? snapshot.events.length : "—"}</dd>
            </div>
            <div>
              <dt>Logical time</dt>
              <dd>{started ? `${snapshot.logicalTimeMs} MS` : "—"}</dd>
            </div>
            <div>
              <dt>Residual authority</dt>
              <dd>
                {survivorsVisible ? snapshot.residualAuthorities.length : "—"}
              </dd>
            </div>
            <div>
              <dt>Pending work</dt>
              <dd>{survivorsVisible ? snapshot.pendingWork.length : "—"}</dd>
            </div>
            <div>
              <dt>Escaped effects</dt>
              <dd>{snapshot.result ? snapshot.escapedEffects.length : "—"}</dd>
            </div>
            <div>
              <dt>Time to quiescence</dt>
              <dd className={snapshot.result ? "value-ttq" : ""}>
                {snapshot.result
                  ? snapshot.result.timeToQuiescenceMs === null
                    ? "NOT ACHIEVED"
                    : `${snapshot.result.timeToQuiescenceMs} MS`
                  : "—"}
              </dd>
            </div>
          </dl>
          {ready ? (
            <button
              className="stop-control"
              type="button"
              onClick={onInjectStop}
            >
              Inject STOP
            </button>
          ) : null}
          {stopStage === "freeze" ? (
            <p className="survivor-question">What is still alive?</p>
          ) : null}
          {survivorsVisible && !snapshot.result && !protectedRun ? (
            <div className="survivor-proof">
              <p>STOP did not propagate</p>
              <ul>
                {snapshot.residualAuthorities.map((entity) => (
                  <li key={entity.id}>
                    <strong>{roleLabels[entity.id]}</strong>
                    <code>{entity.status.toUpperCase()}</code>
                  </li>
                ))}
              </ul>
              <h4>Pending work</h4>
              <ul>
                {snapshot.pendingWork.map((entity) => (
                  <li key={entity.id}>
                    <strong>{entity.label}</strong>
                    <code>{entity.status.toUpperCase()} · COMMITTABLE</code>
                  </li>
                ))}
              </ul>
              <button
                className="advance-control"
                type="button"
                onClick={onAdvanceClock}
                disabled={snapshot.nextLegalCommand !== "ADVANCE_CLOCK"}
              >
                Advance logical time +5 min
              </button>
              <small>Next legal action · exactly 300000 ms</small>
            </div>
          ) : null}
          {protectedRun && quiescenceEvent && !snapshot.result ? (
            <div className="protected-proof">
              <p>SEAL → REVOKE → DRAIN → PROVE</p>
              <ol>
                {snapshot.events
                  .filter((event) => event.eventIndex >= 12)
                  .map((event, index) => (
                    <li
                      key={event.eventId}
                      style={{ "--cascade-index": index } as CSSProperties}
                    >
                      <code>{event.eventId}</code>
                      <span>{event.type}</span>
                    </li>
                  ))}
              </ol>
              <strong>ZERO RESIDUAL AUTHORITY</strong>
              <button
                className="advance-control"
                type="button"
                onClick={onAdvanceClock}
                disabled={snapshot.nextLegalCommand !== "ADVANCE_CLOCK"}
              >
                Advance logical time +5 min
              </button>
              <small>Test the same delayed operation at epoch 7</small>
            </div>
          ) : null}
          {snapshot.result ? (
            <div
              className={`verdict ${snapshot.result.verdict === "PASS" ? "verdict--pass" : ""}`}
              role="status"
            >
              <p>
                QUIESCENCE TEST:{" "}
                {snapshot.result.verdict === "PASS" ? "PASSED" : "FAILED"}
              </p>
              <strong>
                {snapshot.result.verdict === "PASS"
                  ? rejectedEvent
                    ? `Stale authority rejected by ${rejectedEvent.eventId}.`
                    : "No residual authority or pending work remained."
                  : "One material simulated effect committed after STOP."}
              </strong>
              <dl>
                <div>
                  <dt>Residual authorities</dt>
                  <dd>{snapshot.result.residualAuthorityIds.length}</dd>
                </div>
                <div>
                  <dt>Pending work</dt>
                  <dd>{snapshot.result.pendingWorkIds.length}</dd>
                </div>
                <div>
                  <dt>Escaped effects</dt>
                  <dd>{snapshot.result.escapedEffectIds.length}</dd>
                </div>
                <div>
                  <dt>Time to quiescence</dt>
                  <dd>
                    {snapshot.result.timeToQuiescenceMs === null
                      ? "NOT ACHIEVED"
                      : `${snapshot.result.timeToQuiescenceMs} MS`}
                  </dd>
                </div>
              </dl>
              {snapshot.escapedEffects.map((effect) => (
                <button
                  className="escaped-effect"
                  type="button"
                  aria-pressed={selectedEffectId === effect.id}
                  onClick={() =>
                    onSelectEffect(
                      selectedEffectId === effect.id ? null : effect.id,
                    )
                  }
                  key={effect.id}
                >
                  Escaped effect · {effect.label}
                  <code>{committedEvent?.eventId}</code>
                </button>
              ))}
              {rejectedEvent ? (
                <button className="rejected-effect" type="button">
                  Blocked effect · Production backup deletion
                  <code>{rejectedEvent.eventId} · STALE EPOCH 7 &lt; 8</code>
                </button>
              ) : null}
              {snapshot.result.verdict === "FAIL" ? (
                <button
                  className="replay-control"
                  type="button"
                  onClick={onReplayProtected}
                >
                  Replay protected
                </button>
              ) : null}
            </div>
          ) : !ready && !survivorsVisible ? (
            <p className="state-note">
              Result metrics remain unset until derived from shutdown events.
            </p>
          ) : null}
        </aside>
      </div>

      <EvidenceLedger
        events={snapshot.events}
        started={started}
        citedIds={citedIds}
        runId={snapshot.runId}
        policy={snapshot.policy}
        focusedEventId={focusedEventId}
      />
      {vulnerableResult?.result && snapshot.result?.verdict === "PASS" ? (
        <section className="comparison" aria-labelledby="comparison-title">
          <div className="region-heading">
            <span className="region-index">06</span>
            <h3 id="comparison-title">Vulnerable versus protected</h3>
          </div>
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Vulnerable run</th>
                <th scope="col">Protected run</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Verdict</th>
                <td
                  className={
                    vulnerableResult.result.verdict === "PASS"
                      ? "is-pass"
                      : "is-fail"
                  }
                >
                  {vulnerableResult.result.verdict === "PASS"
                    ? "PASSED"
                    : "FAILED"}
                </td>
                <td
                  className={
                    snapshot.result.verdict === "PASS" ? "is-pass" : "is-fail"
                  }
                >
                  {snapshot.result.verdict === "PASS" ? "PASSED" : "FAILED"}
                </td>
              </tr>
              <tr>
                <th scope="row">Residual authorities</th>
                <td>{vulnerableResult.result.residualAuthorityIds.length}</td>
                <td>{snapshot.result.residualAuthorityIds.length}</td>
              </tr>
              <tr>
                <th scope="row">Pending work</th>
                <td>{vulnerableResult.result.pendingWorkIds.length}</td>
                <td>{snapshot.result.pendingWorkIds.length}</td>
              </tr>
              <tr>
                <th scope="row">Escaped effects</th>
                <td>{vulnerableResult.result.escapedEffectIds.length}</td>
                <td>{snapshot.result.escapedEffectIds.length}</td>
              </tr>
              <tr>
                <th scope="row">Time to quiescence</th>
                <td>
                  {vulnerableResult.result.timeToQuiescenceMs === null
                    ? "NOT ACHIEVED"
                    : `${vulnerableResult.result.timeToQuiescenceMs} MS`}
                </td>
                <td>
                  {snapshot.result.timeToQuiescenceMs === null
                    ? "NOT ACHIEVED"
                    : `${snapshot.result.timeToQuiescenceMs} MS`}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}
      {started ? (
        <AiConsole
          verdict={snapshot.result?.verdict ?? null}
          onFocusEvent={setFocusedEventId}
        />
      ) : null}
      {snapshot.phase === "test_complete" && snapshot.result ? (
        <CertificatePanel
          key={`${snapshot.policy}:${snapshot.result.stopEventId}:${snapshot.events.length}`}
          snapshot={snapshot}
        />
      ) : null}
      <footer className="workspace__footer">
        <span>
          <i />{" "}
          {snapshot.result
            ? snapshot.result.verdict === "PASS"
              ? "Quiescence verified"
              : "Breach proven"
            : stopped
              ? "Survivors detected"
              : ready
                ? "Scenario ready"
                : "Instrument ready"}
        </span>
        <span>All effects are simulated</span>
      </footer>
    </section>
  );
}
