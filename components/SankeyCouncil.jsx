"use client";
import { useMemo } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { seatStyle, shortModelName } from '../lib/ui/seats.js';

// Structural view: who reads whom. Seats are labeled by number (matching the
// seat pills) because model names cannot fit in a 400px panel.
// Deliberately NOT quantitative — link widths are uniform per stage rather than
// pretending to encode volume; the ranking chart carries the numbers.

const W = 360;
const PENDING = '#d5d9dd';
const DONE = '#2a78d6';
const INK = '#0b0b0b';
const INK_2 = '#52514e';

export default function SankeyCouncil({ conversation }) {
  const diagram = useMemo(() => {
    if (!conversation) return null;
    const seats = Array.isArray(conversation.models) ? conversation.models : [];
    if (!seats.length) return null;

    const assistant = [...conversation.messages].reverse().find(m => m.role === 'assistant') || null;
    const stage1 = assistant?.stage1 || [];
    const stage2 = assistant?.stage2 || [];
    const aggregate = assistant?.metadata?.aggregate_rankings || [];
    const stage3 = assistant?.stage3;
    const stage1Done = stage1.length > 0;
    const stage2Done = stage2.length > 0 && aggregate.length > 0;
    const stage3Done = Boolean(typeof stage3 === 'string' ? stage3 : stage3?.response);

    const nodes = [
      { name:'You', col:0 },
      ...seats.map((m, i) => ({ name:String(i+1), col:1, seat:i, model:m })),
      ...seats.map((m, i) => ({ name:String(i+1), col:2, seat:i, model:m })),
      { name:'Merge', col:3 },
      { name:'Chair', col:4 },
      { name:'Answer', col:5 }
    ];
    const userIdx = 0;
    const respStart = 1;
    const evalStart = 1 + seats.length;
    const mergeIdx = nodes.length - 3;
    const chairIdx = nodes.length - 2;
    const finalIdx = nodes.length - 1;

    const links = [];
    seats.forEach((_, i) => links.push({ source:userIdx, target:respStart+i, value:1, kind:'ask' }));
    seats.forEach((_, ri) => seats.forEach((_, ei) =>
      links.push({ source:respStart+ri, target:evalStart+ei, value:1/seats.length, kind:'review' })));
    seats.forEach((_, i) => links.push({ source:evalStart+i, target:mergeIdx, value:1, kind:'merge' }));
    links.push({ source:mergeIdx, target:chairIdx, value:seats.length, kind:'chair' });
    links.push({ source:chairIdx, target:finalIdx, value:seats.length, kind:'answer' });

    const height = Math.max(210, seats.length * 30 + 54);
    const gen = sankey().nodeWidth(11).nodePadding(9).extent([[2, 20], [W - 52, height - 8]]);
    const graph = gen({ nodes: nodes.map((d, i) => ({ ...d, index:i })), links });

    // Column captions sit above the first node of each column
    const captions = [];
    for (const col of [0, 1, 2, 3, 4, 5]) {
      const first = graph.nodes.find(n => n.col === col);
      if (first) captions.push({ x: first.x0, label: ['Ask','Answer','Review','Merge','Chair','Final'][col] });
    }
    return { graph, height, captions, stage1Done, stage2Done, stage3Done, seats };
  }, [conversation]);

  if (!diagram) return null;
  const { graph, height, captions, stage1Done, stage2Done, stage3Done, seats } = diagram;

  const linkColor = (l) => {
    switch (l.kind) {
      case 'ask': return stage1Done ? DONE : PENDING;
      case 'review': return stage2Done ? DONE : PENDING;
      case 'merge': return stage2Done ? DONE : PENDING;
      case 'chair': return stage2Done ? DONE : PENDING;
      case 'answer': return stage3Done ? DONE : PENDING;
      default: return PENDING;
    }
  };

  return (
    <figure style={{margin:0}}>
      <figcaption style={{fontSize:12, fontWeight:600, color:INK, marginBottom:2}}>Who reads whom</figcaption>
      <p style={{fontSize:11, color:INK_2, margin:'0 0 6px'}}>
        Numbers are seats. Every seat's answer is read by every seat during review; the chairman then writes the final answer.
      </p>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display:'block', background:'#fcfcfb', border:'1px solid #e1e0d9', borderRadius:6 }} role="img"
        aria-label={`Council flow across ${seats.length} seats`}>
        {captions.map((c, i) => (
          <text key={i} x={c.x} y={12} fontSize={8.5} fill={INK_2}>{c.label}</text>
        ))}
        {graph.links.map((l, i) => (
          <path key={i} d={sankeyLinkHorizontal()(l)} fill="none" stroke={linkColor(l)}
            strokeWidth={Math.max(0.8, l.width)} opacity={l.kind === 'review' ? 0.35 : 0.55} />
        ))}
        {graph.nodes.map((n, i) => {
          const s = typeof n.seat === 'number' ? seatStyle(n.seat) : null;
          const isSeat = Boolean(s);
          return (
            <g key={i}>
              <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(3, n.y1 - n.y0)} rx={3}
                fill={isSeat ? s.fill : '#1e242c'} stroke={isSeat ? s.border : 'none'} />
              <title>{isSeat ? `Seat ${n.seat + 1}: ${shortModelName(n.model)}` : n.name}</title>
              <text x={n.x1 + 3} y={(n.y0 + n.y1) / 2} fontSize={8.5} fill={INK_2} dominantBaseline="middle">{n.name}</text>
            </g>
          );
        })}
      </svg>
      <div style={{display:'flex', gap:14, marginTop:6, fontSize:10.5, color:INK_2}}>
        <span style={{display:'flex', alignItems:'center', gap:5}}>
          <span style={{width:14, height:3, background:DONE, borderRadius:2}}/> done
        </span>
        <span style={{display:'flex', alignItems:'center', gap:5}}>
          <span style={{width:14, height:3, background:PENDING, borderRadius:2}}/> pending
        </span>
      </div>
    </figure>
  );
}
