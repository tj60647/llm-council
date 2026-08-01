export function formatMs(ms) {
    if (typeof ms !== 'number' || !isFinite(ms)) return null;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60000);
    return `${m}m ${Math.round((ms % 60000) / 1000)}s`;
}

// OpenRouter reports cost in credits (1 credit = $1). Sub-cent runs are the
// norm here, so show enough precision to be meaningful.
export function formatCost(cost) {
    if (typeof cost !== 'number' || !isFinite(cost)) return null;
    if (cost === 0) return '$0';
    if (cost < 0.01) return `$${cost.toFixed(5)}`;
    return `$${cost.toFixed(4)}`;
}

export function formatTokens(usage) {
    if (!usage) return null;
    const total = usage.total_tokens;
    if (typeof total !== 'number') return null;
    const parts = [];
    if (typeof usage.prompt_tokens === 'number') parts.push(`${usage.prompt_tokens.toLocaleString()} in`);
    if (typeof usage.completion_tokens === 'number') parts.push(`${usage.completion_tokens.toLocaleString()} out`);
    return parts.length ? `${total.toLocaleString()} tokens (${parts.join(' · ')})` : `${total.toLocaleString()} tokens`;
}

// "model · 2.4s · $0.0012 · 1,204 tokens" — omits whatever is unavailable
export function statLine({ ms, usage }) {
    const bits = [formatMs(ms), formatCost(usage?.cost), formatTokens(usage)].filter(Boolean);
    return bits;
}
