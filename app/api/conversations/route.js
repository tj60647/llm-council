import { NextResponse } from 'next/server';
import { createConversation, listConversations, getConversation, updateTitle, adapterName } from '../../../lib/storage/index.js';
import { DEFAULT_COUNCIL_MODELS } from '../../../lib/config/models.js';
import { generateTitle } from '../../../lib/council/generateTitle.js';
import { requireUser, checkSeatModels } from '../../../lib/auth/guard.js';

export async function GET(req) {
    const gate = await requireUser(req);
    if (!gate.ok) return gate.response;
    const list = await listConversations(gate.ctx.session.email);
    return NextResponse.json({ adapter: adapterName(), conversations: list, count: list.length }, {
        headers: { 'X-Conversations-Count': String(list.length) }
    });
}

export async function POST(req) {
    const gate = await requireUser(req);
    if (!gate.ok) return gate.response;
    const ctx = gate.ctx;

    const body = await req.json().catch(() => ({}));
    let models = body.models && Array.isArray(body.models) && body.models.length ? body.models : DEFAULT_COUNCIL_MODELS;
    // When the group restricts models and the default set isn't fully allowed,
    // fall back to the group's own list rather than erroring on defaults.
    const seatCheck = checkSeatModels(models, ctx);
    if (!seatCheck.ok) {
        if (body.models?.length) return seatCheck.response;
        models = (ctx.group?.models || []).slice(0, 7);
        if (!models.length) return seatCheck.response;
    }

    console.log('[createConversation] incoming models:', models);
    const c = await createConversation(models, ctx.session.email);
    console.log('[createConversation] created id:', c.id, 'owner:', c.owner);
    const baseTitle = 'New Conversation';
    // Only generate a title now if the caller supplied the opening prompt;
    // otherwise the stream route titles the conversation from the first message.
    if (body.initialPrompt) {
        (async () => {
            try {
                const generated = await generateTitle(body.initialPrompt);
                const fresh = await getConversation(c.id);
                if (generated && fresh && fresh.title === baseTitle) {
                    await updateTitle(c.id, generated);
                    console.log('[createConversation] async title updated:', c.id, generated);
                }
            } catch (e) {
                console.log('[createConversation] title generation skipped or failed:', e.message);
            }
        })();
    }
    return NextResponse.json({ adapter: adapterName(), conversation: { ...c, metadata: { id: c.id, created_at: c.created_at, title: c.title, message_count: c.messages.length, models, async_title: Boolean(body.initialPrompt) } } });
}
