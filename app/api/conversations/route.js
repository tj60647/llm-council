import { NextResponse } from 'next/server';
import { createConversation, listConversations, conversationCount, adapterName } from '../../../lib/storage/index.js';
import { DEFAULT_COUNCIL_MODELS } from '../../../lib/config/models.js';
import { generateTitle } from '../../../lib/council/generateTitle.js';

export async function GET() {
    const list = listConversations();
    return NextResponse.json({ adapter: adapterName(), conversations: list, count: conversationCount() }, {
        headers: { 'X-Conversations-Count': String(conversationCount()) }
    });
}

export async function POST(req) {
    const body = await req.json().catch(() => ({}));
    const models = body.models && Array.isArray(body.models) && body.models.length ? body.models : DEFAULT_COUNCIL_MODELS;
    console.log('[createConversation] incoming models:', models);
    const c = createConversation(models);
    console.log('[createConversation] created id:', c.id);
    // Async title generation: respond immediately with placeholder
    const baseTitle = 'New Conversation';
    c.title = baseTitle;
    // Fire-and-forget (no await) with timeout fallback
    (async () => {
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 1500);
            const generated = await generateTitle(body.initialPrompt || 'General Inquiry');
            clearTimeout(t);
            if (generated && c.title === baseTitle) {
                // Update in-memory store; UI will pick up on next GET
                c.title = generated;
                console.log('[createConversation] async title updated:', c.id, generated);
            }
        } catch (e) {
            console.log('[createConversation] title generation skipped or failed:', e.message);
        }
    })();
    return NextResponse.json({ adapter: adapterName(), conversation: { ...c, metadata: { id: c.id, created_at: c.created_at, title: c.title, message_count: c.messages.length, models, async_title: true } } });
}
