import { queryModel, streamModel } from '../openrouter/queryModel.js';
import { stage3ChairmanPrompt } from './prompts.js';

// Pass onDelta to stream the chairman's answer token by token; without it the
// call is a single blocking request (used by the non-streaming route).
export async function stage3SynthesizeFinal(userQuery, stage1Results, stage2Results, chairmanModel, { onDelta } = {}) {
    const stage1Text = stage1Results.map(r => `Model: ${r.model}\nResponse: ${r.response}`).join('\n\n');
    const stage2Text = stage2Results.map(r => `Model: ${r.model}\nRanking: ${r.ranking}`).join('\n\n');
    const messages = [{ role: 'user', content: stage3ChairmanPrompt(userQuery, stage1Text, stage2Text) }];
    try {
        const r = onDelta
            ? await streamModel(chairmanModel, messages, { onDelta })
            : await queryModel(chairmanModel, messages);
        return { model: chairmanModel, response: r.content, usage: r.usage, ms: r.ms };
    } catch (e) {
        return { model: chairmanModel, response: 'Error generating synthesis.', error: e.message };
    }
}
