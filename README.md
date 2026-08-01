# LLM Council (Next.js Edition)

![llmcouncil](header.jpg)

LLM Council lets you pose a prompt to a set of model "seats". Each seat holds a model. The council executes a 3‑stage collaborative reasoning process via OpenRouter:

1. **Stage 1: Individual Responses** – All models answer independently.
2. **Stage 2: Peer Review & Ranking** – Each model (anonymized labels) ranks others on accuracy & insight.
3. **Stage 3: Chairman Synthesis** – A designated chairman model produces a unified final answer referencing collective insights.

The UI shows conversations, seat configuration, message history, and a Sankey visualization of the multi‑stage flow (responses → rankings → aggregate → synthesis).

## Current Architecture

Single Next.js (App Router) app at the repo root:

- API routes under `app/api` stream stage events via Server‑Sent Events (SSE).
- Pure council orchestration functions live in `lib/council`.
- Pluggable storage (`lib/storage`): Upstash Redis when configured (required for serverless deploys), in‑memory fallback for local dev.
- Visualization (`SankeyCouncil`) renders full skeleton immediately; link colors update as stages complete & rankings aggregate.
- Seat metaphor (`ModelRing`) allows adding/removing models and per‑conversation overrides.

Legacy Python FastAPI + Vite stack has been removed. See git tag `legacy-pre-removal` for historical code (if pushed) or earlier commits.

## Setup

### 1. Install Dependencies

```powershell
npm install
```

### 2. Configure API Key

Create `.env.local` with your OpenRouter key:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Do NOT expose this key client-side; only server files read it. Obtain a key at https://openrouter.ai/.

### 3. Run Dev Server

```powershell
npm run dev
```

Open http://localhost:3000.

### 4. Using the App

1. Adjust default seats (models) in the left panel.
2. Create a conversation (captures a snapshot of current seats).
3. Send a prompt; watch stages stream in near‑real time.
4. Inspect rankings & final synthesis; compare individual responses.
5. Optionally edit seats for an existing conversation and continue querying.

### 5. Building & Production

```powershell
npm run build
npm run start
```

### 6. Deploying (Vercel)

In-memory storage does not survive across serverless invocations — a deployed
instance **requires** Redis:

1. Add **Upstash for Redis** via the Vercel Marketplace (provides
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`; the `KV_REST_API_*`
   names also work). The adapter activates automatically when these exist.
2. Set `OPENROUTER_API_KEY` in project environment variables.
3. Ensure SSE endpoints are not proxied through middleware that buffers
   responses. Message routes declare `maxDuration = 300` for long council runs.
4. After deploy, `GET /api/health` should report `{ status: "ok", adapter: "redis" }`.

### 7. Tests

```powershell
npx vitest run
```

## Tech Stack

- **Runtime:** Next.js 16 (App Router, Node runtime for SSE)
- **Models:** Queried via OpenRouter API (default seats verified 2026-07-31; see `lib/config/models.js`)
- **Visualization:** d3-sankey
- **State:** Pluggable storage — Upstash Redis (serverless) or in‑memory (local dev)
- **Env:** `.env.local` restricted to server usage

## Roadmap & Internals

See `ROADMAP.md` for detailed milestones; `ARCHITECTURE.md` covers internal design:

- Persistence adapter introduction
- Security audit (env leakage + rate limiting)
- Sankey legend & tooltips
- Package extraction for council logic reuse

## Migration Note

All FastAPI/Vite code was decommissioned after porting logic and UI to Next.js. If you need the original Python implementation, check the `legacy-pre-removal` tag or scan history prior to the removal commit.

## Disclaimer (Vibe Code)

Originally hacked together for multi‑model comparison while reading books. Provided as inspiration; feel free to adapt further. No formal support promised.

Enjoy exploring collective LLM reasoning!
