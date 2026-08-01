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

export async function createConversation(models) { return impl().createConversation(models); }
export async function listConversations() { return impl().listConversations(); }
export async function getConversation(id) { return impl().getConversation(id); }
export async function updateTitle(id, title) { return impl().updateTitle(id, title); }
export async function addUserMessage(id, content) { return impl().addUserMessage(id, content); }
export async function addAssistantMessage(id, payload) { return impl().addAssistantMessage(id, payload); }
export async function conversationCount() { return impl().conversationCount(); }
export async function updateConversationModels(id, models) { return impl().updateConversationModels(id, models); }
export function adapterName() { return selectAdapter(); }
