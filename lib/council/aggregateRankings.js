import { parseRankingFromText } from './parseRanking.js';

export function aggregateRankings(stage2Results, labelToModel) {
    const positions = new Map();
    for (const r of stage2Results) {
        const parsed = parseRankingFromText(r.ranking);
        parsed.forEach((label, idx) => {
            const modelName = labelToModel[label];
            if (!modelName) return;
            if (!positions.has(modelName)) positions.set(modelName, []);
            positions.get(modelName).push(idx + 1);
        });
    }
    const aggregate = [];
    for (const [model, arr] of positions.entries()) {
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        aggregate.push({ model, average_rank: Number(avg.toFixed(2)), rankings_count: arr.length });
    }
    aggregate.sort((a, b) => a.average_rank - b.average_rank);
    return aggregate;
}
