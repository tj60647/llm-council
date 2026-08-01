"use client";
import { useState } from 'react';
import Markdown from './Markdown.jsx';
import { seatStyle, shortModelName } from '../lib/ui/seats.js';
import { statLine, formatCost, formatMs } from '../lib/ui/format.js';

const INK_2 = '#52514e';
const MUTED = '#898781';

function SeatDot({ index }) {
  const s = seatStyle(index);
  return <span style={{
    width:10, height:10, borderRadius:'50%', flexShrink:0,
    background:s.fill, border:`1px solid ${s.border}`, display:'inline-block'
  }}/>;
}

// "gpt-5.5 · 2.4s · $0.0012" under each contribution
function StatFooter({ model, seatIndex, ms, usage, error }) {
  const bits = statLine({ ms, usage });
  return (
    <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', fontSize:10.5, color:MUTED, marginTop:6}}>
      {typeof seatIndex === 'number' && seatIndex >= 0 && <><SeatDot index={seatIndex}/><span>seat {seatIndex+1}</span><span>·</span></>}
      <span style={{color:INK_2}}>{shortModelName(model)}</span>
      {bits.map((b, i) => <span key={i}>· {b}</span>)}
      {error && <span style={{color:'#d03b3b'}}>· {error}</span>}
    </div>
  );
}

function Section({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{borderTop:'1px solid #eef2f6'}}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', gap:7, width:'100%', textAlign:'left',
          border:'none', background:'none', padding:'8px 0', cursor:'pointer',
          fontSize:12, color:INK_2
        }}
      >
        <span style={{
          display:'inline-block', transform:`rotate(${open ? 90 : 0}deg)`,
          transition:'transform 120ms', fontSize:9, color:MUTED
        }}>▶</span>
        <span style={{fontWeight:600}}>{title}</span>
        {count != null && <span style={{color:MUTED}}>({count})</span>}
      </button>
      {open && <div style={{paddingBottom:10}}>{children}</div>}
    </div>
  );
}

export default function CouncilMessage({ message, seats = [] }) {
  const m = message;
  const seatOf = (model) => seats.indexOf(model);

  if (m.role === 'user') {
    return (
      <div style={{display:'flex', justifyContent:'flex-end', marginBottom:14}}>
        <div style={{
          maxWidth:'80%', background:'#1e242c', color:'#fff', borderRadius:'10px 10px 2px 10px',
          padding:'9px 13px', fontSize:14, lineHeight:1.5, whiteSpace:'pre-wrap'
        }}>{m.content}</div>
      </div>
    );
  }

  const stage1 = Array.isArray(m.stage1) ? m.stage1 : [];
  const stage2 = Array.isArray(m.stage2) ? m.stage2 : [];
  const synthesis = typeof m.stage3 === 'string' ? { response: m.stage3 } : (m.stage3 || null);
  const streaming = m.streamingText || '';
  const answerText = synthesis?.response || streaming;
  const chairModel = synthesis?.model || m.chairperson || seats[0];
  const totals = m.metadata?.totals;
  const aggregate = m.metadata?.aggregate_rankings || [];

  return (
    <div style={{
      marginBottom:18, background:'#fff', border:'1px solid #e2e8f0',
      borderRadius:'10px 10px 10px 2px', padding:'12px 14px'
    }}>
      {/* The council's answer — the point of the whole run */}
      <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:8}}>
        <SeatDot index={0}/>
        <strong style={{fontSize:12.5}}>The council's answer</strong>
        {chairModel && <span style={{fontSize:11, color:MUTED}}>chaired by {shortModelName(chairModel)}</span>}
      </div>

      {answerText ? (
        <>
          <Markdown>{answerText}</Markdown>
          {!synthesis && <StreamingCursor/>}
        </>
      ) : (
        <PendingLine
          stage1={stage1.length} stage2={stage2.length} seats={seats.length}
          loading={m.loading || {}} error={m.error}
        />
      )}

      {synthesis && (
        <StatFooter model={chairModel} seatIndex={0} ms={synthesis.ms} usage={synthesis.usage} error={synthesis.error}/>
      )}

      {/* Supporting detail */}
      {stage1.length > 0 && (
        <div style={{marginTop:10}}>
          <Section title="Individual answers" count={stage1.length}>
            {stage1.map((r, i) => (
              <div key={i} style={{padding:'8px 0', borderTop: i ? '1px dashed #eef2f6' : 'none'}}>
                {r.error
                  ? <div style={{fontSize:12, color:'#d03b3b'}}>{shortModelName(r.model)} failed: {r.error}</div>
                  : <Markdown compact>{r.response}</Markdown>}
                <StatFooter model={r.model} seatIndex={seatOf(r.model)} ms={r.ms} usage={r.usage} error={r.error}/>
              </div>
            ))}
          </Section>

          {stage2.length > 0 && (
            <Section title="Peer review" count={stage2.length}>
              {aggregate.length > 0 && (
                <div style={{fontSize:11.5, color:INK_2, marginBottom:8}}>
                  Consensus order:{' '}
                  {aggregate.map((a, i) => (
                    <span key={a.model}>
                      {i > 0 && ' → '}
                      <strong>{shortModelName(a.model)}</strong>
                      <span style={{color:MUTED}}> ({a.average_rank})</span>
                    </span>
                  ))}
                </div>
              )}
              {stage2.map((r, i) => (
                <div key={i} style={{padding:'8px 0', borderTop: i ? '1px dashed #eef2f6' : 'none'}}>
                  {r.error
                    ? <div style={{fontSize:12, color:'#d03b3b'}}>{shortModelName(r.model)} failed: {r.error}</div>
                    : <Markdown compact>{r.ranking}</Markdown>}
                  <StatFooter model={r.model} seatIndex={seatOf(r.model)} ms={r.ms} usage={r.usage} error={r.error}/>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Run totals */}
      {totals && (totals.cost != null || totals.total_tokens) && (
        <div style={{borderTop:'1px solid #eef2f6', marginTop:6, paddingTop:7, fontSize:10.5, color:MUTED}}>
          Run total: {[
            formatCost(totals.cost),
            totals.total_tokens ? `${totals.total_tokens.toLocaleString()} tokens` : null,
            totals.calls ? `${totals.calls} model calls` : null
          ].filter(Boolean).join(' · ')}
        </div>
      )}

      {m.error && <div style={{color:'#d03b3b', fontSize:12, marginTop:8}}>Error: {m.error}</div>}
    </div>
  );
}

function PendingLine({ stage1, stage2, seats, loading, error }) {
  if (error) return <div style={{fontSize:13, color:'#d03b3b'}}>The run failed before a synthesis was produced.</div>;
  let text = 'Convening…';
  if (loading.stage3) text = 'The chairperson is writing the final answer…';
  else if (loading.stage2 || (stage1 >= seats && seats)) text = `Peer review — ${stage2}/${seats} seats have ranked…`;
  else if (loading.stage1) text = `Collecting answers — ${stage1}/${seats} seats in…`;
  // Keyframes must live in the same styled-jsx scope as the class that uses
  // them — an inline `animation` cannot reference a scoped keyframe name.
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, fontSize:13, color:INK_2}}>
      <span className="spinner"/>
      {text}
      <style jsx>{`
        .spinner {
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid #cfd8e0; border-top-color: #2a78d6;
          display: inline-block; animation: councilspin 0.8s linear infinite;
        }
        @keyframes councilspin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
      `}</style>
    </div>
  );
}

function StreamingCursor() {
  return (
    <span className="cursor">
      <style jsx>{`
        .cursor {
          display: inline-block; width: 7px; height: 14px; background: #2a78d6;
          vertical-align: text-bottom; margin-left: 2px;
          animation: councilblink 1s step-end infinite;
        }
        @keyframes councilblink { 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
      `}</style>
    </span>
  );
}
