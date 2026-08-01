import { describe, it, expect, beforeEach } from 'vitest';
import * as redis from '../../lib/storage/redis.js';

// Minimal in-memory fake of the @upstash/redis client surface the adapter uses.
function makeFakeRedis() {
    const kv = new Map();
    const zsets = new Map();
    return {
        async get(key) { return kv.has(key) ? kv.get(key) : null; },
        async set(key, value) { kv.set(key, value); },
        async mget(...keys) { return keys.map(k => (kv.has(k) ? kv.get(k) : null)); },
        async zadd(key, { score, member }) {
            if (!zsets.has(key)) zsets.set(key, new Map());
            zsets.get(key).set(member, score);
        },
        async zrange(key, start, stop, opts = {}) {
            const z = zsets.get(key);
            if (!z) return [];
            const sorted = [...z.entries()].sort((a, b) => a[1] - b[1]).map(([m]) => m);
            if (opts.rev) sorted.reverse();
            return stop === -1 ? sorted.slice(start) : sorted.slice(start, stop + 1);
        },
        async zcard(key) { return zsets.get(key)?.size || 0; }
    };
}

describe('redis storage adapter', () => {
    beforeEach(() => {
        redis.__setTestClient(makeFakeRedis());
    });

    it('creates and retrieves a conversation', async () => {
        const c = await redis.createConversation(['model-a']);
        expect(c.id).toBeDefined();
        const fetched = await redis.getConversation(c.id);
        expect(fetched).toMatchObject({ id: c.id, title: 'New Conversation', models: ['model-a'], messages: [] });
    });

    it('returns null for a missing conversation', async () => {
        expect(await redis.getConversation('nope')).toBeNull();
    });

    it('lists conversations with metadata', async () => {
        const a = await redis.createConversation(['m1']);
        const b = await redis.createConversation(['m2']);
        const list = await redis.listConversations();
        expect(list).toHaveLength(2);
        expect(list.map(x => x.id)).toEqual(expect.arrayContaining([a.id, b.id]));
        expect(list[0]).toHaveProperty('message_count', 0);
        expect(await redis.conversationCount()).toBe(2);
    });

    it('persists messages and title updates', async () => {
        const c = await redis.createConversation(['m1']);
        await redis.addUserMessage(c.id, 'hello');
        await redis.addAssistantMessage(c.id, { stage1: [], stage2: [], stage3: 'answer' });
        await redis.updateTitle(c.id, 'Greetings');
        const fetched = await redis.getConversation(c.id);
        expect(fetched.messages).toHaveLength(2);
        expect(fetched.messages[0]).toEqual({ role: 'user', content: 'hello' });
        expect(fetched.messages[1].stage3).toBe('answer');
        expect(fetched.title).toBe('Greetings');
    });

    it('updates and caps seat models at 7', async () => {
        const c = await redis.createConversation(['m1']);
        const nine = Array.from({ length: 9 }, (_, i) => `model-${i}`);
        const updated = await redis.updateConversationModels(c.id, nine);
        expect(updated.models).toHaveLength(7);
        const fetched = await redis.getConversation(c.id);
        expect(fetched.models).toHaveLength(7);
    });
});
