// Upstash Redis adapter (REST-based, serverless-safe). Activates automatically
// when Upstash/Vercel KV env vars are present, or explicitly via
// STORAGE_ADAPTER=redis. Uses read-modify-write on whole conversation objects,
// which is fine for a single-user app (no concurrent writers per conversation).
import { Redis } from '@upstash/redis';

const KEY_PREFIX = 'council:conv:';
const INDEX_KEY = 'council:conv:index'; // zset: member=id, score=created_at epoch ms

let client = null;

export function isConfigured() {
    return Boolean(
        (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
        (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    );
}

function getClient() {
    if (!client) {
        const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
        if (!url || !token) throw new Error('redis adapter selected but Upstash env vars are missing');
        client = new Redis({ url, token });
    }
    return client;
}

// Test seam: inject a fake client implementing get/set/mget/zadd/zrange/zcard/del.
export function __setTestClient(fake) { client = fake; }

async function save(c) {
    await getClient().set(KEY_PREFIX + c.id, c);
}

export async function createConversation(models) {
    const id = crypto.randomUUID();
    const c = { id, created_at: new Date().toISOString(), title: 'New Conversation', models, messages: [] };
    const r = getClient();
    await r.set(KEY_PREFIX + id, c);
    await r.zadd(INDEX_KEY, { score: Date.parse(c.created_at), member: id });
    return c;
}

export async function listConversations() {
    const r = getClient();
    const ids = await r.zrange(INDEX_KEY, 0, -1, { rev: true });
    if (!ids.length) return [];
    const rows = await r.mget(...ids.map(id => KEY_PREFIX + id));
    return rows
        .filter(Boolean)
        .map(c => ({ id: c.id, created_at: c.created_at, title: c.title, message_count: c.messages.length, models: c.models }));
}

export async function getConversation(id) {
    const c = await getClient().get(KEY_PREFIX + id);
    return c || null;
}

export async function updateTitle(id, title) {
    const c = await getConversation(id);
    if (c) { c.title = title; await save(c); }
}

export async function addUserMessage(id, content) {
    const c = await getConversation(id);
    if (c) { c.messages.push({ role: 'user', content }); await save(c); }
}

export async function addAssistantMessage(id, payload) {
    const c = await getConversation(id);
    if (c) { c.messages.push({ role: 'assistant', ...payload }); await save(c); }
}

export async function conversationCount() {
    return await getClient().zcard(INDEX_KEY);
}

export async function updateConversationModels(id, models) {
    const c = await getConversation(id);
    if (c && Array.isArray(models) && models.length) {
        c.models = models.slice(0, 7); // cap at 7
        await save(c);
    }
    return c || null;
}
