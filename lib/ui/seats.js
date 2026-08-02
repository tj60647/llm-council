// Seat role palette, taken from the council logo: the chairperson is the solid
// blue-grey circle, members are the lighter shapes around the table.
//
// Colour encodes ROLE only (chairperson vs member) — never seat identity, which
// the seat number carries. Two contexts need different weights of the same
// role colour:
//   fill — large chips (seat pills), where dark text sits on top
//   mark — small diagram marks (Sankey nodes), which need more weight to read
//          against the link ribbons behind them
export const CHAIR_FILL = '#8fa3b8';
export const CHAIR_BORDER = '#6d8399';
export const MEMBER_FILL = '#dce3ea';
export const MEMBER_BORDER = '#a9b7c4';

// Sankey/diagram marks: chairperson (dark) → member (mid) → structure (empty)
export const CHAIR_MARK = '#5c7286';
export const MEMBER_MARK = '#9fb0c0';
export const STRUCTURE_MARK = '#ffffff';
export const STRUCTURE_BORDER = '#c9d1d9';

export function seatStyle(index) {
    if (index === 0) {
        return {
            role: 'chairperson',
            fill: CHAIR_FILL, border: CHAIR_BORDER, mark: CHAIR_MARK,
            badgeBg: '#1e242c', badgeText: '#fff'
        };
    }
    return {
        role: 'member',
        fill: MEMBER_FILL, border: MEMBER_BORDER, mark: MEMBER_MARK,
        badgeBg: '#ffffff', badgeText: '#52514e'
    };
}

export function shortModelName(id) {
    return typeof id === 'string' ? id.replace(/^[^/]+\//, '') : '';
}
