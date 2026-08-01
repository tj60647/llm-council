// Council prompt templates. Kept in one module with no server-only imports so
// the UI can show a seat exactly what it will be asked, verbatim.
//
// Note: the council sends these as user-role messages — no system message is
// used, so a seat's behavior comes entirely from the text below plus whatever
// the provider bakes into the model.

export function stage1Messages(userQuery) {
    return [{ role: 'user', content: userQuery }];
}

export function stage2RankingPrompt(userQuery, responsesText) {
    return `You are evaluating different responses to the following question:\n\nQuestion: ${userQuery}\n\nHere are the responses from different models (anonymized):\n\n${responsesText}\n\nYour task:\n1. Evaluate each response individually.\n2. Provide a final ranking.\n\nIMPORTANT: Final ranking format EXACTLY:\nFINAL RANKING:\n1. Response X\n2. Response Y\n...\n\nNow provide your evaluation and ranking:`;
}

export function stage3ChairpersonPrompt(userQuery, stage1Text, stage2Text) {
    return `You are the Chairperson of an LLM Council. Multiple AI models have provided responses and ranked each other.\n\nOriginal Question: ${userQuery}\n\nSTAGE 1 - Responses:\n${stage1Text}\n\nSTAGE 2 - Peer Rankings:\n${stage2Text}\n\nTask: Synthesize a single comprehensive, accurate answer representing collective wisdom:`;
}

export function titlePrompt(userQuery) {
    return `Generate a very short title (3-5 words) summarizing the question. No quotes or punctuation.\n\nQuestion: ${userQuery}\n\nTitle:`;
}

// Display copies for the seat inspector. `{...}` marks runtime substitution.
export const PROMPT_TEMPLATES = [
    {
        stage: 'Stage 1 — Answer',
        appliesTo: 'every seat',
        summary: 'The seat receives your question verbatim, with no council framing and no shared context. Answers are independent by design.',
        template: '{your question}'
    },
    {
        stage: 'Stage 2 — Peer review',
        appliesTo: 'every seat',
        summary: "The seat sees all Stage 1 answers anonymized as Response A, B, C… — including its own — and must return a ranking in a fixed format the app parses.",
        template: stage2RankingPrompt('{your question}', '{Response A…N, anonymized}')
    },
    {
        stage: 'Stage 3 — Synthesis',
        appliesTo: 'the chairperson',
        chairOnly: true,
        summary: 'The chairperson sees every answer with model names attached plus every peer ranking, and writes the final answer.',
        template: stage3ChairpersonPrompt('{your question}', '{all Stage 1 answers, attributed}', '{all Stage 2 rankings}')
    }
];

// The prompts a given seat actually receives — seat 0 chairs, so only it gets
// the synthesis prompt. Non-chair seats are never shown a stage they sit out.
export function promptsForSeat(seatIndex) {
    return PROMPT_TEMPLATES.filter(t => !t.chairOnly || seatIndex === 0);
}
