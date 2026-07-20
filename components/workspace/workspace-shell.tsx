import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";
import type { CSSProperties } from "react";

const regions = [
  ["01", "Quiescence Trace"],
  ["02", "Shutdown Envelope"],
] as const;

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

export function WorkspaceShell({
  snapshot,
  stopStage,
  onInjectStop,
}: {
  snapshot: RuntimeSnapshot;
  stopStage: "idle" | "freeze" | "revealed";
  onInjectStop: () => void;
}) {
  const started = snapshot.events.length > 0;
  const ready = snapshot.phase === "ready_to_stop";
  const stopped = snapshot.phase === "survivors_evaluated";
  const survivorsVisible = stopped && stopStage === "revealed";
  const stopEvent = snapshot.events.find(
    (event) => event.type === "STOP_INJECTED",
  );
  const residualIds = new Set(snapshot.residualAuthorities.map(({ id }) => id));
  const pendingIds = new Set(snapshot.pendingWork.map(({ id }) => id));
  const graphEntities = snapshot.entities.filter(
    (entity) => entity.kind !== "effect",
  );

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
            {stopped
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
        {regions.map(([index, title]) => (
          <section
            className="signal-region"
            key={title}
            aria-labelledby={`region-${index}`}
          >
            <span className="region-index">{index}</span>
            <div>
              <h3 id={`region-${index}`}>{title}</h3>
              <p>
                {stopEvent && title === "Quiescence Trace"
                  ? "STOP recorded. No post-STOP effect has occurred."
                  : started
                    ? "No shutdown evidence recorded yet."
                    : title === "Quiescence Trace"
                      ? "Recorded activity will appear here when a test begins."
                      : "Tested authority boundaries will appear after a sweep."}
              </p>
            </div>
            <div
              className={`signal-line ${stopEvent && title === "Quiescence Trace" ? "signal-line--stopped" : ""}`}
              aria-hidden="true"
            >
              <span />
              {stopEvent && title === "Quiescence Trace" ? (
                <b>STOP · {stopEvent.eventId}</b>
              ) : null}
            </div>
          </section>
        ))}
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
                {graphEntities.map((entity) => (
                  <li
                    className={`topology-node topology-node--${entity.kind} ${entity.status === "stopped" ? "topology-node--stopped" : ""} ${survivorsVisible && residualIds.has(entity.id) ? "topology-node--survivor" : ""} ${survivorsVisible && pendingIds.has(entity.id) ? "topology-node--pending" : ""}`}
                    key={entity.id}
                    style={
                      {
                        "--reveal-depth": graphEntities.indexOf(entity),
                      } as CSSProperties
                    }
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
                      className={
                        survivorsVisible &&
                        (residualIds.has(edge.sourceId) ||
                          residualIds.has(edge.targetId) ||
                          pendingIds.has(edge.targetId))
                          ? "is-surviving"
                          : ""
                      }
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
                {stopped
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
              <dd>—</dd>
            </div>
            <div>
              <dt>Time to quiescence</dt>
              <dd>—</dd>
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
          {survivorsVisible ? (
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
                    <code>QUEUED · COMMITTABLE</code>
                  </li>
                ))}
              </ul>
              <button className="advance-control" type="button" disabled>
                Advance logical time +5 min
              </button>
              <small>Next legal action · available in M3</small>
            </div>
          ) : (
            <p className="state-note">
              {ready
                ? "Ready for STOP."
                : "Result metrics remain unset until derived from shutdown events."}
            </p>
          )}
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
                  <tr key={event.eventId}>
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
      <footer className="workspace__footer">
        <span>
          <i />{" "}
          {stopped
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
