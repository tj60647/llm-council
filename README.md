# LLM Council (Next.js Edition)

![llmcouncil](header.jpg)

LLM Council lets you pose a prompt to a set of model "seats". Each seat holds a model. The council executes a 3‑stage collaborative reasoning process via OpenRouter:

1. **Stage 1: Individual Responses** – All models answer independently.
2. **Stage 2: Peer Review & Ranking** – Each model (anonymized labels) ranks others on accuracy & insight.
3. **Stage 3: Chairman Synthesis** – A designated chairman model produces a unified final answer referencing collective insights.

The UI shows conversations, seat configuration, message history, and a Sankey visualization of the multi‑stage flow (responses → rankings → aggregate → synthesis).

## Current Architecture

Single Next.js (App Router) app in `next/`:

- API routes under `next/app/api` stream stage events via Server‑Sent Events (SSE).
- Pure council orchestration functions live in `next/lib/council`.
- Temporary in‑memory storage adapter in `next/lib/storage/memory.js` (to be replaced by Redis/Postgres/KV).
- Visualization (`SankeyCouncil`) renders full skeleton immediately; link colors update as stages complete & rankings aggregate.
- Seat metaphor (`ModelRing`) allows adding/removing models and per‑conversation overrides.

Legacy Python FastAPI + Vite stack has been removed. See git tag `legacy-pre-removal` for historical code (if pushed) or earlier commits.

## Setup

### 1. Install Dependencies

```powershell
cd next
npm install
```

### 2. Configure API Key

Create `next/.env.local` (or `.env` if you prefer) with your OpenRouter key:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Do NOT expose this key client-side; only server files read it. Obtain a key at https://openrouter.ai/.

### 3. Run Dev Server

```powershell
cd next
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
cd next
npm run build
npm run start
```

Deploy on a Node‑capable environment (e.g. Vercel Node runtime). Ensure SSE endpoints are not proxied through edge middleware that buffers responses.

## Tech Stack

- **Runtime:** Next.js 15 (App Router, Node runtime for SSE)
- **Models:** Queried via OpenRouter API
- **Visualization:** d3-sankey
- **State:** In‑memory adapter (pending pluggable persistence)
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
