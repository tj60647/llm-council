import { queryModel } from '../openrouter/queryModel.js';

export async function stage3SynthesizeFinal(userQuery, stage1Results, stage2Results, chairmanModel) {
    const stage1Text = stage1Results.map(r => `Model: ${r.model}\nResponse: ${r.response}`).join('\n\n');
    const stage2Text = stage2Results.map(r => `Model: ${r.model}\nRanking: ${r.ranking}`).join('\n\n');
    const prompt = `You are the Chairman of an LLM Council. Multiple AI models have provided responses and ranked each other.\n\nOriginal Question: ${userQuery}\n\nSTAGE 1 - Responses:\n${stage1Text}\n\nSTAGE 2 - Peer Rankings:\n${stage2Text}\n\nTask: Synthesize a single comprehensive, accurate answer representing collective wisdom:`;
    const messages = [{ role: 'user', content: prompt }];
    try {
        const r = await queryModel(chairmanModel, messages);
        return { model: chairmanModel, response: r.content };
    } catch (e) {
        return { model: chairmanModel, response: 'Error generating synthesis.' };
    }
}
