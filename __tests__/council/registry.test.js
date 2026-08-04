import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchCatalog, checkModelIds, registryBase } from '../../lib/openrouter/registry.js';

const registryRow = (over = {}) => ({
    id: 'acme/model-a', provider: 'acme', displayName: 'Acme: Model A',
    description: 'x'.repeat(500), modality: 'text+image->text',
    contextLength: 256000, maxCompletionTokens: 4096,
    inputPricePer1k: 0.002, outputPricePer1k: 0.008,
    createdAt: '2026-01-02T00:00:00.000Z',
    supportedParameters: ['tools', 'reasoning', 'structured_outputs'],
    retiredAt: null, isAvailable: true, ...over
});

const ok = (body) => ({ ok: true, json: async () => body });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('catalog from the registry', () => {
    it('normalizes registry records, converting per-1K prices to per-token', async () => {
        global.fetch = vi.fn().mockResolvedValue(ok({ models: [registryRow()] }));

        const { models, source } = await fetchCatalog();
        const m = models[0];

        expect(source).toBe('registry');
        expect(m).toMatchObject({
            id: 'acme/model-a', name: 'Acme: Model A', provider: 'acme',
            context_length: 256000, max_completion_tokens: 4096, available: true, retired_at: null
        });
        // 0.002 per 1K === 0.000002 per token, which is what the UI formatter expects
        expect(m.pricing.prompt).toBeCloseTo(0.000002, 12);
        expect(m.pricing.completion).toBeCloseTo(0.000008, 12);
        expect(m.modalities).toEqual(['text', 'image']);
        expect(m.caps).toMatchObject({ vision: true, tools: true, reasoning: true, structured: true });
        expect(m.description.length).toBeLessThanOrEqual(220);
        expect(typeof m.created).toBe('number');
    });

    it('keeps retired models and counts them', async () => {
        global.fetch = vi.fn().mockResolvedValue(ok({
            models: [registryRow(), registryRow({ id: 'acme/old', isAvailable: false, retiredAt: '2026-05-17T00:00:00Z' })]
        }));

        const { models, retired_count } = await fetchCatalog();

        expect(models).toHaveLength(2);
        expect(retired_count).toBe(1);
        expect(models.find(m => m.id === 'acme/old')).toMatchObject({ available: false, retired_at: '2026-05-17T00:00:00Z' });
    });

    it('falls back to OpenRouter when the registry fails', async () => {
        global.fetch = vi.fn()
            .mockRejectedValueOnce(new Error('registry down'))
            .mockResolvedValueOnce(ok({
                data: [{
                    id: 'openai/gpt-x', name: 'GPT X', context_length: 1000,
                    pricing: { prompt: '0.000003', completion: '0.000015' },
                    architecture: { input_modalities: ['text'] }, supported_parameters: ['tools'], created: 1700000000
                }]
            }));

        const { models, source } = await fetchCatalog();

        expect(source).toBe('openrouter');
        expect(models[0]).toMatchObject({ id: 'openai/gpt-x', provider: 'openai', available: true });
        // OpenRouter cannot report retirement, so nothing is marked dead
        expect(models.every(m => m.available)).toBe(true);
    });

    it('skips the registry entirely when disabled', async () => {
        vi.stubEnv('MODEL_REGISTRY_URL', 'off');
        expect(registryBase()).toBeNull();
        global.fetch = vi.fn().mockResolvedValue(ok({ data: [] }));

        const { source } = await fetchCatalog();

        expect(source).toBe('openrouter');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain('openrouter.ai');
    });

    it('honours a custom registry URL', async () => {
        vi.stubEnv('MODEL_REGISTRY_URL', 'https://registry.example.com/');
        global.fetch = vi.fn().mockResolvedValue(ok({ models: [registryRow()], count: 1 }));

        await fetchCatalog();

        expect(global.fetch.mock.calls[0][0]).toBe('https://registry.example.com/api/models?limit=500&offset=0');
    });

    it('pages through a catalog larger than one request', async () => {
        // The registry caps limit at 500; a full page must trigger another fetch
        const page = (n, startId) => Array.from({ length: n }, (_, i) => registryRow({ id: `acme/m${startId + i}` }));
        global.fetch = vi.fn()
            .mockResolvedValueOnce(ok({ models: page(500, 0), count: 620 }))
            .mockResolvedValueOnce(ok({ models: page(120, 500), count: 620 }));

        const { models } = await fetchCatalog();

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch.mock.calls[1][0]).toContain('offset=500');
        expect(models).toHaveLength(620);
    });

    it('stops paging when a short page arrives', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce(ok({ models: [registryRow()], count: 1 }));

        const { models } = await fetchCatalog();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(models).toHaveLength(1);
    });
});

describe('checkModelIds', () => {
    const catalog = [
        { id: 'live/one', available: true },
        { id: 'dead/two', available: false }
    ];

    it('separates retired from unknown ids', () => {
        expect(checkModelIds(['live/one'], catalog)).toEqual({ retired: [], unknown: [], ok: true });
        expect(checkModelIds(['dead/two', 'ghost/three'], catalog))
            .toEqual({ retired: ['dead/two'], unknown: ['ghost/three'], ok: false });
    });

    it('treats an empty seat list as fine', () => {
        expect(checkModelIds([], catalog).ok).toBe(true);
        expect(checkModelIds(undefined, catalog).ok).toBe(true);
    });
});
