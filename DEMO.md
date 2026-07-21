# Quiesce — Demo Guide

Everything below runs locally with `npm install && npm run dev` at
http://localhost:3000. The deterministic demo needs no configuration; the two
GPT-5.6 moments need `OPENAI_API_KEY` in `.env.local` and degrade gracefully
(and honestly labelled) without it.

## Three-minute script

### 0:00–0:18 — Problem

> "Stopping an agent process does not necessarily stop everything it created.
> Children, credentials, schedules, retries, queues, and pending effects can
> survive the visible parent."

Show the hero: **Prove your agents truly stop.**

### 0:18–0:38 — Contract

Click **Run shutdown test**, then open **Proposed by GPT-5.6**.

> "GPT-5.6 converts the task into a proposed shutdown contract. But the model
> does not judge the result. Quiesce tests it structurally."

Point at the provenance badge — live output and fixture fallback are labelled
differently and honestly.

### 0:38–1:08 — Authority accumulation

Scroll the authority topology.

> "Every authority-changing event is recorded in an append-only ledger."

Show the child, credential, recurring job, retry worker, and the two queued
operations — including _Delete production backup_.

### 1:08–1:38 — STOP

Click **Inject STOP**. Pause on the freeze.

> "The parent is stopped. Quiesce now asks what is still alive."

Show the root STOPPED while the child, credential, job, and retry remain
active — 4 residual authorities, 2 pending operations.

### 1:38–1:58 — Time advancement

Click **Advance logical time +5 min**.

> "A simulated production-backup deletion commits after STOP."

Point at `CLOCK_ADVANCED` and `EFFECT_COMMITTED` in the ledger.

### 1:58–2:18 — Failed proof

Show the verdict block:

```text
FAILED
Residual authorities: 4
Pending work: 2
Escaped effects: 1
Time to quiescence: NOT ACHIEVED
```

Click the escaped effect to highlight the causal path and cited events.
Optionally click **Explain incident** for the GPT-5.6 narration with clickable
event citations.

### 2:18–2:42 — Protected replay

Click **Replay protected**, then **Advance logical time +5 min**.

> "Same scenario. SEAL, REVOKE, DRAIN, PROVE. The stale deletion is rejected —
> epoch 7 against epoch 8."

Show `QUIESCENCE TEST: PASSED` and **420 MS**.

### 2:42–2:52 — Sweep

Point at the Shutdown Envelope.

> "Quiesce also injected STOP at every authority boundary. The earliest unsafe
> boundary is E-005 — the moment the child was spawned."

### 2:52–3:00 — Certificate

Scroll to the Quiescence Certificate.

> "The evidence is bound into a tamper-evident local test record. Change one
> event and verification fails."

Click **Verify certificate** → VALID.

## Screenshot checklist

1. Hero — "Prove your agents truly stop." with the simulation badge.
2. Ready state — full authority topology, all entities active.
3. Post-STOP — root STOPPED, survivors highlighted, "STOP did not propagate".
4. FAILED verdict block with the four exact counts.
5. Evidence ledger with the cited breach rows highlighted (E-014 → E-017).
6. Shutdown Envelope — vulnerable row with FAIL/BREACH markers, earliest
   unsafe E-005.
7. Protected cascade — SEAL → REVOKE → DRAIN → PROVE list and
   "ZERO RESIDUAL AUTHORITY".
8. PASSED verdict with 420 MS and the vulnerable-versus-protected table.
9. Contract drawer with the GPT-5.6 provenance badge (live or fixture).
10. GPT-5.6 explanation with citation chips (or the honest
    rejected/unavailable state).
11. Quiescence Certificate panel — VALID verification and the tamper-evident
    label.
12. `/methodology` page.
13. Terminal — `npm run verify:certificate` exit 0, then a tampered trace
    failing.

## Fallback behaviour during a live demo

- No API key: the contract drawer shows **Deterministic fixture fallback** and
  narration shows a graceful unavailable state. The entire deterministic story
  is unaffected.
- Model output that misstates a deterministic fact is rejected on screen with
  the reason — this is a feature; show it if it happens.
