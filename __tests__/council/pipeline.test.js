import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryModel, streamModel, queryModelsParallel } from '../../lib/openrouter/queryModel.js';
import { stage1CollectResponses } from '../../lib/council/stage1CollectResponses.js';
import { stage2CollectRankings } from '../../lib/council/stage2CollectRankings.js';
import { PROMPT_TEMPLATES, promptsForSeat, stage2RankingPrompt } from '../../lib/council/prompts.js';

process.env.OPENROUTER_API_KEY = 'test-key';

function jsonResponse(body) {
    return { ok: true, json: async () => body };
}

// Streams the given strings as separate network chunks so tests can split SSE
// frames at arbitrary byte boundaries.
function sseResponse(chunks) {
    const encoder = new TextEncoder();
    let i = 0;
    return {
        ok: true,
        body: {
            getReader: () => ({
                read: async () => (i < chunks.length
                    ? { done: false, value: encoder.encode(chunks[i++]) }
                    : { done: true, value: undefined })
            })
        }
    };
}

describe('queryModel', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('requests usage accounting and returns cost, tokens, and elapsed ms', async () => {
        global.fetch = vi.fn().mockResolvedValue(jsonResponse({
            choices: [{ message: { content: 'hello' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.00042 }
        }));

        const r = await queryModel('test/model', [{ role: 'user', content: 'hi' }]);

        expect(r.content).toBe('hello');
        expect(r.usage).toMatchObject({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.00042 });
        expect(typeof r.ms).toBe('number');

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.usage).toEqual({ include: true });
    });

    it('returns null usage when the provider omits it', async () => {
        global.fetch = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'x' } }] }));
        const r = await queryModel('test/model', []);
        expect(r.usage).toBeNull();
    });

    it('throws on a non-ok response', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });
        await expect(queryModel('test/model', [])).rejects.toThrow(/502/);
    });
});

describe('streamModel', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('assembles deltas and captures usage from the final chunk', async () => {
        global.fetch = vi.fn().mockResolvedValue(sseResponse([
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
            'data: {"usage":{"total_tokens":7,"cost":0.001}}\n\n',
            'data: [DONE]\n\n'
        ]));

        const deltas = [];
        const r = await streamModel('test/model', [], { onDelta: d => deltas.push(d) });

        expect(deltas).toEqual(['Hel', 'lo']);
        expect(r.content).toBe('Hello');
        expect(r.usage).toMatchObject({ total_tokens: 7, cost: 0.001 });
    });

    it('handles frames split across chunk boundaries', async () => {
        // A single SSE frame arriving in three pieces, mid-JSON
        global.fetch = vi.fn().mockResolvedValue(sseResponse([
            'data: {"choices":[{"del',
            'ta":{"content":"split ok"}}]}',
            '\n\ndata: [DONE]\n\n'
        ]));

        const r = await streamModel('test/model', []);
        expect(r.content).toBe('split ok');
    });

    it('ignores keep-alive comments and blank frames', async () => {
        global.fetch = vi.fn().mockResolvedValue(sseResponse([
            ': OPENROUTER PROCESSING\n\n',
            'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'
        ]));
        const r = await streamModel('test/model', []);
        expect(r.content).toBe('ok');
    });
});

describe('parallel collection', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('reports each model as it settles, including failures', async () => {
        global.fetch = vi.fn().mockImplementation((_url, opts) => {
            const model = JSON.parse(opts.body).model;
            if (model === 'bad/model') return Promise.reject(new Error('provider down'));
            return Promise.resolve(jsonResponse({
                choices: [{ message: { content: `answer from ${model}` } }],
                usage: { total_tokens: 3, cost: 0.0001 }
            }));
        });

        const settled = [];
        const out = await queryModelsParallel(['good/one', 'bad/model'], [], {
            onSettled: (model, r, err) => settled.push({ model, ok: !err })
        });

        expect(settled).toHaveLength(2);
        expect(settled.find(s => s.model === 'bad/model').ok).toBe(false);
        expect(out['good/one'].content).toBe('answer from good/one');
        expect(out['bad/model']).toBeNull();
    });
});

describe('council stages', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockImplementation((_url, opts) => {
            const model = JSON.parse(opts.body).model;
            return Promise.resolve(jsonResponse({
                choices: [{ message: { content: `FINAL RANKING:\n1. Response A\n2. Response B (from ${model})` } }],
                usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10, cost: 0.0002 }
            }));
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('stage 1 streams per-model entries and carries usage through', async () => {
        const seen = [];
        const results = await stage1CollectResponses('q', ['a/one', 'b/two'], { onModel: e => seen.push(e) });

        expect(seen).toHaveLength(2);
        expect(results).toHaveLength(2);
        expect(results[0].usage.cost).toBe(0.0002);
        expect(typeof results[0].ms).toBe('number');
    });

    it('stage 2 anonymizes responses and parses rankings', async () => {
        const stage1 = [{ model: 'a/one', response: 'first' }, { model: 'b/two', response: 'second' }];
        const seen = [];
        const { stage2Results, labelToModel } = await stage2CollectRankings('q', stage1, ['a/one', 'b/two'], { onModel: e => seen.push(e) });

        expect(labelToModel).toEqual({ 'Response A': 'a/one', 'Response B': 'b/two' });
        expect(seen).toHaveLength(2);
        expect(stage2Results[0].parsed_ranking).toEqual(['Response A', 'Response B']);

        // The prompt must not leak model identities into peer review
        const sentPrompt = JSON.parse(global.fetch.mock.calls[0][1].body).messages[0].content;
        expect(sentPrompt).toContain('Response A:');
        expect(sentPrompt).not.toContain('a/one');
    });
});

describe('prompt templates', () => {
    it('use the same builders the runtime sends', () => {
        expect(PROMPT_TEMPLATES).toHaveLength(3);
        expect(PROMPT_TEMPLATES[1].template).toBe(stage2RankingPrompt('{your question}', '{Response A…N, anonymized}'));
    });

    it('shows a seat only the stages it actually performs', () => {
        // The chairperson chairs, so only seat 0 is shown the synthesis prompt.
        expect(promptsForSeat(0).map(t => t.stage)).toEqual([
            'Stage 1 — Answer', 'Stage 2 — Peer review', 'Stage 3 — Synthesis'
        ]);
        for (const seat of [1, 2, 6]) {
            const stages = promptsForSeat(seat).map(t => t.stage);
            expect(stages).toEqual(['Stage 1 — Answer', 'Stage 2 — Peer review']);
            expect(stages.some(s => s.includes('Stage 3'))).toBe(false);
        }
    });
});
