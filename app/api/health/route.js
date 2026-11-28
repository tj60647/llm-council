import { NextResponse } from 'next/server';
import { conversationCount, adapterName } from '../../../lib/storage/index.js';

export async function GET() {
    try {
        const count = await conversationCount();
        return NextResponse.json({ status: 'ok', adapter: adapterName(), conversations: count, ts: Date.now() });
    } catch (e) {
        // Storage unreachable (e.g. bad redis credentials): the detail goes to the log, not the body
        console.error('health: storage unreachable', e);
        return NextResponse.json({ status: 'degraded', ts: Date.now() }, { status: 503 });
    }
}
