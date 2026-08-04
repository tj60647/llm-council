// Storage facade. All methods are async so adapters may be backed by network
// stores; the memory adapter's sync returns are awaited harmlessly.
// Selection: STORAGE_ADAPTER env wins ('memory' | 'redis'); otherwise redis is
// auto-selected when Upstash/Vercel KV env vars are present, else memory.
// NOTE: memory does not survive across serverless instances — deployments need
// redis (or another persistent adapter) to work on Vercel.
import * as memory from './memory.js';
import * as redis from './redis.js';

function selectAdapter() {
    const explicit = process.env.STORAGE_ADAPTER;
    if (explicit === 'redis') return 'redis';
    if (explicit === 'memory') return 'memory';
    return redis.isConfigured() ? 'redis' : 'memory';
}

function impl() { return selectAdapter() === 'redis' ? redis : memory; }

// Conversations
export async function createConversation(models, owner) { return impl().createConversation(models, owner); }
export async function listConversations(owner) { return impl().listConversations(owner); }
export async function getConversation(id) { return impl().getConversation(id); }
export async function updateTitle(id, title) { return impl().updateTitle(id, title); }
export async function addUserMessage(id, content) { return impl().addUserMessage(id, content); }
export async function addAssistantMessage(id, payload) { return impl().addAssistantMessage(id, payload); }
export async function conversationCount() { return impl().conversationCount(); }
export async function updateConversationModels(id, models) { return impl().updateConversationModels(id, models); }

// Accounts (groups, users, run counters)
export async function putGroup(group) { return impl().putGroup(group); }
export async function getGroup(id) { return impl().getGroup(id); }
export async function getGroupByCode(code) { return impl().getGroupByCode(code); }
export async function listGroups() { return impl().listGroups(); }
export async function deleteGroup(id) { return impl().deleteGroup(id); }
export async function putUser(user) { return impl().putUser(user); }
export async function getUser(email) { return impl().getUser(email); }
export async function listUsers() { return impl().listUsers(); }
export async function deleteUser(email) { return impl().deleteUser(email); }
export async function incrRunCount(email, date) { return impl().incrRunCount(email, date); }
export async function getRunCount(email, date) { return impl().getRunCount(email, date); }
export async function addRunCost(email, cost) { return impl().addRunCost(email, cost); }
export async function getRunCost(email) { return impl().getRunCost(email); }

export function adapterName() { return selectAdapter(); }
