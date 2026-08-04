import { NextResponse } from 'next/server';
import { requireUser, allowedModelIds } from '../../../lib/auth/guard.js';

let cache = { ts: 0, data: null };
const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function resetCache() { cache = { ts: 0, data: null }; }

// Restrict the catalog to the caller's group entitlement so pickers only
// offer models the server would accept.
function scoped(data, ctx) {
    const allowed = allowedModelIds(ctx);
    if (!allowed) return data;
    const models = data.models.filter(m => allowed.has(m.id));
    return { models, count: models.length };
}

export async function GET(req) {
    const gate = await requireUser(req);
    if (!gate.ok) return gate.response;
    const now = Date.now();
    if (cache.data && (now - cache.ts) < TTL_MS) {
        return NextResponse.json(scoped(cache.data, gate.ctx));
    }
    try {
        const key = process.env.OPENROUTER_API_KEY;
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: key ? { 'Authorization': `Bearer ${key}` } : {}
        });
        if (!res.ok) throw new Error('Failed to fetch model catalog');
        const data = await res.json();
        // Normalize the fields the picker actually shows. Params are reduced to
        // a few booleans so the client doesn't ship the full parameter list.
        const models = (data.data || []).map(m => {
            const params = m.supported_parameters || [];
            const inputs = m.architecture?.input_modalities || [];
            return {
                id: m.id,
                name: m.name,
                provider: m.id.includes('/') ? m.id.split('/')[0] : 'other',
                pricing: { prompt: m.pricing?.prompt, completion: m.pricing?.completion },
                context_length: m.context_length ?? m.top_provider?.context_length ?? null,
                max_completion_tokens: m.top_provider?.max_completion_tokens ?? null,
                created: m.created ?? null,
                modalities: inputs,
                caps: {
                    vision: inputs.includes('image'),
                    files: inputs.includes('file'),
                    tools: params.includes('tools'),
                    reasoning: params.includes('reasoning') || params.includes('include_reasoning'),
                    structured: params.includes('structured_outputs')
                },
                description: m.description?.slice(0, 400) || ''
            };
        });
        models.sort((a, b) => (b.created || 0) - (a.created || 0));
        cache = { ts: now, data: { models, count: models.length } };
        return NextResponse.json(scoped(cache.data, gate.ctx));
    } catch (e) {
        return NextResponse.json({ error: e.message, models: [], count: 0 }, { status: 500 });
    }
}
