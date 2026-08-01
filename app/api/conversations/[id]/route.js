import { NextResponse } from 'next/server';
import { getConversation, adapterName } from '../../../../lib/storage/index.js';

// Dynamic route params access adjusted to avoid Next.js warning about sync usage.
export async function GET(_req, props) {
    const params = await props.params;
    const id = params?.id;
    const c = id ? getConversation(id) : null;
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ adapter: adapterName(), conversation: c });
}
