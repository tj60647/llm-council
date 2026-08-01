const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// `usage: { include: true }` makes OpenRouter return token counts AND the actual
// credit cost of the call, which is what the UI reports per response.
const USAGE_ACCOUNTING = { include: true };

function apiKey() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY missing');
    return key;
}

function normalizeUsage(usage) {
    if (!usage) return null;
    return {
        prompt_tokens: usage.prompt_tokens ?? null,
        completion_tokens: usage.completion_tokens ?? null,
        total_tokens: usage.total_tokens ?? null,
        // OpenRouter returns cost in credits (1 credit === $1 USD)
        cost: typeof usage.cost === 'number' ? usage.cost : null
    };
}

export async function queryModel(model, messages, { timeout = 120000 } = {}) {
    const key = apiKey();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    const started = Date.now();
    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model, messages, usage: USAGE_ACCOUNTING }),
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`Model request failed ${res.status}`);
        const data = await res.json();
        const message = data.choices?.[0]?.message || {};
        return {
            content: message.content || '',
            reasoning_details: message.reasoning_details || null,
            usage: normalizeUsage(data.usage),
            ms: Date.now() - started
        };
    } finally {
        clearTimeout(t);
    }
}

// Token-level streaming. Calls onDelta(textChunk) as content arrives and
// resolves with the assembled result once the stream closes.
export async function streamModel(model, messages, { timeout = 300000, onDelta } = {}) {
    const key = apiKey();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    const started = Date.now();
    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({ model, messages, stream: true, usage: USAGE_ACCOUNTING }),
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`Model request failed ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let content = '';
        let usage = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // SSE frames are separated by a blank line; keep the trailing partial
            const frames = buffer.split('\n');
            buffer = frames.pop() || '';
            for (const line of frames) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(payload);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        content += delta;
                        if (onDelta) onDelta(delta);
                    }
                    // Usage arrives on the final chunk when accounting is enabled
                    if (parsed.usage) usage = normalizeUsage(parsed.usage);
                } catch { /* keep-alive comments and partial frames */ }
            }
        }
        return { content, reasoning_details: null, usage, ms: Date.now() - started };
    } finally {
        clearTimeout(t);
    }
}

// Runs models concurrently. onSettled(model, result|null, error|null) fires as
// each finishes so callers can stream progress instead of waiting for the set.
export async function queryModelsParallel(models, messages, { onSettled } = {}) {
    const results = await Promise.all(models.map(async (model) => {
        try {
            const r = await queryModel(model, messages);
            if (onSettled) onSettled(model, r, null);
            return { model, r };
        } catch (e) {
            if (onSettled) onSettled(model, null, e);
            return { model, error: e.message };
        }
    }));
    const out = {};
    for (const item of results) { out[item.model] = item.error ? null : item.r; }
    return out;
}
