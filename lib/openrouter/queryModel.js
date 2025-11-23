export async function queryModel(model, messages, { timeout = 120000 } = {}) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY missing');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, messages }),
        signal: controller.signal
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`Model request failed ${res.status}`);
    const data = await res.json();
    const message = data.choices?.[0]?.message || {};
    return {
        content: message.content || '',
        reasoning_details: message.reasoning_details || null
    };
}

export async function queryModelsParallel(models, messages) {
    const results = await Promise.all(models.map(m => queryModel(m, messages).then(r => ({ model: m, r })).catch(e => ({ model: m, error: e.message }))));
    const out = {};
    for (const item of results) { out[item.model] = item.error ? null : item.r; }
    return out;
}
