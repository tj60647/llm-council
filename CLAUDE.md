# CLAUDE.md — LLM Council

This file documents the codebase structure, development workflows, and conventions for AI assistants working in this repository.

## Project Overview

LLM Council is a multi-model collaborative reasoning platform built with Next.js. It orchestrates a **3-stage council process** using multiple AI models via the OpenRouter API:

1. **Stage 1** – All models answer the user prompt independently, in parallel.
2. **Stage 2** – Each model evaluates all responses (anonymized as "Response A", "Response B", etc.) and produces a ranked evaluation.
3. **Stage 3** – A designated "chairman" model synthesizes a final answer from all stage 1 responses and stage 2 rankings.

Results are streamed in real-time to the client via Server-Sent Events (SSE) and visualized as a Sankey flow diagram.

---

## Repository Layout

```
/home/user/llm-council/        ← repo root (also the Next.js app root)
├── app/                        # Next.js App Router
│   ├── layout.jsx              # Root layout with metadata
│   ├── page.jsx                # Main 4-panel UI (conversations, seats, messages, visualization)
│   └── api/
│       ├── health/route.js     # GET /api/health — health check
│       ├── models/route.js     # GET /api/models — OpenRouter catalog (15-min TTL cache)
│       └── conversations/
│           ├── route.js        # GET list / POST create conversation
│           └── [id]/
│               ├── route.js    # GET single conversation
│               ├── models/route.js      # GET/POST per-conversation model overrides
│               └── message/
│                   ├── route.js         # POST non-streaming fallback
│                   └── stream/route.js  # POST SSE streaming (primary path)
├── components/
│   ├── SankeyCouncil.jsx       # d3-sankey visualization of stage flow & rankings
│   ├── ModelRing.jsx           # Seat-based model picker UI (add/remove/change models)
│   ├── ModelSelector.jsx       # Alternative model picker with filter search
│   └── FlowDiagram.jsx         # Simple stage status diagram (pending/running/complete)
├── lib/
│   ├── config/
│   │   └── models.js           # Default model seats & chairman config
│   ├── council/                # Pure orchestration functions (no framework dependencies)
│   │   ├── stage1CollectResponses.js
│   │   ├── stage2CollectRankings.js
│   │   ├── stage3SynthesizeFinal.js
│   │   ├── parseRanking.js     # Regex parser extracting ranked labels from model text
│   │   ├── aggregateRankings.js # Average rank position across evaluators
│   │   └── generateTitle.js    # Chairman generates 3-5 word conversation title (async, 30s timeout)
│   ├── openrouter/
│   │   └── queryModel.js       # API wrapper: queryModel() and queryModelsParallel()
│   └── storage/
│       ├── index.js            # Adapter interface (exports storage functions)
│       ├── memory.js           # In-memory adapter using globalThis (dev hot-reload safe)
│       └── redis.js            # Redis stub — not yet implemented
├── package.json
├── next.config.mjs             # reactStrictMode: true; minimal config
├── README.md
├── ARCHITECTURE.md
├── ROADMAP.md
└── header.jpg
```

> **Note:** The repo root is also the Next.js project root. There is no `next/` subdirectory prefix — the `app/`, `lib/`, and `components/` directories are all at the top level. Some older documentation references `next/` prefixes; these are stale.

---

## Development Commands

All commands are run from the **repository root** (which is the Next.js app root):

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:3000 (hot reload)
npm run build     # Compile for production
npm run start     # Serve production build
```

There are no test scripts or linting commands configured. The `package.json` has only `dev`, `build`, and `start`.

---

## Environment Variables

Create a `.env.local` file in the repo root:

```bash
OPENROUTER_API_KEY=sk-or-v1-...   # Required — obtain from https://openrouter.ai/
STORAGE_ADAPTER=memory             # Optional — defaults to 'memory'; future: 'redis', 'postgres'
```

**Critical:** `OPENROUTER_API_KEY` must only be accessed in server-side files (API routes, `lib/`). Never import or reference it in React components or files that could be bundled for the client.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 18 with hooks; inline styles (no CSS files) |
| Visualization | d3-sankey 0.12.3 |
| AI Models | OpenRouter API (`https://openrouter.ai/api/v1`) |
| Streaming | Server-Sent Events (SSE) via Node.js runtime |
| Storage | In-memory via `globalThis` (Redis/Postgres adapters planned) |
| Language | JavaScript ES6+ (ESM modules — `"type": "module"` in package.json) |

**Runtime requirement:** SSE routes use `export const runtime = 'nodejs'` and are **incompatible with Vercel Edge Runtime**, which buffers streaming responses.

---

## Key Architectural Concepts

### Council Orchestration (`lib/council/`)

These are pure functions with no framework dependencies. They can be extracted as a standalone package in the future.

- **`stage1CollectResponses(userQuery, models)`** — Queries all models in parallel; returns `[{ model, response }]`.
- **`stage2CollectRankings(stage1Results, models)`** — Sends anonymized responses to all models for peer evaluation; returns rankings + `label_to_model` mapping.
- **`stage3SynthesizeFinal(userQuery, stage1Results, stage2Results, chairman)`** — Chairman synthesizes final answer from full context.
- **`parseRankingFromText(text)`** — Extracts ordered labels (e.g. `["Response A", "Response C", "Response B"]`) from model output. Looks for a `FINAL RANKING:` section; falls back to scanning the full text.
- **`aggregateRankings(stage2Results, label_to_model)`** — Averages rank positions across evaluators; returns `[{ model, avgRank }]` sorted best-first.
- **`generateTitle(userQuery, chairman)`** — Async title generation with 30-second timeout; non-blocking.

### Anonymization Strategy

Stage 2 evaluators never see which model wrote which response. Responses are presented as `Response A`, `Response B`, etc. The `label_to_model` mapping is retained server-side and included in the SSE `stage2_complete` event metadata.

Parsing relies on models producing:
```
FINAL RANKING:
1. Response X
2. Response Y
3. Response Z
```

`parseRankingFromText` has fallback logic for models that don't follow strict formatting.

### Seat Metaphor

- A "seat" is a slot in the model array for a conversation.
- **Index 0 is the chairman** by default.
- Max 7 seats enforced (visualization clarity + prompt size management).
- Conversations **snapshot** the seat configuration at creation time.
- Seats can be edited per-conversation via `GET/POST /api/conversations/[id]/models`.

### SSE Streaming Protocol

The primary message-sending endpoint is `POST /api/conversations/[id]/message/stream`. Events emitted in order:

```
data: {"type": "stage1_start"}
data: {"type": "stage1_complete", "data": [{"model": "...", "response": "..."}]}
data: {"type": "stage2_start"}
data: {"type": "stage2_complete", "data": [...], "metadata": {"label_to_model": {...}, "aggregate_rankings": [...]}}
data: {"type": "stage3_start"}
data: {"type": "stage3_complete", "data": {"response": "..."}}
data: {"type": "title_complete", "data": {"title": "..."}}   ← only on first message
data: {"type": "complete"}
data: {"type": "error", "message": "..."}                    ← on failure
```

The non-streaming fallback (`/api/conversations/[id]/message`) returns a single JSON response after all stages complete. `app/page.jsx` falls back to this if SSE returns 404.

### Storage Abstraction

`lib/storage/index.js` exports these methods (all are currently wired to the memory adapter):

```
createConversation(models)
listConversations()
getConversation(id)
updateTitle(id, title)
addUserMessage(id, content)
addAssistantMessage(id, messageObject)
updateConversationModels(id, models)
conversationCount()
```

The memory adapter uses `globalThis.__COUNCIL_STORE` so data survives Next.js hot reloads in development. **All data is lost on server restart.**

To implement a new adapter: create `lib/storage/<adapter>.js` exporting the same interface, then update `lib/storage/index.js` to import it based on `STORAGE_ADAPTER`.

### Data Shapes

**Conversation object:**
```js
{
  id: string,          // UUID
  created_at: string,  // ISO timestamp
  title: string,       // Generated async; starts as "Untitled"
  models: string[],    // Ordered model IDs; index 0 = chairman
  messages: Message[]
}
```

**Message object (assistant):**
```js
{
  role: 'assistant',
  stage1: [{ model, response }],
  stage2: [{ model, rankings, rankingText }],
  stage3: { response },
  metadata: {
    label_to_model: { 'Response A': 'model-id', ... },
    aggregate_rankings: [{ model, avgRank }]
  },
  loading: boolean     // true while streaming; removed on completion
}
```

---

## Code Conventions

### Style
- **ESM modules** — use `import`/`export`, never `require()`. The package is `"type": "module"`.
- **Async/await** — used throughout; no raw `.then()` chains.
- **Functional React components** with hooks (`useState`, `useEffect`, `useMemo`).
- **Inline styles** — all styling is done with React `style={{}}` props. There are no CSS files or CSS modules.
- **No TypeScript** — this is a plain JavaScript project. Do not add `.ts`/`.tsx` files or JSDoc type annotations unless explicitly asked.

### File Organization
- `lib/council/` — pure functions, no Next.js or React imports.
- `lib/openrouter/` — all OpenRouter API calls; never called from client components.
- `app/api/` — route handlers must include `export const runtime = 'nodejs'` if they use SSE or long-running async operations.
- `components/` — client components only; use `'use client'` directive at top.

### Security
- `OPENROUTER_API_KEY` is server-only. Any file that imports it must live in `app/api/` or `lib/`. Never import from a `components/` file.
- Do not add `'use client'` to any file in `lib/` that accesses env vars.
- Validate and sanitize all user-provided model IDs before passing to OpenRouter.

### OpenRouter API
- Base URL: `https://openrouter.ai/api/v1`
- Model catalog endpoint: `GET /models`
- Chat endpoint: `POST /chat/completions`
- Default timeout: 120 seconds per model query.
- `queryModelsParallel()` uses `Promise.allSettled` — individual model failures do not abort the full stage.

---

## What Does Not Exist (Yet)

- **No tests** — no test runner, no test files. Vitest or Jest would be the natural fit for `lib/council/` unit tests.
- **No linting** — no ESLint, Prettier, or Biome configuration.
- **No CI/CD** — no `.github/workflows/` or other automation.
- **No Redis/Postgres adapter** — `lib/storage/redis.js` is a stub.
- **No authentication** — the app is open; all conversations are shared in-memory.
- **No rate limiting** — no per-IP or per-API-key limits on the council endpoints.
- **No cost estimation** — OpenRouter usage cost is not tracked or displayed.

These are acknowledged in `ROADMAP.md`.

---

## Common Tasks for AI Assistants

### Adding a new council stage
1. Create `lib/council/stageN<Name>.js` as a pure async function.
2. Import and call it in `app/api/conversations/[id]/message/stream/route.js`.
3. Emit a corresponding `stageN_start` / `stageN_complete` SSE event.
4. Update `app/page.jsx` to handle the new event type in the SSE listener.
5. Update `components/SankeyCouncil.jsx` if the stage needs visualization nodes/links.

### Adding a new storage adapter
1. Create `lib/storage/<name>.js` exporting all methods from the storage interface.
2. Update `lib/storage/index.js` to conditionally import the new adapter based on `STORAGE_ADAPTER`.
3. Document the new env var value in `.env.local` example.

### Modifying default models
Edit `lib/config/models.js`. The first entry in the array is the chairman.

### Changing the ranking prompt format
Edit `lib/council/stage2CollectRankings.js` (the system/user prompt construction) and update `lib/council/parseRanking.js` if the expected output format changes.

---

## Important Notes for AI Assistants

- **Read files before editing.** The project has non-obvious path conventions (e.g., repo root = Next.js root; no `next/` prefix).
- **Do not add TypeScript** unless explicitly requested.
- **Do not introduce CSS files** — use inline styles to match the existing pattern.
- **Do not use `require()`** — all modules use ESM `import`/`export`.
- **Do not add `'use client'`** to files in `lib/` — they must stay server-only.
- **Keep `lib/council/` pure** — no Next.js, React, or `process.env` references in these files.
- **SSE routes need `runtime = 'nodejs'`** — always add this export to new streaming route handlers.
- **In-memory storage is ephemeral** — do not rely on it for anything that must survive restarts.
- The legacy Python/Vite implementation was fully removed. Do not reference or attempt to restore it. Historical code is at git tag `legacy-pre-removal`.
