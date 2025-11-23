export function parseRankingFromText(rankingText) {
    const FINAL = 'FINAL RANKING:';
    const patternNumbered = /\d+\.\s*Response [A-Z]/g;
    if (rankingText.includes(FINAL)) {
        const section = rankingText.split(FINAL)[1] || '';
        const numbered = section.match(patternNumbered);
        if (numbered) {
            return numbered.map(line => (line.match(/Response [A-Z]/) || [''])[0]).filter(Boolean);
        }
        const generic = section.match(/Response [A-Z]/g);
        if (generic) return generic;
    }
    const fallback = rankingText.match(/Response [A-Z]/g);
    return fallback || [];
}
