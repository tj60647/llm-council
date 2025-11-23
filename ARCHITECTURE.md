# Architecture & Internals

This document provides a concise, up-to-date overview of the LLM Council architecture (Next.js edition). Legacy Python/Vite implementation has been removed; see the `legacy-pre-removal` tag in git history if needed.

## High-Level Flow

1. User sends prompt.
2. Stage 1: Parallel model responses.
3. Stage 2: Peer evaluations with anonymized labels (Response A, B, ...).
4. Aggregate rankings (average position across evaluations).
5. Stage 3: Chairman synthesis referencing all prior context.
6. Streaming events (SSE) deliver incremental updates to client.

## Key Modules

- `next/lib/council/*`: Pure functions for each stage + ranking parse + title generation.
- `next/lib/openrouter/*`: Thin wrappers around OpenRouter API requests; all server-side usage.
- `next/lib/storage/index.js`: Adapter entrypoint (currently memory; pluggable for Redis/Postgres/KV).
- `next/app/api/*`: Route handlers (Node runtime) orchestrating multi-stage processing and streaming.
- `next/components/SankeyCouncil.jsx`: Visualization of stage transitions, rankings, and synthesis provenance.
- `next/components/ModelRing.jsx`: Seat metaphor enabling dynamic model selection & per-conversation overrides.

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

Interface methods: `createConversation`, `listConversations`, `getConversation`, `updateTitle`, `addUserMessage`, `addAssistantMessage`, `updateConversationModels`, `conversationCount`.

Memory adapter persists via `globalThis` for dev hot reload stability. Future adapters will implement same contract.

## Seat Metaphor

- Seats are ordered array of models (index 0 currently chairman by default).
- Conversations snapshot seat configuration at creation; can be edited later.
- Cap of 7 models enforced for visualization clarity and prompt size management.

## Visualization Design

- Sankey nodes: Prompt → Individual Responses → Evaluations → Aggregate → Synthesis.
- Link coloring:
  - Grey: Pending
  - Blue: Completed stages
  - Gradient Green→Orange: Ranking quality (lower average → greener)
- Future: Legend + tooltips + per-link latency overlay.

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
