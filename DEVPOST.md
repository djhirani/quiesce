# Quiesce — Devpost Submission Draft

> Fill the bracketed placeholders before submitting. Everything else is
> accurate to the repository.

**Submission title:** Quiesce — prove your agents truly stop

**Team:** [team / builder name]

**Track / category:** [prize track]

## Inspiration

Every serious agent incident postmortem has the same sentence in it: "we
stopped the agent." Stopping the process you can see says nothing about the
children it spawned, the credentials it delegated, the schedules it armed, or
the work it queued. We wanted the claim "it stopped" to be _testable_ — an
executable proof, not an assumption.

## What it does

Quiesce is an executable shutdown-assurance test harness. A simulated
cloud-cleanup agent accumulates real-shaped authority: a child agent, a
temporary credential, a recurring job, a retry worker, two queued operations.
You press STOP. A deliberately vulnerable shutdown stops only the root — then
you advance deterministic logical time and watch a simulated production-backup
deletion commit _after_ STOP. Quiesce fails the test with exact event evidence.

The same scenario then replays under a protected protocol — SEAL → REVOKE →
DRAIN → PROVE — where authority epochs and a commit fence reject the same stale
deletion. The test passes with zero residual authority and a measured Time to
Quiescence of 420 ms.

A Quiescence Sweep injects STOP after every authority-changing event to find
the earliest boundary where shutdown becomes unsafe, and every completed run is
bound into a tamper-evident local test record with an offline CLI verifier.

## How we built it

- **Deterministic event-sourced core** (TypeScript, strict): an append-only
  event log is the sole source of truth; every metric, graph state, and
  verdict is a projection of events. Fixed logical clock, fixed test epoch —
  every run is byte-identical.
- **Runtime adapter boundary:** the engine depends on an `AgentRuntimeAdapter`
  interface, not a specific agent framework.
- **Bounded GPT-5.6** (official OpenAI SDK, Responses API, strict structured
  output): the model proposes a shutdown contract and narrates deterministic
  findings with event-ID citations. It never determines PASS/FAIL, counts, or
  time. A fail-closed validator rejects unknown citations and misstated facts
  — we watched it reject a live model output that misclassified a queue item
  as a surviving authority.
- **Tamper-evident certificate:** canonical JSON serialization, SHA-256 event
  hash chain, contract and trace hashes, deterministic certificate ID, and a
  CLI (`npm run verify:certificate`) that re-derives everything from the
  exported files alone.
- **Next.js control-room UI** with a premium instrument aesthetic, full
  keyboard access, live-region announcements, and reduced-motion support.

## Challenges we ran into

Keeping the model honest was the hard part — not prompting it to be right, but
making it _impossible_ for it to be wrong on screen. Every factual claim must
cite allow-listed event IDs, survivors must be exactly the deterministic
residual authorities, and any deviation falls back to the structural evidence.
Canonical serialization was the other: one byte-stable JSONL representation
shared by the browser, the tests, and the CLI so hashes mean the same thing
everywhere.

## Accomplishments we're proud of

- A shutdown claim that is _executed_, not asserted — with the failing case
  demonstrated first.
- The fail-closed GPT boundary catching a real live-model factual error during
  testing and keeping the deterministic verdict authoritative.
- 97 deterministic tests plus full Playwright coverage at three viewports.

## What we learned

Shutdown is an authority problem, not a process problem. The interesting
boundary is not "is the process alive" but "can anything still commit a
material effect" — and that question is answerable from an event log.

## What's next

Real-runtime adapters (process supervisors, orchestration frameworks, cloud
control planes) behind the same `AgentRuntimeAdapter` interface, richer
scenario libraries, and multi-agent authority topologies.

## Built with

TypeScript · Next.js · React · Zod · OpenAI SDK (Responses API, gpt-5.6) ·
Web Crypto (SHA-256) · Vitest · Playwright

## Try it

```bash
npm install && npm run dev
```

Everything is a deterministic simulation — no real infrastructure, no real
credentials, and every destructive-looking payload carries `simulated: true`.
