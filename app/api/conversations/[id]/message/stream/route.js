import { stage1CollectResponses } from '../../../../../../lib/council/stage1CollectResponses.js';
import { stage2CollectRankings } from '../../../../../../lib/council/stage2CollectRankings.js';
import { aggregateRankings } from '../../../../../../lib/council/aggregateRankings.js';
import { stage3SynthesizeFinal } from '../../../../../../lib/council/stage3SynthesizeFinal.js';
import { generateTitle } from '../../../../../../lib/council/generateTitle.js';
import { getConversation, addUserMessage, addAssistantMessage, updateTitle, adapterName } from '../../../../../../lib/storage/index.js';
import { DEFAULT_CHAIRMAN_MODEL } from '../../../../../../lib/config/models.js';

export const runtime = 'nodejs';

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

// Next.js dynamic route context may be async; await context before using params
export async function POST(req, context) {
    const { params } = await context; // ensure params resolved on newer Next versions
    const { content } = await req.json();
    const conversationId = params?.id;
    const c = conversationId ? getConversation(conversationId) : null;
    if (!c) {
        console.warn('[streamRoute] conversation not found for id:', conversationId);
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(`event: error\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'conversation_not_found', id: conversationId })}\n\n`));
                controller.close();
            }
        });
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            },
            status: 404
        });
    } else {
        console.log('[streamRoute] starting stream (adapter:', adapterName(), ') conversation id:', c.id, 'messages:', c.messages.length);
    }
    // Proceed with streaming stages
    const isFirst = c.messages.length === 0;
    addUserMessage(c.id, content);
    let titlePromise = null;
    if (isFirst) { titlePromise = generateTitle(content); }

    const stream = new ReadableStream({
        async start(controller) {
            try {
                controller.enqueue(sse({ type: 'stage1_start' }));
                const stage1 = await stage1CollectResponses(content, c.models);
                controller.enqueue(sse({ type: 'stage1_complete', data: stage1 }));
                console.log('[streamRoute] stage1 responses count:', Array.isArray(stage1) ? stage1.length : 'n/a');

                controller.enqueue(sse({ type: 'stage2_start' }));
                const { stage2Results, labelToModel } = await stage2CollectRankings(content, stage1, c.models);
                const aggregate = aggregateRankings(stage2Results, labelToModel);
                controller.enqueue(sse({ type: 'stage2_complete', data: stage2Results, metadata: { label_to_model: labelToModel, aggregate_rankings: aggregate } }));
                console.log('[streamRoute] stage2 rankings count:', Array.isArray(stage2Results) ? stage2Results.length : 'n/a');

                controller.enqueue(sse({ type: 'stage3_start' }));
                const chairman = (Array.isArray(c.models) && c.models.length) ? c.models[0] : DEFAULT_CHAIRMAN_MODEL;
                console.log('[streamRoute] using chairman model:', chairman);
                const stage3 = await stage3SynthesizeFinal(content, stage1, stage2Results, chairman);
                controller.enqueue(sse({ type: 'stage3_complete', data: stage3 }));
                console.log('[streamRoute] stage3 final synthesis length:', typeof stage3 === 'string' ? stage3.length : 'n/a');

                if (titlePromise) {
                    const title = await titlePromise;
                    updateTitle(c.id, title);
                    controller.enqueue(sse({ type: 'title_complete', data: { title } }));
                }

                addAssistantMessage(c.id, { stage1, stage2: stage2Results, stage3, metadata: { label_to_model: labelToModel, aggregate_rankings: aggregate } });
                controller.enqueue(sse({ type: 'complete' }));
                controller.close();
            } catch (e) {
                controller.enqueue(sse({ type: 'error', message: e.message }));
                controller.close();
            }
        }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
}
