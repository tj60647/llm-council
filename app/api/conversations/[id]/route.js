import { NextResponse } from 'next/server';
import { getConversation, adapterName } from '../../../../lib/storage/index.js';
import { requireUser, ownsConversation } from '../../../../lib/auth/guard.js';

export async function GET(req, props) {
    const gate = await requireUser(req);
    if (!gate.ok) return gate.response;
    const params = await props.params;
    const id = params?.id;
    const c = id ? await getConversation(id) : null;
    if (!c || !ownsConversation(c, gate.ctx)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ adapter: adapterName(), conversation: c });
}
