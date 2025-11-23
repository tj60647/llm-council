# LLM Council Roadmap (Updated: 2025-11-23)

This roadmap reflects the completed migration from a FastAPI + Vite stack to a Next.js (App Router) implementation and outlines cleanup plus forward-looking enhancements.

## Guiding Principles

- Keep orchestration logic framework-agnostic (pure functions in `lib/council`).
- Never expose `OPENROUTER_API_KEY` to the client.
- Streaming must remain incremental, resilient, observable.
- Storage should be serverless-compatible and pluggable.
- Visualizations surface reasoning transparency (stages, rankings, synthesis provenance).

## Phase 0: Decision & Inventory (Complete)

- Chosen path: Full Next.js migration.
- Identified council logic for reuse.
- Visualization & dynamic model selection approved.

## Legacy Cleanup (Completed)

Python FastAPI and Vite stacks fully removed (tag `legacy-pre-removal` preserves history). Architecture now unified under Next.js.

Removed artifacts: backend directory, root Python entrypoints, uv/pyproject files, start script, legacy data JSON. Documentation updated (`README.md`, `ARCHITECTURE.md`).

Benefits: reduced maintenance surface, single dependency set, simpler deployment, clearer contribution path.

## Phase 1: Project Scaffolding (Complete)

Created Next.js app, moved components, established `lib/` modules.

## Phase 2: Model Catalog & Selection (Complete)

Implemented `/api/models` with caching; seat metaphor for selection and per-conversation editing.

## Phase 3: Storage Abstraction (In Progress)

Adapter interface established (`lib/storage/index.js`). Next: implement Redis/Postgres adapter and migration tooling.

## Phase 4: API Routes & Streaming (Complete / Iterating)

SSE implemented with stage events and title update; improved dynamic param handling.

## Phase 5: Council Logic Port (Complete)

Prompts translated; anonymization maintained; ranking parsing & aggregation live.

## Phase 6: Sankey Visualization (Complete / Enhancing)

Skeleton renders immediately; dynamic link coloring (pending grey, completion blue, ranking gradient green→orange). Upcoming: legend, tooltips, adjustable weight scheme.

## Phase 7: Frontend Integration & UX (Ongoing)

Separate panels, header, seat metaphor completed. Upcoming: chairman seat highlight, collapsible panels, conversation filtering.

## Phase 8: Environment & Security (Pending)

Audit for secret leakage; add lint rule; implement basic rate limiting post-persistence.

## Phase 9: Documentation & Reuse (Pending)

Update README (remove legacy stack, add deployment & SSE notes); section on embedding council core; consider publishable package.

## Phase 10: Local & Deployment Validation (Upcoming)

Validate `vercel dev` SSE parity; capture performance metrics; finalize Next.js version upgrade.

## Backlog / Nice-to-Have (Updated)

- Cost estimation per conversation.
- Prompt response caching.
- Diff view between top response vs synthesis.
- Conversation export (JSON).
- Auth / multi-user isolation.
- Ranking weight tuning UI.
- Persistence adapters (Redis, Postgres, KV) with plug interface.
- Sankey legend & hover tooltips.

## Milestone Summary (Updated)

- M1: Scaffold + base routes + ported logic.
- M2: Model picker + stable SSE + memory store.
- M3: Sankey visualization initial.
- M4: UX reorg (seats, panels, header).
- M5: Dynamic coloring + seat editing API.
- M6: Legacy stack removed; persistence adapter live; security audit.
- M7: Package extraction + advanced analytics.

## Risks & Mitigations

| Risk                       | Mitigation                                                   |
| -------------------------- | ------------------------------------------------------------ |
| SSE buffering on Vercel    | Use Node runtime; keep events small; monitor logs.           |
| Model catalog latency      | Cache with TTL; fallback minimal static list if fetch fails. |
| Ranking parse fragility    | Strict prompt formatting; test regex; fallback safe order.   |
| Storage vendor limits      | Abstraction layer; configurable adapter; pagination on list. |
| Key leak via client bundle | Lint rule + CI grep; restrict env usage to server files.     |
| Visualization performance  | Limit node count; dynamic sizing; debounce repaint.          |

## Next Actions

1. Implement Redis adapter + migration script from memory.
2. Security review (env usage lint + rate limiting strategy).
3. Sankey legend & tooltips.
4. Finalize Next.js version lock; add dependency audit step.
5. Metrics: stage latency + per-model timing.
6. Cost estimation prototype.

## Post-Cleanup Checklist (Reference)

- [x] Legacy references grep
- [x] Tag before removal
- [x] Delete legacy directories & files
- [x] Update README & ROADMAP
- [x] Build & smoke test
- [x] Document architecture (`ARCHITECTURE.md`)
