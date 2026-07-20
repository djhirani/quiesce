import { Wordmark } from "@/components/brand/wordmark";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__grid" aria-hidden="true" />
        <header className="hero__nav">
          <Wordmark />
          <span className="simulation-badge"><i /> Deterministic simulation</span>
        </header>
        <div className="hero__content">
          <p className="eyebrow"><span>Shutdown assurance</span><span>System 01</span></p>
          <h1 id="hero-title">Prove your agents<br />truly stop.</h1>
          <p className="hero__lede">A stopped parent is not proof that everything it created stopped with it.</p>
          <a className="run-button" href="#workspace"><span>Run shutdown test</span><span aria-hidden="true">→</span></a>
        </div>
        <div className="hero__disclosure"><span className="status-dot" />Deterministic simulation <b>·</b> No real infrastructure</div>
      </section>
      <WorkspaceShell />
    </main>
  );
}
