import { NextResponse } from 'next/server';
import { getConversation, updateConversationModels, adapterName } from '../../../../../lib/storage/index.js';
import { DEFAULT_COUNCIL_MODELS } from '../../../../../lib/config/models.js';

export async function GET(_, { params }) {
    const c = getConversation(params.id);
    if (!c) return new NextResponse(JSON.stringify({ error: 'not_found' }), { status: 404 });
    return NextResponse.json({ adapter: adapterName(), id: c.id, models: c.models });
}

export async function POST(req, { params }) {
    const c = getConversation(params.id);
    if (!c) return new NextResponse(JSON.stringify({ error: 'not_found' }), { status: 404 });
    const body = await req.json().catch(() => ({}));
    const models = Array.isArray(body.models) && body.models.length ? body.models : DEFAULT_COUNCIL_MODELS;
    const updated = updateConversationModels(c.id, models);
    return NextResponse.json({ adapter: adapterName(), id: updated.id, models: updated.models });
}