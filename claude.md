# Node-Based ML Strategy & Backtesting

Purpose: A browser-based Svelte + Tailwind (DaisyUI) app with Monaco DSL editor that
compiles strategy pipelines to an executable DAG and runs training/backtests in
Docker-sandboxed nodes (Python, JS, WASM). Output: metrics, trade logs, artifacts.

## Tech Stack
- Frontend: Svelte + Tailwind (DaisyUI), Monaco
- Backend: Node.js (compiler/orchestrator, API)
- Sandboxes: Docker (python, node, wasm)
- ML: PyTorch / TensorFlow in python sandbox
- Data: local CSV/Parquet; artifacts to /artifacts

## Structure (read before coding)
- apps/web/                # Svelte UI (DSL editor, results)
- services/api/            # REST endpoints (runs, artifacts)
- services/compiler/       # DSL → plan.json (validate schemas)
- services/executor/       # DAG runner (launches sandboxes)
- nodes/python/            # Python nodes (features, label, train, infer)
- nodes/js/                # JS nodes (transforms, glue)
- nodes/wasm/              # WASM modules (perf-critical ops)
- docker/                  # sandbox images & compose
- datasets/                # sample OHLCV
- artifacts/               # models, logs, reports
- tests/                   # unit/integration (TDD first)

## Commands (use these; don’t guess)
# web
pnpm --filter apps/web dev                # UI dev
pnpm --filter apps/web test               # UI tests

# backend
pnpm --filter services/api dev
pnpm --filter services/compiler test
pnpm --filter services/executor test

# sandboxes & data
docker compose up -d                      # start runners
pytest -q                                 # python node tests
npm run lint && npm run test              # repo-wide checks

## Guardrails (enforced by tooling, not prose)
- TDD: write a failing test, then minimal code, then refactor. No skipping.
- Lint/format on commit; conventional commits required.
- Executor starts only if tests are green.

## How to ask Claude (patterns)
- Start in **plan** mode: enumerate steps, files to read, and risks.
- Point to examples over long instructions:
  - e.g., “mirror nodes/python/LabelingNode.py test style”
- Avoid auto-accept; prefer step-by-step approval.

## Context discipline
- Keep context lean. When compacting, **preserve**:
  - DSL grammar & validator constraints
  - Node IO schemas (features, labels, signals, orders)
  - Sandbox run contract (stdin/stdout JSON, time/mem limits)
  - TDD failures and their fix outline

## Non-goals for the agent
- Don’t invent new frameworks, services, or infra.
- Don’t bypass Docker sandboxes or resource limits.
- Don’t fetch external data unless a Data node is configured.

## Definitions (quick)
- “Node”: code with {params, inputs, outputs}. Must pass its tests.
- “Plan”: plan.json DAG compiled from DSL with validated edges & schemas.

## Examples to reference
- nodes/python/FeatureGeneratorNode.py
- nodes/python/ModelTrainerNode.py
- services/compiler/tests/ (DSL fixtures & negative cases)
