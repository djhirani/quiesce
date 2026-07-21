# Quiesce — Judge's Guide

## What this is

An executable shutdown-assurance test harness for autonomous agents. It proves
— from an append-only event log — whether anything an agent created can still
act after STOP, then binds the evidence into a tamper-evident local test
record. All infrastructure and effects are deterministic simulations.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 — no configuration required
```

Optional: copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` to see
the two live GPT-5.6 moments. Without a key, honestly-labelled fallbacks appear
and the deterministic story is unchanged.

## What you should observe (the acceptance walkthrough)

1. A legitimate agent run accumulates authority (child, credential, schedule,
   retry worker, two queued operations).
2. You press **Inject STOP**. The root stops. Other authority remains alive.
3. You press **Advance logical time +5 min**. A material simulated effect
   commits after STOP.
4. The event ledger proves the path; the test **FAILS** with exact counts
   (4 residual · 2 pending · 1 escaped · TTQ NOT ACHIEVED).
5. The Shutdown Envelope reveals the earliest authority boundary where
   shutdown becomes unsafe (E-005) — every marker is a complete replayed run.
6. **Replay protected**: authority epoch advancement and commit fencing reject
   the same stale effect. Residual authority reaches zero. Time to Quiescence
   is measured: **420 ms**.
7. The evidence is bound into a tamper-evident certificate. Click **Verify
   certificate**, or offline:

```bash
npm run verify:certificate -- certificate.json trace.jsonl
```

Download both files from the certificate panel first; edit any byte of the
trace and verification fails with a precise reason.

## Where to look

| Concern                       | Location                                            |
| ----------------------------- | --------------------------------------------------- |
| Deterministic engine          | `lib/engine/`, `lib/domain/`, `lib/fixtures/`       |
| Runtime adapter boundary      | `lib/adapters/runtime-adapter.ts`                   |
| Quiescence sweep              | `lib/engine/sweep.ts`                               |
| Bounded GPT-5.6 + fail-closed | `lib/ai/`, `app/api/`                               |
| Certificate + hashing         | `lib/certificate/`, `scripts/verify-certificate.ts` |
| Tests (97 unit + 15 e2e)      | `tests/`                                            |
| Methodology                   | `/methodology` in the running app                   |

## Validation commands

```bash
npm run format && npm run lint && npm run typecheck
npm run test          # engine, ai, certificate — fully deterministic, no network
npm run test:e2e      # Playwright at desktop, laptop, and mobile widths
npm run build
npm run scan:secrets
```

## Honesty boundaries

- No real cloud account, credential, queue, webhook, destructive operation, or
  background agent. Every destructive-looking payload contains
  `simulated: true`.
- GPT-5.6 has two bounded roles only (contract proposal, cited explanation).
  It never determines PASS/FAIL, counts, status, or time; unknown citations
  fail closed; fallbacks are never presented as live output.
- The certificate is a **tamper-evident local test record** — not a legal
  certificate, not a compliance guarantee, and not proof against a party who
  can regenerate every hash.
