# Quiesce

**An executable shutdown-assurance test harness for autonomous agents.**

## The problem

Stopping an agent process does not necessarily stop everything it created.
Children, delegated credentials, scheduled jobs, retry workers, queued
operations, and pending effects can survive the visible parent — and can still
act after the operator believes the system is off. A stopped parent is not
proof of a stopped system.

## The product

Quiesce injects STOP into a running agent scenario, records every
authority-changing event in an append-only ledger, advances deterministic
logical time, and proves — from event evidence alone — whether anything
remained capable of acting. It measures Time to Quiescence, discovers the
earliest unsafe shutdown boundary, and binds the result into a tamper-evident
local test record.

## Separation from other projects

Quiesce is an independent, self-contained project. It shares no code, data,
runtime, deployment, or identity with ActionLens, ForkTrace, or any other
repository.

## Architecture

The append-only event log is the sole source of truth. Everything on screen is
a projection of events; no component may invent a survivor, metric, or time.

```mermaid
flowchart TB
    subgraph Deterministic core
        CMD[Commands] --> HANDLER[Command handler]
        HANDLER --> SCENARIO[Cloud-cleanup scenario]
        SCENARIO --> STORE[(Append-only event log)]
        CLOCK[Logical clock] --> SCENARIO
        FENCE[Commit fence · authority epochs] --> SCENARIO
        STORE --> PROJ[Projectors]
        PROJ --> VERIFIER[Quiescence verifier]
        STORE --> SWEEP[Quiescence sweep]
    end
    ADAPTER[AgentRuntimeAdapter] --> HANDLER
    subgraph UI
        WORKSPACE[Control-room workspace] --> ADAPTER
        PROJ --> WORKSPACE
        VERIFIER --> WORKSPACE
        SWEEP --> WORKSPACE
    end
    subgraph Bounded GPT-5.6
        COMPILE[/api/compile-contract/] --> OPENAI[(Responses API)]
        EXPLAIN[/api/explain-incident/] --> OPENAI
        VALIDATE[Citation validator · fail closed] --> EXPLAIN
    end
    subgraph Certificate
        STORE --> CANON[Canonical serializer]
        CANON --> CHAIN[Event hash chain]
        CHAIN --> CERT[Quiescence Certificate]
        VERIFIER --> CERT
        CERT --> CLI[verify:certificate CLI]
    end
```

## The exact demo

1. **Run shutdown test** — the simulated cleanup agent performs legitimate
   work, spawns a child, issues a temporary credential, schedules recurring
   cleanup, enables a retry worker, and queues two operations.
2. **Inject STOP** — a deliberately vulnerable shutdown stops only the root.
   The child, credential, schedule, retry worker, and queues survive.
3. **Advance logical time +5 min** — the recurring job triggers and a simulated
   production-backup deletion commits _after_ STOP. The test fails with exact
   event evidence: 4 residual authorities, 2 pending work items, 1 escaped
   effect, Time to Quiescence NOT ACHIEVED.
4. **Replay protected** — the same scenario replays with SEAL → REVOKE → DRAIN
   → PROVE: the authority epoch advances, the commit gate seals, queues and
   schedules cancel, retries disable, credentials revoke, descendants
   terminate. The same delayed deletion is rejected as stale. The test passes
   with zero residual authority and a measured Time to Quiescence of 420 ms.

## Quiescence Sweep

The sweep replays the scenario and injects STOP after every authority-changing
event, under both policies. Each marker in the Shutdown Envelope is a complete
run with its own verdict, exposing the earliest unsafe boundary (E-005, the
child spawn) and the worst breach point (E-010, the queued backup deletion).

## Commit fence

Every material effect revalidates authority at commit time. A protected STOP
seals the commit gate and advances the authority epoch before revocation
traversal, so work issued under an older epoch is rejected when it finally
tries to commit — recorded as `STALE_AUTHORITY_REJECTED` and `EFFECT_REJECTED`.

## Certificate

After a completed test, Quiesce exports a canonical snake_case JSONL trace with
a SHA-256 event hash chain and a certificate binding the contract hash, trace
hash, and verifier result into a deterministic certificate ID. Verify offline:

```bash
npm run verify:certificate -- certificate.json trace.jsonl
```

It is a **tamper-evident local test record** — not a legal certificate and not
a compliance guarantee.

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000. The full deterministic demo works with no
configuration and no network access.

## Environment variables

| Variable         | Required | Purpose                                                                                                                                                                                              |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY` | No       | Enables the two bounded GPT-5.6 roles (contract proposal, incident narration). Without it, a deterministic fixture and a graceful unavailable state are used and labelled as such. Server-side only. |

Copy `.env.example` to `.env.local` to configure locally.

## Test commands

```bash
npm run format        # prettier check
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run test          # all unit tests (engine, ai, certificate)
npm run test:e2e      # Playwright, desktop + laptop + mobile
npm run build         # production build
npm run scan:secrets  # repository secret scan
```

## Honesty statement

All presented infrastructure and effects are deterministic simulations. No real
cloud account, credential, queue, webhook, or destructive operation is
involved; every destructive-looking payload contains `simulated: true`. GPT-5.6
never determines PASS/FAIL, counts, status, or time, and fallback content is
never presented as live model output. Structural results work without the model
endpoint.

## Limitations

- One fixed deterministic scenario; the verifier covers the seven declared
  shutdown invariants only.
- The certificate is SHA-256 tamper evidence, not identity signing; it does not
  protect against a party who can regenerate every hash.
- Results say nothing about agent frameworks or infrastructures that have not
  been bound to the adapter interface.

## Future adapters

The deterministic core depends only on the `AgentRuntimeAdapter` interface
(start, inject STOP, advance logical time, inspect). Real-runtime adapters —
process supervisors, orchestration frameworks, cloud control planes — can bind
the same STOP → evidence → verdict loop to live systems without changing the
engine.

See `/methodology` in the running app for the full derivation of every metric.
