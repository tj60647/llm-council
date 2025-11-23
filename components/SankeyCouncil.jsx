"use client";
import { useMemo } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

export default function SankeyCouncil({ conversation }) {
  const diagram = useMemo(() => {
    if(!conversation) return null;
    const models = Array.isArray(conversation.models) ? conversation.models : [];
    // Determine latest assistant message for stages
    const assistantMsgs = conversation.messages.filter(m => m.role==='assistant');
    const last = assistantMsgs[assistantMsgs.length-1] || {};
    const stage1 = last.stage1 || [];
    const stage2 = last.stage2 || [];
    const aggregateData = last.metadata?.aggregate_rankings || [];
    const stage3 = last.stage3;

    // Status flags
    const stage1Done = stage1 && stage1.length > 0;
    const stage2Done = stage2 && stage2.length > 0 && aggregateData && aggregateData.length > 0;
    const stage3Done = !!stage3;

    // Build baseline nodes from seats even if stages not done yet
    const responseNodes = (stage1Done ? stage1.map(r => r.model) : models).map(m => ({ name: `Resp:${m.replace(/^[^/]+\//,'')}`, model: m }));
    // Evaluators assumed to be each seat model
    const evaluatorNodes = (stage2Done ? stage2.map(e => e.model) : models).map(m => ({ name: `Eval:${m.replace(/^[^/]+\//,'')}`, model: m }));
    const aggregateNode = { name: 'Aggregate' };
    const chairmanName = 'Chairman';
    const finalName = 'User (Answer)';
    const nodes = [ { name: 'User' }, ...responseNodes, ...evaluatorNodes, aggregateNode, { name: chairmanName }, { name: finalName } ];

    // Indices
    const userIdx = 0;
    const firstResponseIdx = 1;
    const firstEvalIdx = 1 + responseNodes.length;
    const aggregateIdx = nodes.length - 3;
    const chairmanIdx = nodes.length - 2;
    const finalIdx = nodes.length - 1;

    // Aggregate ranking map for tinting
    const rankMap = new Map();
    aggregateData.forEach(r => { if(r.model && typeof r.average_rank === 'number') rankMap.set(r.model, r.average_rank); });
    const maxRank = Math.max(...Array.from(rankMap.values()), 1);
    const minRank = Math.min(...Array.from(rankMap.values()), 1);
    const norm = (rank) => {
      if(maxRank === minRank) return 0.5; // neutral
      return (rank - minRank) / (maxRank - minRank);
    };
    const lerpColor = (t) => { // t in [0,1] from low(good) green to high(bad) orange
      const g = {r:46,g:204,b:113}; // #2ecc71
      const o = {r:255,g:159,b:67}; // #ff9f43
      const r = Math.round(g.r + (o.r - g.r)*t);
      const gg = Math.round(g.g + (o.g - g.g)*t);
      const b = Math.round(g.b + (o.b - g.b)*t);
      return `rgb(${r},${gg},${b})`;
    };

    // Links skeleton always present
    const links = [];
    // User -> Response seats
    responseNodes.forEach((rn,i) => {
      links.push({ source: userIdx, target: firstResponseIdx + i, value: 2, kind:'user_to_response', model: rn.model });
    });
    // Response -> Evaluator (peer review)
    responseNodes.forEach((rn,ri) => {
      evaluatorNodes.forEach((en,ei) => {
        const respNode = firstResponseIdx + ri;
        const evalNode = firstEvalIdx + ei;
        const isSelf = rn.model === en.model;
        links.push({ source: respNode, target: evalNode, value: isSelf ? 0.6 : 1, kind:'response_to_evaluator', model: rn.model });
      });
    });
    // Evaluator -> Aggregate
    evaluatorNodes.forEach((en,ei) => {
      const evalNode = firstEvalIdx + ei;
      links.push({ source: evalNode, target: aggregateIdx, value: 0.8, kind:'evaluator_to_aggregate' });
    });
    // Aggregate -> Chairman
    links.push({ source: aggregateIdx, target: chairmanIdx, value: 1.2, kind:'aggregate_to_chairman' });
    // Chairman consumes responses (light links post aggregation)
    responseNodes.forEach((rn,i) => {
      links.push({ source: firstResponseIdx + i, target: chairmanIdx, value: 0.4, kind:'response_to_chairman', model: rn.model });
    });
    // Chairman -> Final Answer
    links.push({ source: chairmanIdx, target: finalIdx, value: 1.4, kind:'chairman_to_final' });

    // Compute final synthesis text
    let finalText = '';
    if (typeof stage3 === 'string') finalText = stage3;
    else if (stage3 && typeof stage3 === 'object') { try { finalText = JSON.stringify(stage3,null,2); } catch { finalText = String(stage3); } }

    const sankeyGen = sankey().nodeWidth(18).nodePadding(14).extent([[0,0],[380,300]]);
    const graph = sankeyGen({ nodes: nodes.map((d,i)=>({...d, index:i})), links });
    return { graph, finalText, stage1Done, stage2Done, stage3Done, rankMap, norm, lerpColor };
  }, [conversation]);

  if(!diagram) return <div style={{fontSize:12, color:'#666'}}>Sankey: waiting for data</div>;

  const { graph, finalText, stage1Done, stage2Done, stage3Done, rankMap, norm, lerpColor } = diagram;
  const linkColor = (l) => {
    // Base pending color
    const pending = '#bfbfbf';
    const completeBase = '#4a90e2';
    switch(l.kind){
      case 'user_to_response': return stage1Done ? completeBase : pending;
      case 'response_to_evaluator': {
        if(!stage2Done) return pending;
        const avg = rankMap.get(l.model);
        if(typeof avg === 'number') return lerpColor(norm(avg));
        return completeBase;
      }
      case 'evaluator_to_aggregate': return stage2Done ? completeBase : pending;
      case 'aggregate_to_chairman': return stage2Done ? completeBase : pending;
      case 'response_to_chairman': return stage2Done ? '#6fa8dc' : pending;
      case 'chairman_to_final': return stage3Done ? completeBase : pending;
      default: return pending;
    }
  };
  return (
    <div>
      <svg width={400} height={320} style={{ background:'#fafafa', border:'1px solid #eee', borderRadius:6 }}>
        {graph.links.map((l,i)=>(
          <path key={i} d={sankeyLinkHorizontal()(l)} fill="none" stroke={linkColor(l)} strokeWidth={Math.max(1,l.width)} opacity={0.6} />
        ))}
        {graph.nodes.map((n,i)=>(
          <g key={i} transform={`translate(${n.x0},${n.y0})`}>
            <rect width={n.x1-n.x0} height={n.y1-n.y0} fill={nodeColor(n.name)} rx={4} />
            <text x={(n.x1-n.x0)/2} y={(n.y1-n.y0)/2} fill="#111" fontSize={10} textAnchor="middle" dominantBaseline="middle">{n.name}</text>
          </g>
        ))}
      </svg>
      {finalText && finalText.length > 0 && (
        <div style={{marginTop:8, padding:8, background:'#f4f9ff', border:'1px solid #dbe7f5', borderRadius:4}}>
          <strong>Final Synthesis:</strong>
          <div style={{whiteSpace:'pre-wrap', fontSize:12, marginTop:4}}>{finalText.slice(0,800)}{finalText.length>800?'…':''}</div>
        </div>
      )}
    </div>
  );
}

function nodeColor(name){
  if(name === 'User') return '#e0e0e0';
  if(name.startsWith('Resp:')) return '#d1f0ff';
  if(name.startsWith('Eval:')) return '#ffe6c7';
  if(name === 'Aggregate') return '#ebe1ff';
  if(name === 'Chairman') return '#c8f7d0';
  if(name === 'User (Answer)') return '#faf3b5';
  return '#ddd';
}
