import { queryModel } from '../openrouter/queryModel.js';
import { DEFAULT_CHAIRMAN_MODEL } from '../config/models.js';

export async function generateTitle(userQuery) {
    const prompt = `Generate a very short title (3-5 words) summarizing the question. No quotes or punctuation.\n\nQuestion: ${userQuery}\n\nTitle:`;
    try {
        const r = await queryModel(DEFAULT_CHAIRMAN_MODEL, [{ role: 'user', content: prompt }], { timeout: 30000 });
        let title = (r.content || 'New Conversation').trim().replace(/^['"]|['"]$/g, '');
        if (title.length > 50) title = title.slice(0, 47) + '...';
        return title;
    } catch { return 'New Conversation'; }
}
