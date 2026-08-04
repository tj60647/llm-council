# Architecture & Internals

This document provides a concise, up-to-date overview of the LLM Council architecture (Next.js edition). Legacy Python/Vite implementation has been removed; see the `legacy-pre-removal` tag in git history if needed.

## High-Level Flow

1. User sends prompt.
2. Stage 1: Parallel model responses.
3. Stage 2: Peer evaluations with anonymized labels (Response A, B, ...).
4. Aggregate rankings (average position across evaluations).
5. Stage 3: Chairperson synthesis referencing all prior context.
6. Streaming events (SSE) deliver incremental updates to client.

## Key Modules

- `lib/council/*`: Pure functions for each stage + ranking parse + title generation.
- `lib/openrouter/*`: Thin wrappers around OpenRouter API requests; all server-side usage.
- `lib/storage/index.js`: Async storage facade; selects Upstash Redis when configured, else memory.
- `app/api/*`: Route handlers (Node runtime) orchestrating multi-stage processing and streaming.
- `components/SankeyCouncil.jsx`: Visualization of stage transitions, rankings, and synthesis provenance.
- `components/ModelRing.jsx`: Seat metaphor enabling dynamic model selection & per-conversation overrides.

## Streaming Protocol (SSE)

Events emitted (JSON via `data:` lines):

- `stage1_start` / `stage1_complete`
- `stage2_start` / `stage2_complete` (includes mapping + aggregate rankings)
- `stage3_start` / `stage3_complete`
- `title_complete` (if first message async title generated)
- `complete` / `error`

Client consumes these to update UI panels and color Sankey links.

## Ranking & Anonymization

- Responses labeled in prompt as `Response A`, `Response B`, etc.
- `label_to_model` mapping retained server-side and sent in metadata.
- Parsing extracts ordered labels from model evaluation text (strict format + fallbacks).
- Aggregate ranking averages index positions; tie handling remains simple (future: weighted schemes).

## Storage Abstraction

Interface methods (all async): `createConversation`, `listConversations`, `getConversation`, `updateTitle`, `addUserMessage`, `addAssistantMessage`, `updateConversationModels`, `conversationCount`.

Adapter selection (`lib/storage/index.js`): `STORAGE_ADAPTER` env wins (`memory` | `redis`); otherwise Redis auto-activates when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*`) are present, else memory.

- Memory adapter persists via `globalThis` for dev hot-reload stability. Not viable on serverless — instances don't share memory.
- Redis adapter (`lib/storage/redis.js`, @upstash/redis REST client): conversations as JSON under `council:conv:{id}`, ordering via zset `council:conv:index` scored by creation time. Whole-object read-modify-write — fine single-user, revisit for concurrency.

## Seat Metaphor

- Seats are ordered array of models (index 0 currently chairperson by default).
- Conversations snapshot seat configuration at creation; can be edited later.
- Cap of 7 models enforced for visualization clarity and prompt size management.

## Visualization Design

- Sankey nodes: Prompt → Individual Responses → Evaluations → Aggregate → Synthesis.
- Link coloring:
  - Grey: Pending
  - Blue: Completed stages
  - Gradient Green→Orange: Ranking quality (lower average → greener)
- Future: Legend + tooltips + per-link latency overlay.

## Model Catalog

`lib/openrouter/registry.js` fetches the catalog from the **OpenRouter Registry**
(`MODEL_REGISTRY_URL`, default `https://openrouter-registry.aroughidea.com`), a
synced mirror that retains retired models with `isAvailable: false` and a
`retiredAt` date. OpenRouter's own `/api/v1/models` lists only live models, so a
seat pointing at a retired id is indistinguishable from a typo — it simply
returns nothing, which is how this app broke in early 2026.

- Paged at the registry's 500-record maximum; a short page or reaching the
  reported total ends the loop, and hitting the page cap logs rather than
  silently truncating.
- Registry prices are per 1K tokens and are converted to the per-token figures
  the UI formatter expects.
- Falls back to OpenRouter direct if the registry is unreachable; the response
  reports `source` so the degradation is visible.
- `checkModelIds()` separates **retired** from **unknown** ids. The UI marks
  affected seats in red with a warning, and the picker hides retired models
  behind a "show N retired" toggle.

## Join QR Codes

`lib/qr.js` renders the SVG behind `GET /api/admin/qr?code=…` (admin-gated,
cached per join URL — a code's QR never changes). Encodes `/?join=CODE`, which
prefills the enrolment box, and uses error-correction level H so it survives
being photographed off a projector.

Rendered **locally** by default (`qrcode`), because the QR is projected during a
live workshop and must not depend on a cold-starting external service. Set
`QRSTUDIO_API_KEY` to render via QR Studio's MCP `generate_qr` tool instead
(styled dots, logo overlay); that path falls back to local rendering on any
error, and the response reports which `source` produced it.

`components/JoinPresenter.jsx` is the full-screen projector view: group name,
QR, the code at ~7vw, and the URL.

## Access Control (optional)

Feature-flagged on the presence of `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` +
`AUTH_SECRET`; absent → open single-user mode (identity `local@anonymous`,
admin). When enabled:

- `lib/auth/session.js`: HS256 JWT session cookies (`jose`), 7-day TTL. The
  JWT carries identity only; authorization is read live per request.
- `lib/auth/github.js`: authorization-code flow; no `redirect_uri` sent, so
  GitHub uses the OAuth app's registered callback (one app per environment).
- `lib/auth/guard.js`: `requireUser`/`requireAdmin` resolve session → user →
  group and window; `checkSeatModels` enforces group model sets;
  `consumeRun` enforces per-day caps (Redis INCR, 48h TTL keys);
  `ownsConversation` scopes data per user. Admins (`ADMIN_EMAILS`) bypass.
- Storage keys: `auth:group:{id}`, `auth:groupcode:{CODE}`, `auth:user:{email}`,
  `auth:runs:{email}:{date}`; conversations gain `owner` and a per-owner
  index `council:convs:{email}`.
- Enrollment: pre-created user record (allowlist) or `POST /api/auth/enroll`
  with a group join code. Revocation and group edits apply on the next request.
- `/admin` (client) + `/api/admin/*`: groups CRUD, members, usage counts.

## Environment & Secrets

- `OPENROUTER_API_KEY` only accessed in server files; never exposed to client bundle.
- Use `.env.local` for local dev; do not commit keys.

## Extensibility Targets

- Persistence adapters (Redis/Postgres/KV).
- Rate limiting & usage metrics (stage latency, cost estimation).
- Export & replay (conversation JSON, reproducible synthesis).
- Weight-adjusted ranking aggregation (e.g., median, Borda variants).

## Removed Legacy

All Python FastAPI + Vite assets eliminated. Historical notes retained only in git history. This file supersedes `CLAUDE.md` for current architecture.
