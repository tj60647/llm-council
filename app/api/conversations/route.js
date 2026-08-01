import { NextResponse } from 'next/server';
import { createConversation, listConversations, getConversation, updateTitle, conversationCount, adapterName } from '../../../lib/storage/index.js';
import { DEFAULT_COUNCIL_MODELS } from '../../../lib/config/models.js';
import { generateTitle } from '../../../lib/council/generateTitle.js';

export async function GET() {
    const list = await listConversations();
    const count = await conversationCount();
    return NextResponse.json({ adapter: adapterName(), conversations: list, count }, {
        headers: { 'X-Conversations-Count': String(count) }
    });
}

export async function POST(req) {
    const body = await req.json().catch(() => ({}));
    const models = body.models && Array.isArray(body.models) && body.models.length ? body.models : DEFAULT_COUNCIL_MODELS;
    console.log('[createConversation] incoming models:', models);
    const c = await createConversation(models);
    console.log('[createConversation] created id:', c.id);
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
