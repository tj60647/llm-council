"use client";
import { useMemo } from 'react';
import { shortModelName } from '../lib/ui/seats.js';

// Live view of a council run: stage tracker (with per-seat progress while
// streaming) and the consensus ranking, which is the run's actual verdict.

// Status palette — always paired with a text label, never color alone.
const STATUS = {
  pending:  { dot:'#c3c2b7', label:'pending' },
  running:  { dot:'#fab219', label:'running' },
  complete: { dot:'#0ca30c', label:'complete' },
  failed:   { dot:'#d03b3b', label:'failed' }
};
const BAR = '#2a78d6';        // single sequential hue; one series needs no legend
const INK = '#0b0b0b';
const INK_2 = '#52514e';
const MUTED = '#898781';

export default function CouncilFlow({ conversation }) {
  const view = useMemo(() => {
    if (!conversation) return null;
    const seats = Array.isArray(conversation.models) ? conversation.models : [];
    const assistant = [...conversation.messages].reverse().find(m => m.role === 'assistant') || null;
    if (!assistant) return { seats, idle: true };

    const loading = assistant.loading || {};
    const s1 = Array.isArray(assistant.stage1) ? assistant.stage1 : [];
    const s2 = Array.isArray(assistant.stage2) ? assistant.stage2 : [];
    const aggregate = assistant.metadata?.aggregate_rankings || [];
    const s3 = assistant.stage3;
    const s3Text = typeof s3 === 'string' ? s3 : s3?.response || '';

    const status = (done, running) => done ? 'complete' : (running ? 'running' : 'pending');
    const stages = [
      { key:'s1', label:'Answers', detail: seats.length ? `${s1.length}/${seats.length} seats` : null,
        status: status(s1.length && s1.length >= seats.length && !loading.stage1, loading.stage1) },
      { key:'s2', label:'Peer review', detail: seats.length ? `${s2.length}/${seats.length} seats` : null,
        status: status(s2.length && s2.length >= seats.length && !loading.stage2, loading.stage2) },
      { key:'agg', label:'Aggregate ranking', detail: aggregate.length ? `${aggregate.length} ranked` : null,
        status: status(aggregate.length, s2.length && !aggregate.length) },
      { key:'s3', label:'Chairman synthesis', detail: s3Text ? `${s3Text.length.toLocaleString()} chars` : null,
        status: status(s3Text && !loading.stage3, loading.stage3) }
    ];
    return { seats, stages, aggregate, totals: assistant.metadata?.totals || null };
  }, [conversation]);

  if (!view) {
    return <p style={{fontSize:12, color:INK_2, margin:0}}>Start a conversation to watch the council deliberate.</p>;
  }
  if (view.idle) {
    return <p style={{fontSize:12, color:INK_2, margin:0}}>{view.seats.length} seats ready. Ask a question to begin.</p>;
  }

  return (
    <div>
      {/* Stage tracker */}
      <ol style={{listStyle:'none', margin:'0 0 18px', padding:0}}>
        {view.stages.map((s, i) => {
          const st = STATUS[s.status];
          return (
            <li key={s.key} style={{display:'flex', alignItems:'flex-start', gap:9, padding:'5px 0'}}>
              <span style={{display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, alignSelf:'stretch'}}>
                <span style={{
                  width:10, height:10, borderRadius:'50%', background:st.dot, marginTop:3,
                  boxShadow: s.status === 'running' ? `0 0 0 3px ${st.dot}33` : 'none'
                }}/>
                {i < view.stages.length - 1 && <span style={{flex:1, width:2, background:'#e1e0d9', marginTop:2, minHeight:10}}/>}
              </span>
              <span style={{flex:1, minWidth:0, fontSize:12, lineHeight:1.35}}>
                <span style={{fontWeight:600, color:INK}}>{s.label}</span>
                <span style={{color:MUTED}}> · {st.label}</span>
                {s.detail && <span style={{display:'block', color:INK_2, fontSize:11}}>{s.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Consensus ranking — the run's verdict */}
      {view.aggregate.length > 0 && (
        <figure style={{margin:'0 0 14px'}}>
          <figcaption style={{fontSize:12, fontWeight:600, color:INK, marginBottom:2}}>Consensus ranking</figcaption>
          <p style={{fontSize:11, color:INK_2, margin:'0 0 8px'}}>
            How the seats ranked each other's answers, best first. Longer bar = ranked higher by peers.
          </p>
          <RankingBars data={view.aggregate} seats={view.seats} />
        </figure>
      )}

      {view.totals && (view.totals.cost != null || view.totals.total_tokens) && (
        <p style={{fontSize:11, color:INK_2, margin:'0 0 4px'}}>
          Run total:{' '}
          {view.totals.cost != null && <strong>${view.totals.cost.toFixed(4)}</strong>}
          {view.totals.total_tokens ? `${view.totals.cost != null ? ' · ' : ''}${view.totals.total_tokens.toLocaleString()} tokens` : ''}
          {view.totals.calls ? ` · ${view.totals.calls} model calls` : ''}
        </p>
      )}
    </div>
  );
}

function RankingBars({ data, seats }) {
  const n = Math.max(data.length, 1);
  // Bars encode a consensus score derived from average peer rank so that
  // "longer = better"; the raw average rank stays visible as the label.
  const score = (avg) => Math.max(0.06, (n - avg + 1) / n);
  return (
    <div>
      {data.map((r) => {
        const seatIdx = seats.indexOf(r.model);
        return (
          <div key={r.model} style={{marginBottom:6}}>
            <div style={{display:'flex', justifyContent:'space-between', gap:8, fontSize:11, marginBottom:2}}>
              <span style={{color:INK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                {seatIdx >= 0 && <span style={{color:MUTED}}>seat {seatIdx + 1} · </span>}
                {shortModelName(r.model)}
              </span>
              <span style={{color:INK_2, flexShrink:0, fontVariantNumeric:'tabular-nums'}} title={`averaged over ${r.rankings_count} peer rankings`}>
                avg {r.average_rank}
              </span>
            </div>
            <div style={{height:9, background:'#eef2f6', borderRadius:4, overflow:'hidden'}}>
              <div style={{
                width:`${score(r.average_rank) * 100}%`, height:'100%',
                background:BAR, borderRadius:4
              }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}
