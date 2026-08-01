import { queryModelsParallel } from '../openrouter/queryModel.js';
import { stage1Messages } from './prompts.js';

// onModel(entry) fires as each seat finishes so callers can stream progress.
// Failed seats are reported (and kept out of the results) rather than vanishing.
export async function stage1CollectResponses(userQuery, models, { onModel } = {}) {
    const messages = stage1Messages(userQuery);
    const responses = await queryModelsParallel(models, messages, {
        onSettled: (model, r, err) => {
            if (!onModel) return;
            onModel(err
                ? { model, error: err.message }
                : { model, response: r.content, usage: r.usage, ms: r.ms });
        }
    });
    const out = [];
    for (const model of models) {
        const r = responses[model];
        if (r) { out.push({ model, response: r.content, usage: r.usage, ms: r.ms }); }
    }
    return out;
}
