import { NextResponse } from 'next/server';
import { getConversation, updateConversationModels, adapterName } from '../../../../../lib/storage/index.js';
import { DEFAULT_COUNCIL_MODELS } from '../../../../../lib/config/models.js';

export async function GET(_req, props) {
    const params = await props.params;
    const c = await getConversation(params?.id);
    if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ adapter: adapterName(), id: c.id, models: c.models });
}

export async function POST(req, props) {
    const params = await props.params;
    const c = await getConversation(params?.id);
    if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const models = Array.isArray(body.models) && body.models.length ? body.models : DEFAULT_COUNCIL_MODELS;
    const updated = await updateConversationModels(c.id, models);
    return NextResponse.json({ adapter: adapterName(), id: updated.id, models: updated.models });
}
