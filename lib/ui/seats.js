// Seat role palette, taken from the council logo: the chairman is the solid
// blue-grey circle, members are the lighter shapes around the table.
export const CHAIR_FILL = '#8fa3b8';
export const CHAIR_BORDER = '#6d8399';
const MEMBER_FILLS = ['#dce3ea', '#c7d1dc', '#cfd8e0', '#b3c0cd', '#d4dce4', '#c2ccd7'];
const MEMBER_BORDER = '#a9b7c4';

// Role is never carried by color alone — the seat number badge and the
// title/label say "chairman" too.
export function seatStyle(index) {
    if (index === 0) {
        return { role: 'chairman', fill: CHAIR_FILL, border: CHAIR_BORDER, badgeBg: '#1e242c', badgeText: '#fff' };
    }
    return {
        role: 'member',
        fill: MEMBER_FILLS[(index - 1) % MEMBER_FILLS.length],
        border: MEMBER_BORDER,
        badgeBg: '#ffffff',
        badgeText: '#52514e'
    };
}

export function shortModelName(id) {
    return typeof id === 'string' ? id.replace(/^[^/]+\//, '') : '';
}
