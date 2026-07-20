const regions = [
  ["01", "Quiescence Trace", "Recorded activity will appear here when a test begins."],
  ["02", "Shutdown Envelope", "Tested authority boundaries will appear after a sweep."],
] as const;

export function WorkspaceShell() {
  return (
    <section className="workspace" id="workspace" aria-labelledby="workspace-title">
      <header className="workspace__header">
        <div><span className="micro-label">Test instrument</span><h2 id="workspace-title">Cloud cleanup / standby</h2></div>
        <div className="workspace__meta"><span>Scenario not started</span><span>SIMULATION</span></div>
      </header>
      <div className="workspace__signals">
        {regions.map(([index, title, copy]) => <section className="signal-region" key={title} aria-labelledby={`region-${index}`}><span className="region-index">{index}</span><div><h3 id={`region-${index}`}>{title}</h3><p>{copy}</p></div><div className="signal-line" aria-hidden="true"><span /></div></section>)}
      </div>
      <div className="workspace__core">
        <section className="graph-region" aria-labelledby="graph-title"><div className="region-heading"><span className="region-index">03</span><h3 id="graph-title">Authority topology</h3></div><div className="empty-state"><div className="reticle" aria-hidden="true"><span /></div><p>Authority graph awaiting a deterministic run.</p><small>No topology is inferred before evidence exists.</small></div></section>
        <aside className="test-state" aria-labelledby="state-title"><div className="region-heading"><span className="region-index">04</span><h3 id="state-title">Test state</h3></div><dl><div><dt>Status</dt><dd>STANDBY</dd></div><div><dt>Invariants</dt><dd>—</dd></div><div><dt>Residual authority</dt><dd>—</dd></div><div><dt>Pending work</dt><dd>—</dd></div><div><dt>Escaped effects</dt><dd>—</dd></div><div><dt>Time to quiescence</dt><dd>—</dd></div></dl><p className="state-note">Metrics remain unset until derived from recorded events.</p></aside>
      </div>
      <section className="evidence-region" aria-labelledby="evidence-title"><div className="region-heading"><span className="region-index">05</span><h3 id="evidence-title">Evidence ledger</h3></div><nav aria-label="Evidence views"><span aria-current="page">Events</span><span>Causal proof</span><span>Explanation</span></nav><p>No events recorded. Start a shutdown test to create an append-only evidence trail.</p></section>
      <footer className="workspace__footer"><span><i /> Instrument ready</span><span>All effects are simulated</span></footer>
    </section>
  );
}
