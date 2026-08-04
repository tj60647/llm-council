import { NextResponse } from 'next/server';
import { requireUser, allowedModelIds } from '../../../lib/auth/guard.js';
import { fetchCatalog } from '../../../lib/openrouter/registry.js';

let cache = { ts: 0, data: null };
const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function resetCache() { cache = { ts: 0, data: null }; }

// Restrict the catalog to the caller's group entitlement so pickers only
// offer models the server would accept.
function scoped(data, ctx) {
    const allowed = allowedModelIds(ctx);
    if (!allowed) return data;
    const models = data.models.filter(m => allowed.has(m.id));
    return { ...data, models, count: models.length };
}

export async function GET(req) {
    const gate = await requireUser(req);
    if (!gate.ok) return gate.response;
    const now = Date.now();
    if (cache.data && (now - cache.ts) < TTL_MS) {
        return NextResponse.json(scoped(cache.data, gate.ctx));
    }
    try {
        const { models, source, retired_count } = await fetchCatalog();
        cache = { ts: now, data: { models, count: models.length, source, retired_count } };
        return NextResponse.json(scoped(cache.data, gate.ctx));
    } catch (e) {
        return NextResponse.json({ error: e.message, models: [], count: 0 }, { status: 500 });
    }
}
