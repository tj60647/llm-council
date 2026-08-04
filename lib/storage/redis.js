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

function ownerIndexKey(owner) { return `council:convs:${owner.toLowerCase()}`; }

export async function createConversation(models, owner) {
    const id = crypto.randomUUID();
    const c = { id, created_at: new Date().toISOString(), title: 'New Conversation', models, messages: [], owner: owner || null };
    const r = getClient();
    const score = Date.parse(c.created_at);
    await r.set(KEY_PREFIX + id, c);
    await r.zadd(INDEX_KEY, { score, member: id });
    if (owner) await r.zadd(ownerIndexKey(owner), { score, member: id });
    return c;
}

export async function listConversations(owner) {
    const r = getClient();
    const ids = await r.zrange(owner ? ownerIndexKey(owner) : INDEX_KEY, 0, -1, { rev: true });
    if (!ids.length) return [];
    const rows = await r.mget(...ids.map(id => KEY_PREFIX + id));
    return rows
        .filter(Boolean)
        .map(c => ({ id: c.id, created_at: c.created_at, title: c.title, message_count: c.messages.length, models: c.models, owner: c.owner }));
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

// --- Accounts: groups, users, run counters ---
// Keys: auth:group:{id} JSON, auth:groupcode:{CODE} -> id, auth:groups:index zset,
// auth:user:{email} JSON, auth:users:index zset, auth:runs:{email}:{date} counter.

export async function putGroup(group) {
    const r = getClient();
    const prev = await r.get(`auth:group:${group.id}`);
    if (prev?.code && prev.code !== group.code) await r.del(`auth:groupcode:${prev.code}`);
    await r.set(`auth:group:${group.id}`, group);
    if (group.code) await r.set(`auth:groupcode:${group.code}`, group.id);
    await r.zadd('auth:groups:index', { score: Date.parse(group.created_at) || Date.now(), member: group.id });
    return group;
}

export async function getGroup(id) {
    return (await getClient().get(`auth:group:${id}`)) || null;
}

export async function getGroupByCode(code) {
    if (!code) return null;
    const id = await getClient().get(`auth:groupcode:${code.trim().toUpperCase()}`);
    return id ? await getGroup(id) : null;
}

export async function listGroups() {
    const r = getClient();
    const ids = await r.zrange('auth:groups:index', 0, -1, { rev: true });
    if (!ids.length) return [];
    const rows = await r.mget(...ids.map(id => `auth:group:${id}`));
    return rows.filter(Boolean);
}

export async function deleteGroup(id) {
    const r = getClient();
    const g = await r.get(`auth:group:${id}`);
    if (g?.code) await r.del(`auth:groupcode:${g.code}`);
    await r.del(`auth:group:${id}`);
    await r.zrem('auth:groups:index', id);
}

export async function putUser(user) {
    const r = getClient();
    const email = user.email.toLowerCase();
    await r.set(`auth:user:${email}`, user);
    await r.zadd('auth:users:index', { score: Date.parse(user.enrolled_at) || Date.now(), member: email });
    return user;
}

export async function getUser(email) {
    return email ? (await getClient().get(`auth:user:${email.toLowerCase()}`)) || null : null;
}

export async function listUsers() {
    const r = getClient();
    const emails = await r.zrange('auth:users:index', 0, -1, { rev: true });
    if (!emails.length) return [];
    const rows = await r.mget(...emails.map(e => `auth:user:${e}`));
    return rows.filter(Boolean);
}

export async function deleteUser(email) {
    const r = getClient();
    await r.del(`auth:user:${email.toLowerCase()}`);
    await r.zrem('auth:users:index', email.toLowerCase());
}

export async function incrRunCount(email, date) {
    const r = getClient();
    const key = `auth:runs:${email.toLowerCase()}:${date}`;
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, 172800); // 48h — outlives the UTC day it counts
    return count;
}

export async function getRunCount(email, date) {
    const v = await getClient().get(`auth:runs:${email.toLowerCase()}:${date}`);
    return Number(v) || 0;
}

// Lifetime spend per user, so an admin can see what a workshop is costing.
export async function addRunCost(email, cost) {
    if (!cost) return 0;
    return await getClient().incrbyfloat(`auth:spend:${email.toLowerCase()}`, cost);
}

export async function getRunCost(email) {
    const v = await getClient().get(`auth:spend:${email.toLowerCase()}`);
    return Number(v) || 0;
}
