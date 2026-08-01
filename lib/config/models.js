// Default council seats. IDs must be valid OpenRouter model IDs; retired IDs
// silently produce null stage results, so verify against the live catalog
// (GET /api/v1/models) when councils start returning empty responses.
// Last verified against OpenRouter: 2026-07-31.
export const DEFAULT_COUNCIL_MODELS = [
    'google/gemini-3.1-pro-preview',
    'openai/gpt-5.5',
    'anthropic/claude-sonnet-5',
    'x-ai/grok-4.5'
];

// Seat 0 acts as chairperson by convention; this constant is the fallback when a
// conversation has no models configured.
export const DEFAULT_CHAIRPERSON_MODEL = 'google/gemini-3.1-pro-preview';
