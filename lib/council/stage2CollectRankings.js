import { queryModelsParallel } from '../openrouter/queryModel.js';
import { parseRankingFromText } from './parseRanking.js';
import { stage2RankingPrompt } from './prompts.js';

export async function stage2CollectRankings(userQuery, stage1Results, models, { onModel } = {}) {
    const labels = stage1Results.map((_, i) => String.fromCharCode(65 + i));
    const labelToModel = Object.fromEntries(labels.map((L, i) => [`Response ${L}`, stage1Results[i].model]));
    const responsesText = labels.map((L, i) => `Response ${L}:\n${stage1Results[i].response}`).join('\n\n');
    const messages = [{ role: 'user', content: stage2RankingPrompt(userQuery, responsesText) }];
    const raw = await queryModelsParallel(models, messages, {
        onSettled: (model, r, err) => {
            if (!onModel) return;
            onModel(err
                ? { model, error: err.message }
                : { model, ranking: r.content, parsed_ranking: parseRankingFromText(r.content), usage: r.usage, ms: r.ms });
        }
    });
    const out = [];
    for (const model of models) {
        const r = raw[model];
        if (r) {
            const full = r.content;
            out.push({ model, ranking: full, parsed_ranking: parseRankingFromText(full), usage: r.usage, ms: r.ms });
        }
    }
    return { stage2Results: out, labelToModel };
}
