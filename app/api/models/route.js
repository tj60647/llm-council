import { NextResponse } from 'next/server';

let cache = { ts: 0, data: null };
const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function resetCache() { cache = { ts: 0, data: null }; }

export async function GET() {
    const now = Date.now();
    if (cache.data && (now - cache.ts) < TTL_MS) {
        return NextResponse.json(cache.data);
    }
    try {
        const key = process.env.OPENROUTER_API_KEY;
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: key ? { 'Authorization': `Bearer ${key}` } : {}
        });
        if (!res.ok) throw new Error('Failed to fetch model catalog');
        const data = await res.json();
        // Normalize subset of fields for UI
        const models = (data.data || []).map(m => ({
            id: m.id,
            name: m.name,
            pricing: m.pricing || {},
            context_length: m.context_length,
            description: m.description?.slice(0, 160) || ''
        }));
        cache = { ts: now, data: { models, count: models.length } };
        return NextResponse.json(cache.data);
    } catch (e) {
        return NextResponse.json({ error: e.message, models: [], count: 0 }, { status: 500 });
    }
}
