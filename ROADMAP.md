# LLM Council Roadmap (Revised: 2026-07-31)

Full audit and reset of the roadmap after a five-month idle period. The previous
roadmap (2025-11-23) is superseded by this document; its phase history is
summarized under "Where the project was."

## Where the project was (audit summary)

- Fork of `karpathy/llm-council`, fully migrated to a single Next.js App Router
  app (Nov 2025). Python/Vite legacy removed.
- Deployed on Vercel from `origin/master`. Vercel's bot patched the React
  Server Components CVE (merged Feb 2026); an older duplicate CVE branch
  (`vercel/react-server-components-cve-vu-lpg9lr`) is stale and should be
  deleted on GitHub.
- Local `master` had diverged: an unpushed commit (Jul 31) upgraded Next
  15→16.1.1 / React 18→19, added vitest + first API tests, and fixed two
  client/API contract bugs. Now merged with `origin/master` (kept Next 16;
  it postdates the CVE-patched versions).
- `origin/claude/add-claude-documentation` (CLAUDE.md) is now merged.

## Why the deployment was broken (diagnosis, 2026-07-31)

Stacked causes — each alone was fatal:

1. **Client/API contract mismatches** (deployed code): `page.jsx` treated the
   `GET /api/conversations` response `{ adapter, conversations, count }` as an
   array → crash on first render. Create + select conversation had the same
   wrapper-object bug. Fixed (create/list were fixed in the unpushed commit;
   select fixed in this pass).
2. **In-memory storage on serverless**: conversations lived in one lambda
   instance's memory; any other instance (or cold start) returned 404. The
   Redis adapter was a throwing stub. Fixed: real Upstash Redis adapter,
   auto-selected when Upstash/KV env vars exist.
3. **Retired default models**: 2 of 3 default seats no longer exist on
   OpenRouter (`google/gemini-3-pro-preview` — the chairman — gone;
   `x-ai/grok-4` retired 2026-05-17). Councils returned mostly-null stages
   even where the plumbing worked. Fixed: defaults refreshed to IDs verified
   live on 2026-07-31.
4. **Serverless duration limits**: council runs are multi-minute;
   routes now export `maxDuration = 300`.
5. **(Unverified from here)** `OPENROUTER_API_KEY` must exist in Vercel
   project env — confirm in dashboard.

## Guiding principles (unchanged)

- Council orchestration stays framework-agnostic (`lib/council` pure functions).
- `OPENROUTER_API_KEY` never reaches the client.
- Streaming stays incremental and observable.
- Storage stays pluggable and serverless-compatible.

## Phase A: Working deployment (DONE in repo; needs dashboard config + push)

- [x] Reconcile master ↔ origin/master divergence.
- [x] Fix remaining contract bug (conversation select).
- [x] Fix Next 16 async `params` in `[id]/models` route (seat editing 404'd).
- [x] Async storage facade + Upstash Redis adapter + tests.
- [x] Refresh default council to live models (Gemini 3.1 Pro Preview chairman,
      GPT-5.5, Claude Sonnet 5, Grok 4.5).
- [x] `maxDuration = 300`; SSE chunks properly byte-encoded.
- [x] Title generation goes through the storage adapter (was memory-only
      side effect); `title_complete` now updates the sidebar live.
- [ ] **User action**: create Upstash Redis via Vercel Marketplace (sets
      `UPSTASH_REDIS_REST_URL/TOKEN` or `KV_REST_API_URL/TOKEN`), confirm
      `OPENROUTER_API_KEY` env var, then push master and redeploy.
- [ ] Smoke-test deployed `/api/health` (should report `adapter: "redis"`).

## Phase B: Robustness (next up)

- Model validity guard: on conversation create, validate seat IDs against the
  cached catalog; surface dead seats in the UI instead of silent nulls.
  (Models retire constantly — this is what actually rotted first.)
- SSE client parser: buffer partial events across chunk boundaries.
- Per-stage error surfaces in UI (model X failed vs whole-run failure).
- Heartbeat/keepalive event every ~15s so proxies don't kill idle streams
  during long stage runs.
- Rate limiting (per-IP token bucket) now that storage exists to back it.

## Phase C: Product polish

- Sankey legend + tooltips; per-link latency overlay (existing backlog).
- Cost estimation per conversation (OpenRouter returns usage).
- Conversation delete + export (JSON).
- Chairman seat selection in UI (currently seat 0 by convention).

## Phase D: Stretch

- Auth / multi-user isolation (storage keys already namespaced per conversation).
- Extract `lib/council` as a publishable package.
- Weighted ranking schemes (Borda, median).

## Standing maintenance

- Default model IDs rot; re-verify quarterly or on empty-council reports
  (`lib/config/models.js` documents the last-verified date).
- Keep Next.js patched — subscribe to the Vercel CVE bot PRs instead of letting
  them sit (the Jan+Feb 2026 pair diverged master for five months).
- `npm audit` on dependency bumps.

## Deployment checklist (reference)

1. Vercel project → Storage → add Upstash for Redis (or set
   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` manually).
2. Vercel project → Settings → Environment Variables → `OPENROUTER_API_KEY`.
3. `git push origin master` (triggers deploy).
4. Delete stale branch `vercel/react-server-components-cve-vu-lpg9lr` on GitHub.
5. Verify: `GET /api/health` → `{ status: "ok", adapter: "redis" }`;
   create conversation → refresh page → conversation persists;
   send prompt → three stages stream and complete.
