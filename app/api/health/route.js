import { NextResponse } from 'next/server';
import { conversationCount, adapterName } from '../../../lib/storage/index.js';

export async function GET() {
    try {
        const count = await conversationCount();
        return NextResponse.json({ status: 'ok', adapter: adapterName(), conversations: count, ts: Date.now() });
    } catch (e) {
        // Storage unreachable (e.g. bad redis credentials) — report rather than 500
        return NextResponse.json({ status: 'degraded', adapter: adapterName(), error: e.message, ts: Date.now() }, { status: 503 });
    }
}
