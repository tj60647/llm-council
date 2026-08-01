import { stage1CollectResponses } from '../../../../../../lib/council/stage1CollectResponses.js';
import { stage2CollectRankings } from '../../../../../../lib/council/stage2CollectRankings.js';
import { aggregateRankings } from '../../../../../../lib/council/aggregateRankings.js';
import { stage3SynthesizeFinal } from '../../../../../../lib/council/stage3SynthesizeFinal.js';
import { generateTitle } from '../../../../../../lib/council/generateTitle.js';
import { getConversation, addUserMessage, addAssistantMessage, updateTitle, adapterName } from '../../../../../../lib/storage/index.js';
import { DEFAULT_CHAIRPERSON_MODEL } from '../../../../../../lib/config/models.js';
import { requireUser, ownsConversation, consumeRun } from '../../../../../../lib/auth/guard.js';

export const runtime = 'nodejs';
export const maxDuration = 300; // council runs are multi-minute; default serverless limits kill them

const encoder = new TextEncoder();
function sse(obj) { return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`); }

const SSE_HEADERS = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive'
};

// Roll per-call usage into a per-run total for the message footer.
function costTotals(entries) {
    let cost = 0, tokens = 0, calls = 0, priced = 0;
    for (const e of entries) {
        if (!e?.usage) continue;
        calls++;
        if (typeof e.usage.cost === 'number') { cost += e.usage.cost; priced++; }
        if (typeof e.usage.total_tokens === 'number') tokens += e.usage.total_tokens;
    }
    return { cost: priced ? Number(cost.toFixed(6)) : null, total_tokens: tokens || null, calls };
}

export async function POST(req, props) {
    const gate = await requireUser(req);
    if (!gate.ok) return gate.response;
    const params = await props.params;
    const { content } = await req.json();
    const conversationId = params?.id;
    let c = conversationId ? await getConversation(conversationId) : null;
    if (c && !ownsConversation(c, gate.ctx)) c = null;
    if (c) {
        const run = await consumeRun(gate.ctx);
        if (!run.ok) return run.response;
    }
    if (!c) {
        console.warn('[streamRoute] conversation not found for id:', conversationId);
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(sse({ type: 'error', error: 'conversation_not_found', id: conversationId }));
                controller.close();
            }
        });
        return new Response(stream, { headers: SSE_HEADERS, status: 404 });
    }
    console.log('[streamRoute] starting stream (adapter:', adapterName(), ') conversation id:', c.id, 'messages:', c.messages.length);

    const isFirst = c.messages.length === 0;
    await addUserMessage(c.id, content);
    let titlePromise = null;
    if (isFirst) { titlePromise = generateTitle(content); }

    const stream = new ReadableStream({
        async start(controller) {
            // The stream can be cancelled by the client mid-run; enqueueing on a
            // closed controller throws and would mask the real error.
            let closed = false;
            const send = (obj) => { if (!closed) { try { controller.enqueue(sse(obj)); } catch { closed = true; } } };
            try {
                const chairperson = (Array.isArray(c.models) && c.models.length) ? c.models[0] : DEFAULT_CHAIRPERSON_MODEL;
                send({ type: 'council_start', data: { models: c.models, chairperson } });

                send({ type: 'stage1_start' });
                const stage1 = await stage1CollectResponses(content, c.models, {
                    onModel: (entry) => send({ type: 'stage1_model', data: entry })
                });
                send({ type: 'stage1_complete', data: stage1 });
                console.log('[streamRoute] stage1 responses count:', Array.isArray(stage1) ? stage1.length : 'n/a');

                send({ type: 'stage2_start' });
                const { stage2Results, labelToModel } = await stage2CollectRankings(content, stage1, c.models, {
                    onModel: (entry) => send({ type: 'stage2_model', data: entry })
                });
                const aggregate = aggregateRankings(stage2Results, labelToModel);
                send({ type: 'stage2_complete', data: stage2Results, metadata: { label_to_model: labelToModel, aggregate_rankings: aggregate } });
                console.log('[streamRoute] stage2 rankings count:', Array.isArray(stage2Results) ? stage2Results.length : 'n/a');

                send({ type: 'stage3_start', data: { model: chairperson } });
                console.log('[streamRoute] using chairperson model:', chairperson);
                const stage3 = await stage3SynthesizeFinal(content, stage1, stage2Results, chairperson, {
                    onDelta: (text) => send({ type: 'stage3_delta', data: text })
                });
                send({ type: 'stage3_complete', data: stage3 });
                console.log('[streamRoute] stage3 final synthesis length:', stage3?.response?.length ?? 'n/a');

                if (titlePromise) {
                    const title = await titlePromise;
                    await updateTitle(c.id, title);
                    send({ type: 'title_complete', data: { title } });
                }

                const totals = costTotals([...stage1, ...stage2Results, stage3]);
                await addAssistantMessage(c.id, {
                    stage1, stage2: stage2Results, stage3,
                    metadata: { label_to_model: labelToModel, aggregate_rankings: aggregate, totals }
                });
                send({ type: 'complete', metadata: { totals } });
                if (!closed) controller.close();
            } catch (e) {
                console.error('[streamRoute] run failed:', e.message);
                send({ type: 'error', message: e.message });
                if (!closed) controller.close();
            }
        }
    });
    return new Response(stream, { headers: SSE_HEADERS });
}
