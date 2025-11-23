import { queryModelsParallel } from '../openrouter/queryModel.js';

export async function stage1CollectResponses(userQuery, models) {
    const messages = [{ role: 'user', content: userQuery }];
    const responses = await queryModelsParallel(models, messages);
    const out = [];
    for (const model of models) {
        const r = responses[model];
        if (r) { out.push({ model, response: r.content }); }
    }
    return out;
}
