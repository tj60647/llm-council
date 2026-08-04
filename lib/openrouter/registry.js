// Model catalog client.
//
// Primary source is the OpenRouter Registry (a synced mirror that tracks
// retirement), because OpenRouter's own /models endpoint silently omits
// retired ids — a seat configured with one just returns empty answers, which
// is exactly how this app broke in early 2026. The registry keeps retired
// records with `isAvailable: false`, so a dead seat can be reported instead of
// failing quietly.
//
// Falls back to OpenRouter direct if the registry is unreachable, so an
// outage there degrades the catalog rather than breaking the app.

const DEFAULT_REGISTRY = 'https://openrouter-registry.aroughidea.com';
const OPENROUTER_MODELS = 'https://openrouter.ai/api/v1/models';
const DESCRIPTION_CHARS = 220;
const PAGE_SIZE = 500;   // the registry's maximum
const MAX_PAGES = 10;    // runaway guard; well above the current catalog size

export function registryBase() {
    const configured = process.env.MODEL_REGISTRY_URL;
    if (configured === 'off') return null;
    return (configured || DEFAULT_REGISTRY).replace(/\/$/, '');
}

function capsFrom(params = []) {
    const has = (p) => params.includes(p);
    return {
        vision: false, // set by caller from modalities
        files: false,
        tools: has('tools'),
        reasoning: has('reasoning') || has('include_reasoning'),
        structured: has('structured_outputs')
    };
}

// Registry prices are per 1K tokens; the app's shared formatter expects the
// per-token figures OpenRouter returns, so divide before handing them on.
function perToken(per1k) {
    const n = Number(per1k);
    return isFinite(n) && n >= 0 ? n / 1000 : undefined;
}

function fromRegistry(m) {
    const inputs = String(m.modality || '').split('->')[0].split('+').filter(Boolean);
    const caps = capsFrom(m.supportedParameters || []);
    caps.vision = inputs.includes('image');
    caps.files = inputs.includes('file');
    return {
        id: m.id,
        name: m.displayName || m.id,
        provider: m.provider || (m.id.includes('/') ? m.id.split('/')[0] : 'other'),
        pricing: { prompt: perToken(m.inputPricePer1k), completion: perToken(m.outputPricePer1k) },
        context_length: m.contextLength ?? null,
        max_completion_tokens: m.maxCompletionTokens ?? null,
        created: m.createdAt ? Math.floor(Date.parse(m.createdAt) / 1000) : null,
        modalities: inputs,
        caps,
        description: (m.description || '').slice(0, DESCRIPTION_CHARS),
        available: m.isAvailable !== false,
        retired_at: m.retiredAt || null
    };
}

function fromOpenRouter(m) {
    const inputs = m.architecture?.input_modalities || [];
    const caps = capsFrom(m.supported_parameters || []);
    caps.vision = inputs.includes('image');
    caps.files = inputs.includes('file');
    return {
        id: m.id,
        name: m.name || m.id,
        provider: m.id.includes('/') ? m.id.split('/')[0] : 'other',
        pricing: { prompt: m.pricing?.prompt, completion: m.pricing?.completion },
        context_length: m.context_length ?? m.top_provider?.context_length ?? null,
        max_completion_tokens: m.top_provider?.max_completion_tokens ?? null,
        created: m.created ?? null,
        modalities: inputs,
        caps,
        description: (m.description || '').slice(0, DESCRIPTION_CHARS),
        // OpenRouter only lists live models, so anything present is available
        // and retirement is simply unknowable from this source.
        available: true,
        retired_at: null
    };
}

async function getJson(url, { timeout = 15000, headers = {} } = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(t);
    }
}

// Returns { models, source, retired_count }
export async function fetchCatalog() {
    const base = registryBase();
    if (base) {
        try {
            // Retired models are included on purpose: a seat may still point at
            // one, and it must be reportable rather than merely absent.
            // The registry caps `limit` at 500, so page rather than truncate —
            // the catalog is already 485 records and still growing.
            const rows = [];
            for (let page = 0; page < MAX_PAGES; page++) {
                const data = await getJson(`${base}/api/models?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
                const batch = data.models || [];
                rows.push(...batch);
                const total = typeof data.count === 'number' ? data.count : null;
                if (batch.length < PAGE_SIZE || (total !== null && rows.length >= total)) break;
                if (page === MAX_PAGES - 1) {
                    console.warn(`[catalog] stopped at ${rows.length} models (page cap) — some may be missing`);
                }
            }
            if (rows.length) {
                const models = rows.map(fromRegistry);
                return {
                    models,
                    source: 'registry',
                    retired_count: models.filter(m => !m.available).length
                };
            }
            throw new Error('empty catalog');
        } catch (e) {
            console.warn('[catalog] registry unavailable, falling back to OpenRouter:', e.message);
        }
    }

    const key = process.env.OPENROUTER_API_KEY;
    const data = await getJson(OPENROUTER_MODELS, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
    const models = (data.data || []).map(fromOpenRouter);
    return { models, source: 'openrouter', retired_count: 0 };
}

// Seats pointing at ids that are retired or absent from the catalog produce
// empty council answers; callers use this to warn before a run rather than after.
export function checkModelIds(ids, models) {
    const byId = new Map(models.map(m => [m.id, m]));
    const retired = [], unknown = [];
    for (const id of ids || []) {
        const m = byId.get(id);
        if (!m) unknown.push(id);
        else if (!m.available) retired.push(id);
    }
    return { retired, unknown, ok: retired.length === 0 && unknown.length === 0 };
}
