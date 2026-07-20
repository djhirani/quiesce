import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import type { CSSProperties } from "react";

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

export function WorkspaceShell({
  snapshot,
  stopStage,
  onInjectStop,
  onAdvanceClock,
  onReplayProtected,
  vulnerableResult,
  selectedEffectId,
  onSelectEffect,
}: {
  snapshot: RuntimeSnapshot;
  stopStage: "idle" | "freeze" | "revealed";
  onInjectStop: () => void;
  onAdvanceClock: () => void;
  onReplayProtected: () => void;
  vulnerableResult: RuntimeSnapshot | null;
  selectedEffectId: string | null;
  onSelectEffect: (id: string | null) => void;
}) {
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
              <dd>
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
              <dd>
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
                  ? `Stale authority rejected by ${rejectedEvent?.eventId}.`
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

      <section className="evidence-region" aria-labelledby="evidence-title">
        <div className="region-heading">
          <span className="region-index">05</span>
          <h3 id="evidence-title">Evidence ledger</h3>
        </div>
        {started ? (
          <div className="ledger-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Actor</th>
                  <th>Subject</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.events.map((event) => (
                  <tr
                    className={citedIds.has(event.eventId) ? "is-cited" : ""}
                    key={event.eventId}
                  >
                    <td>{event.eventId}</td>
                    <td>{event.logicalTimeMs} ms</td>
                    <td>{event.type}</td>
                    <td>{event.actorId}</td>
                    <td>{event.subjectId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No events recorded. Start a shutdown test to create an append-only
            evidence trail.
          </p>
        )}
      </section>
      {vulnerableResult && snapshot.result?.verdict === "PASS" ? (
        <section className="comparison" aria-labelledby="comparison-title">
          <div className="region-heading">
            <span className="region-index">06</span>
            <h3 id="comparison-title">Vulnerable versus protected</h3>
          </div>
          <div className="comparison__grid">
            <article>
              <span>Vulnerable</span>
              <strong>FAILED</strong>
              <p>
                {vulnerableResult.result?.residualAuthorityIds.length} residual
                · {vulnerableResult.result?.pendingWorkIds.length} pending ·{" "}
                {vulnerableResult.result?.escapedEffectIds.length} escaped
              </p>
              <code>NOT ACHIEVED</code>
            </article>
            <article>
              <span>Protected</span>
              <strong>PASSED</strong>
              <p>
                {snapshot.result.residualAuthorityIds.length} residual ·{" "}
                {snapshot.result.pendingWorkIds.length} pending ·{" "}
                {snapshot.result.escapedEffectIds.length} escaped
              </p>
              <code>{snapshot.result.timeToQuiescenceMs} MS</code>
            </article>
          </div>
        </section>
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
