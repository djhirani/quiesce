# Quiesce

Quiesce is an executable shutdown-assurance test harness for autonomous agents. This repository currently contains the M0 application and design foundation only; it does not yet implement a simulation.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run format
npm run lint
npm run typecheck
npm run test:smoke
npm run test:e2e
npm run build
git diff --check
```

All presented infrastructure and effects are deterministic simulations. No real infrastructure is connected.
