"use client";
import Modal from './Modal.jsx';
import { promptsForSeat } from '../lib/council/prompts.js';
import { seatStyle, shortModelName } from '../lib/ui/seats.js';

function pricePerMillion(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return null;
  const per1M = n * 1e6;
  return per1M >= 1 ? `$${per1M.toFixed(2)}` : `$${per1M.toFixed(3)}`;
}

const row = { display:'flex', gap:10, padding:'5px 0', borderBottom:'1px solid #eef2f6', fontSize:12 };
const label = { width:120, flexShrink:0, color:'#52514e' };

export default function SeatModal({ seatIndex, modelId, meta, onClose }) {
  const style = seatStyle(seatIndex);
  const isChair = seatIndex === 0;
  const ctx = meta?.context_length ? `${Number(meta.context_length).toLocaleString()} tokens` : null;
  const inPrice = pricePerMillion(meta?.pricing?.prompt);
  const outPrice = pricePerMillion(meta?.pricing?.completion);

  return (
    <Modal
      title={shortModelName(modelId) || 'Empty seat'}
      subtitle={`Seat ${seatIndex + 1} · ${isChair ? 'chairperson — writes the final synthesis' : 'council member'}`}
      badge={
        <span style={{
          width:26, height:26, borderRadius:'50%', background:style.fill, border:`1px solid ${style.border}`,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          fontSize:12, fontWeight:700, color:'#1e242c', flexShrink:0
        }}>{seatIndex + 1}</span>
      }
      onClose={onClose}
    >
      <div>
        {/* Model metadata */}
        <div style={{padding:'12px 18px'}}>
          <h4 style={{margin:'0 0 6px', fontSize:13}}>Model</h4>
          <div style={row}><span style={label}>ID</span><code style={{fontSize:11}}>{modelId}</code></div>
          {meta?.name && <div style={row}><span style={label}>Name</span><span>{meta.name}</span></div>}
          {ctx && <div style={row}><span style={label}>Context window</span><span>{ctx}</span></div>}
          {(inPrice || outPrice) && (
            <div style={row}>
              <span style={label}>Price / 1M tokens</span>
              <span>{inPrice ? `${inPrice} in` : '—'}{outPrice ? ` · ${outPrice} out` : ''}</span>
            </div>
          )}
          {meta?.description && (
            <div style={{...row, borderBottom:'none', alignItems:'flex-start'}}>
              <span style={label}>About</span><span style={{color:'#52514e'}}>{meta.description}</span>
            </div>
          )}
          {!meta && (
            <div style={{fontSize:12, color:'#52514e', padding:'6px 0'}}>
              No catalog entry loaded for this id — it may be restricted by your group or retired upstream.
            </div>
          )}
        </div>

        {/* Prompts */}
        <div style={{padding:'4px 18px 18px'}}>
          <h4 style={{margin:'8px 0 4px', fontSize:13}}>What this seat is asked</h4>
          <p style={{margin:'0 0 10px', fontSize:11, color:'#52514e'}}>
            The council sends these as user messages — there is no separate system prompt, so behavior comes
            from this text plus the model's own defaults. <code style={{fontSize:10}}>{'{…}'}</code> marks runtime substitution.
          </p>
          {promptsForSeat(seatIndex).map(t => (
            <div key={t.stage} style={{
              border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px', marginBottom:8, background:'#fff'
            }}>
              <div style={{display:'flex', gap:8, alignItems:'baseline', marginBottom:4}}>
                <strong style={{fontSize:12}}>{t.stage}</strong>
                <span style={{fontSize:10, color:'#52514e'}}>{t.appliesTo}</span>
              </div>
              <div style={{fontSize:11, color:'#52514e', marginBottom:6}}>{t.summary}</div>
              <pre style={{
                margin:0, padding:'8px 10px', background:'#f4f7f9', border:'1px solid #e2e8f0',
                borderRadius:6, fontSize:10.5, lineHeight:1.5, whiteSpace:'pre-wrap', overflowX:'auto'
              }}>{t.template}</pre>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
