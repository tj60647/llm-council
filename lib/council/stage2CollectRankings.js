import { queryModelsParallel } from '../openrouter/queryModel.js';
import { parseRankingFromText } from './parseRanking.js';

export async function stage2CollectRankings(userQuery, stage1Results, models) {
    const labels = stage1Results.map((_, i) => String.fromCharCode(65 + i));
    const labelToModel = Object.fromEntries(labels.map((L, i) => [`Response ${L}`, stage1Results[i].model]));
    const responsesText = labels.map((L, i) => `Response ${L}:\n${stage1Results[i].response}`).join('\n\n');
    const rankingPrompt = `You are evaluating different responses to the following question:\n\nQuestion: ${userQuery}\n\nHere are the responses from different models (anonymized):\n\n${responsesText}\n\nYour task:\n1. Evaluate each response individually.\n2. Provide a final ranking.\n\nIMPORTANT: Final ranking format EXACTLY:\nFINAL RANKING:\n1. Response X\n2. Response Y\n...\n\nNow provide your evaluation and ranking:`;
    const messages = [{ role: 'user', content: rankingPrompt }];
    const raw = await queryModelsParallel(models, messages);
    const out = [];
    for (const model of models) {
        const r = raw[model];
        if (r) {
            const full = r.content;
            out.push({ model, ranking: full, parsed_ranking: parseRankingFromText(full) });
        }
    }
    return { stage2Results: out, labelToModel };
}
