import { NextResponse } from 'next/server';
import { getConversation, addUserMessage, addAssistantMessage, updateTitle, adapterName } from '../../../../../lib/storage/index.js';
import { stage1CollectResponses } from '../../../../../lib/council/stage1CollectResponses.js';
import { stage2CollectRankings } from '../../../../../lib/council/stage2CollectRankings.js';
import { aggregateRankings } from '../../../../../lib/council/aggregateRankings.js';
import { stage3SynthesizeFinal } from '../../../../../lib/council/stage3SynthesizeFinal.js';
import { generateTitle } from '../../../../../lib/council/generateTitle.js';

export const runtime = 'nodejs';

export async function POST(req, { params }) {
    const { content } = await req.json();
    const c = getConversation(params.id);
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const isFirst = c.messages.length === 0;
    addUserMessage(c.id, content);
    if (isFirst) { updateTitle(c.id, await generateTitle(content)); }
    try {
        const stage1 = await stage1CollectResponses(content, c.models);
        const { stage2Results, labelToModel } = await stage2CollectRankings(content, stage1, c.models);
        const aggregate = aggregateRankings(stage2Results, labelToModel);
        const stage3 = await stage3SynthesizeFinal(content, stage1, stage2Results, c.models[0]);
        addAssistantMessage(c.id, { stage1, stage2: stage2Results, stage3, metadata: { label_to_model: labelToModel, aggregate_rankings: aggregate } });
        return NextResponse.json({ adapter: adapterName(), stage1, stage2: stage2Results, stage3, metadata: { label_to_model: labelToModel, aggregate_rankings: aggregate } });
    } catch (e) {
        return NextResponse.json({ adapter: adapterName(), error: e.message }, { status: 500 });
    }
}
