// Temporary in-memory storage (NOT for production). Persisted across Next.js
// dev reloads by attaching to globalThis. This mitigates 404s when the dev
// server hot-reloads and the module state resets.

const store = globalThis.__COUNCIL_STORE || (globalThis.__COUNCIL_STORE = { conversations: new Map() });
const conversations = store.conversations;

export function resetMemory() {
    conversations.clear();
}

export function createConversation(models) {
    const id = crypto.randomUUID();
    const c = { id, created_at: new Date().toISOString(), title: 'New Conversation', models, messages: [] };
    conversations.set(id, c);
    return c;
}

export function listConversations() {
    return Array.from(conversations.values()).map(c => ({ id: c.id, created_at: c.created_at, title: c.title, message_count: c.messages.length, models: c.models }));
}

export function getConversation(id) { return conversations.get(id) || null; }

export function updateTitle(id, title) { const c = conversations.get(id); if (c) { c.title = title; } }

export function addUserMessage(id, content) { const c = conversations.get(id); if (c) { c.messages.push({ role: 'user', content }); } }

export function addAssistantMessage(id, payload) {
    const c = conversations.get(id); if (c) { c.messages.push({ role: 'assistant', ...payload }); }
}

// Debug helper (can be used in routes):
export function conversationCount() { return conversations.size; }

export function updateConversationModels(id, models) {
    const c = conversations.get(id);
    if (c && Array.isArray(models) && models.length) {
        c.models = models.slice(0, 7); // cap at 7
    }
    return c || null;
}
