// Temporary in-memory storage (NOT for production). Persisted across Next.js
// dev reloads by attaching to globalThis. This mitigates 404s when the dev
// server hot-reloads and the module state resets.

const store = globalThis.__COUNCIL_STORE || (globalThis.__COUNCIL_STORE = { conversations: new Map(), groups: new Map(), users: new Map(), runs: new Map() });
const conversations = store.conversations;
const groups = store.groups;
const users = store.users;
const runs = store.runs;

export function resetMemory() {
    conversations.clear();
    groups.clear();
    users.clear();
    runs.clear();
}

export function createConversation(models, owner) {
    const id = crypto.randomUUID();
    const c = { id, created_at: new Date().toISOString(), title: 'New Conversation', models, messages: [], owner: owner || null };
    conversations.set(id, c);
    return c;
}

export function listConversations(owner) {
    return Array.from(conversations.values())
        .filter(c => !owner || c.owner === owner)
        .map(c => ({ id: c.id, created_at: c.created_at, title: c.title, message_count: c.messages.length, models: c.models, owner: c.owner }));
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

// --- Accounts: groups, users, run counters ---

export function putGroup(group) {
    groups.set(group.id, group);
    return group;
}

export function getGroup(id) { return groups.get(id) || null; }

export function getGroupByCode(code) {
    if (!code) return null;
    const target = code.trim().toUpperCase();
    for (const g of groups.values()) { if (g.code === target) return g; }
    return null;
}

export function listGroups() { return Array.from(groups.values()); }

export function deleteGroup(id) { groups.delete(id); }

export function putUser(user) {
    users.set(user.email.toLowerCase(), user);
    return user;
}

export function getUser(email) { return email ? (users.get(email.toLowerCase()) || null) : null; }

export function listUsers() { return Array.from(users.values()); }

export function deleteUser(email) { users.delete(email.toLowerCase()); }

export function incrRunCount(email, date) {
    const key = `${email.toLowerCase()}:${date}`;
    const next = (runs.get(key) || 0) + 1;
    runs.set(key, next);
    return next;
}

export function getRunCount(email, date) {
    return runs.get(`${email.toLowerCase()}:${date}`) || 0;
}

// Lifetime spend per user, so an admin can see what a workshop is costing.
export function addRunCost(email, cost) {
    if (!cost) return 0;
    const key = `spend:${email.toLowerCase()}`;
    const next = (runs.get(key) || 0) + cost;
    runs.set(key, next);
    return next;
}

export function getRunCost(email) {
    return runs.get(`spend:${email.toLowerCase()}`) || 0;
}
