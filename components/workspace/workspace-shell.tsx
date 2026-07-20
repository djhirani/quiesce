import type { RuntimeSnapshot } from "@/lib/adapters/runtime-adapter";

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

export function WorkspaceShell({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const started = snapshot.events.length > 0;
  const ready = snapshot.phase === "ready_to_stop";
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
            Cloud cleanup / {ready ? "ready to stop" : "standby"}
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
                {started
                  ? "No shutdown evidence recorded in this milestone."
                  : title === "Quiescence Trace"
                    ? "Recorded activity will appear here when a test begins."
                    : "Tested authority boundaries will appear after a sweep."}
              </p>
            </div>
            <div className="signal-line" aria-hidden="true">
              <span />
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
            <div className="topology" aria-label="Current authority topology">
              <ol className="topology__nodes">
                {graphEntities.map((entity) => (
                  <li
                    className={`topology-node topology-node--${entity.kind}`}
                    key={entity.id}
                  >
                    <span>{kindLabels[entity.kind]}</span>
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
                    <li key={edge.id}>
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
              <dd>{ready ? "SCENARIO_READY" : "STANDBY"}</dd>
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
              <dd>—</dd>
            </div>
            <div>
              <dt>Pending work</dt>
              <dd>—</dd>
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
          <p className="state-note">
            {ready
              ? "Ready for STOP. Shutdown evaluation begins in M2."
              : "Result metrics remain unset until derived from shutdown events."}
          </p>
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
          <i /> {ready ? "Scenario ready" : "Instrument ready"}
        </span>
        <span>All effects are simulated</span>
      </footer>
    </section>
  );
}
