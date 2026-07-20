# Quiesce Project Constitution

Quiesce is a separate project. Never inspect, modify, copy from, deploy, rename, or otherwise change ActionLens, ForkTrace, or any unrelated repository unless the user explicitly asks. Before every milestone, verify the exact repository path, current branch, git status, package manager, framework version, current scripts, and current app structure. Report these facts before editing.

## Product

Quiesce is an executable shutdown-assurance test harness for AI-agent systems. It injects STOP, records the event, advances deterministic logical time, and proves whether child agents, delegated credentials, scheduled jobs, retry workers, queue items, or pending effects remain capable of acting.

The core deterministic cloud-cleanup demo must eventually cover vulnerable shutdown, a protected SEAL → REVOKE → DRAIN → PROVE replay, and a Quiescence Sweep. Implement these only in their designated milestones.

## Non-negotiable architecture

1. The append-only numbered event log is the sole source of truth.
2. Entity state, graph state, metrics, Quiescence Trace, Shutdown Envelope, animation cues, certificate, and explanations derive from events.
3. No UI component may invent a survivor, metric, event, status, or time.
4. Simulation is deterministic and in memory.
5. No real cloud account, credential, destructive operation, queue, webhook, or background autonomous agent.
6. Every destructive-looking payload contains `simulated: true`.
7. The recorder stores facts only. The verifier derives semantic findings such as escaped effects.
8. Every material effect revalidates authority at commit time.
9. Protected STOP must seal the commit gate before revocation traversal.
10. GPT-5.6 is limited to proposing a shutdown contract and explaining deterministic findings with exact event-ID citations.
11. GPT-5.6 never determines PASS/FAIL, counts, status, or time.
12. Unknown model citations fail closed.
13. Structural results work without the model endpoint.
14. The deterministic core depends on an `AgentRuntimeAdapter` interface, not a specific agent framework.
15. Do not rely on persistent filesystem writes in deployed serverless code.

## Product experience

Quiesce must feel like a premium infrastructure control-room instrument, not a generic AI dashboard. Use one dominant authority topology, one Quiescence Trace, one Shutdown Envelope, one test-state rail, and one evidence ledger. Use deep neutral surfaces, precise typography, semantic signal colors, one-pixel borders, restrained shadows, and disciplined Motion animations. No purple AI gradients, chat UI, excessive glass, fake terminal, decorative explosions, or card-grid clutter.

Animation explains evidence. Use event-driven focus cues, preserve event order, support `prefers-reduced-motion`, and do not animate every edge continuously.

## Quality and work method

- Use TypeScript strict mode, Zod validation, pure deterministic engine tests, Playwright for decisive user flows, and accessible primitives/native controls.
- No console errors, secrets, unrequested deployment, push, branch creation, external-service change, or paid API use.
- Explain dependencies. Do not proceed to the next milestone, mask failing tests, delete tests to make the suite pass, reformat unrelated files, or replace working architecture without necessity.
- Inspect first; state the milestone goal and hard gate; list intended files; implement the smallest coherent vertical slice; run format, lint, typecheck, relevant tests, production build, and `git diff --check`; fix only milestone-related failures; review UI milestones in a real browser at laptop and mobile widths; report exact outcomes, files, limitations, and Git status; then stop.
- When the specification conflicts with the repository, preserve product invariants and explain the smallest safe adaptation before editing.

The authoritative full specification remains `quiesce-final-blueprint-and-codex-prompts.md` supplied by the project owner. This file captures its Master Prompt and non-negotiable invariants for repository-local guidance.
