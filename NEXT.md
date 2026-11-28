# Next

Updated: 2026-11-28

## Where it stands

This is a fork of [karpathy/llm-council](https://github.com/karpathy/llm-council), rewritten as one Next.js app, 30 commits ahead of the parent: councils persist in Redis, there is GitHub sign-in with workshop seating (groups, join codes, model sets, run caps), streaming output, a Sankey of the deliberation, and a model catalog from the OpenRouter Registry. It is live at https://llm-council-gilt.vercel.app. The last work (4 Aug 2026) added join QR codes with a projector view, the registry catalog, and the model validity guard from `ROADMAP.md` Phase B.

## Next step

Phase B in `ROADMAP.md`: make the browser's stream parser buffer partial events across chunk boundaries, so a server-sent event split between two network chunks is not lost. Add a test that feeds one event in two pieces.

## After that

- The rest of Phase B: per-stage error messages in the UI (one model failed, rather than the whole run), a keepalive event every 15 seconds or so during long stages, and per-IP rate limiting.
- Re-check the default council's model ids in `lib/config/models.js`; the roadmap asks for this quarterly, and they were last checked on 1 August.
- Phase C: Sankey legend and tooltips, cost per conversation, delete and export, choosing the chairperson seat.

## Blocked or waiting

- Pull request #4 (https://github.com/tj60647/llm-council/pull/4): refuse every request in production when a sign-in setting is missing. Waiting on your merge.

## Open questions

- Is the council still meant for workshops, and is one planned that should set the order of this work?
- This plan was drafted by Claude on 2026-11-22 from the code and its history. Is the next step right?
