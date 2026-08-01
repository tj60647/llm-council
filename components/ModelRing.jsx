"use client";
import { useEffect, useState } from 'react';
import { DEFAULT_COUNCIL_MODELS } from '../lib/config/models.js';
import { seatStyle, shortModelName } from '../lib/ui/seats.js';
import SeatModal from './SeatModal.jsx';

// Seat-based ring of conversationalists. Each seat holds one model id.
// Props:
//   value: array of model ids (string) or null entries
//   onChange: callback with updated array
//   max: maximum number of seats
//   editable: can add/remove/change seats
//   showSeatNumbers: display seat ordinal labels
export default function ModelRing({ value, onChange, max=7, editable=false, showSeatNumbers=true }) {
  const [available, setAvailable] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);
  const [inspecting, setInspecting] = useState(null); // seat index whose details are open
  const [filter, setFilter] = useState('');
  const seats = (value && value.length ? value : DEFAULT_COUNCIL_MODELS).slice(0, max);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/models');
        if(res.ok){
          const data = await res.json();
          setAvailable(data.models || []);
        }
      } catch {}
    }
    load();
  }, []);

  function updateSeat(idx, modelId){
    if(!editable) return; // only allow changes if editable
    const next = [...seats];
    next[idx] = modelId;
    onChange(next.slice(0, max));
    setOpenIndex(null);
    setFilter('');
  }

  function addSeat(){
    if(!editable) return;
    if(seats.length >= max) return;
    const firstExtra = available.find(a => !seats.includes(a.id));
    const next = [...seats, firstExtra ? firstExtra.id : seats[0] || DEFAULT_COUNCIL_MODELS[0]];
    onChange(next);
  }

  function removeSeat(idx){
    if(!editable) return;
    if(seats.length <= 1) return; // keep at least one seat
    const next = seats.filter((_, i) => i !== idx);
    onChange(next);
    if(openIndex === idx) setOpenIndex(null);
  }

  const filtered = filter
    ? available.filter(o => o.id.toLowerCase().includes(filter.toLowerCase()))
    : available;

  return (
    <div style={{display:'flex', flexWrap:'wrap', gap:'14px 10px', alignItems:'flex-start'}}>
      {seats.map((m, i) => {
        const s = seatStyle(i);
        return (
        <div key={i} style={{ position:'relative' }}>
          <div
            title={`Seat ${i+1}${i === 0 ? ' — chairperson' : ''}: ${m || 'empty'}`}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'4px 6px 4px 5px',
              border:`1px solid ${s.border}`,
              borderRadius:7,
              background: s.fill,
              maxWidth:260
            }}
          >
            {showSeatNumbers && (
              <span style={{
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:18, height:18, borderRadius:'50%', flexShrink:0,
                background: s.badgeBg, color: s.badgeText,
                fontSize:10, fontWeight:700
              }}>{i+1}</span>
            )}
            <button
              type="button"
              onClick={() => editable && setOpenIndex(openIndex === i ? null : i)}
              disabled={!editable}
              title={editable ? 'Change this seat’s model' : m}
              style={{
                border:'none', background:'none', padding:0, margin:0,
                font:'inherit', fontSize:12, color:'#1e242c',
                cursor: editable ? 'pointer' : 'default',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                maxWidth:180, textAlign:'left'
              }}
            >{m ? shortModelName(m) : 'Empty'}</button>
            <button
              type="button"
              onClick={() => setInspecting(i)}
              title="Seat details — model info and the prompts it receives"
              aria-label={`Seat ${i+1} details`}
              style={{
                border:'none', background:'rgba(255,255,255,0.65)', borderRadius:4,
                width:20, height:20, flexShrink:0, cursor:'pointer',
                display:'inline-flex', alignItems:'center', justifyContent:'center', padding:0
              }}
            >
              <GearIcon />
            </button>
          </div>
          {editable && seats.length > 1 && (
            <button
              type="button"
              aria-label={`Remove seat ${i+1}`}
              title="Remove this seat"
              onClick={() => removeSeat(i)}
              style={{
                position:'absolute', top:-7, right:-7,
                width:19, height:19, padding:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                background:'#fff', border:'1px solid #98a4b0', borderRadius:'50%',
                boxShadow:'0 1px 2px rgba(0,0,0,0.14)',
                cursor:'pointer', color:'#1e242c'
              }}>
              <CloseIcon />
            </button>
          )}
          {editable && openIndex === i && (
            <div style={{
              position:'absolute', top:'110%', left:0, zIndex:20,
              background:'#fff', border:'1px solid #ccc', borderRadius:8,
              width:300, maxHeight:320, display:'flex', flexDirection:'column',
              boxShadow:'0 4px 16px rgba(0,0,0,0.16)'
            }}>
              <div style={{padding:8, borderBottom:'1px solid #eef2f6'}}>
                <input
                  autoFocus
                  value={filter}
                  onChange={e=>setFilter(e.target.value)}
                  placeholder="Filter models…"
                  style={{width:'100%', padding:'5px 8px', border:'1px solid #c9d1d9', borderRadius:6, fontSize:12}}
                />
              </div>
              <div style={{overflowY:'auto'}}>
                {available.length === 0 && <div style={{padding:10, fontSize:12}}>Loading models…</div>}
                {available.length > 0 && filtered.length === 0 && <div style={{padding:10, fontSize:12}}>No models match.</div>}
                {filtered.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSeat(i, opt.id)}
                    style={{
                      display:'block', width:'100%', textAlign:'left',
                      padding:'6px 10px', border:'none', background: opt.id === m ? '#eef2f6' : '#fff',
                      borderBottom:'1px solid #f2f5f8', cursor:'pointer', fontSize:12,
                      fontWeight: opt.id === m ? 600 : 400
                    }}
                  >{opt.id}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      );})}
      {editable && seats.length < max && (
        <button type="button" onClick={addSeat} style={{
          padding:'6px 12px', border:'1px dashed #a9b4bf', borderRadius:7,
          background:'#fff', color:'#52514e', fontSize:12, cursor:'pointer', alignSelf:'stretch'
        }}>+ Add Seat</button>
      )}
      {editable && (
        <div style={{width:'100%', fontSize:11, color:'#52514e', marginTop:2}}>
          Seats: {seats.length} / {max} · seat 1 chairs
        </div>
      )}
      {inspecting !== null && (
        <SeatModal
          seatIndex={inspecting}
          modelId={seats[inspecting]}
          meta={available.find(a => a.id === seats[inspecting]) || null}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}

function GearIcon(){
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.35" stroke="#1e242c" strokeWidth="1.3"/>
      <path d="M8 1.4v1.7M8 12.9v1.7M14.6 8h-1.7M3.1 8H1.4M12.67 3.33l-1.2 1.2M4.53 11.47l-1.2 1.2M12.67 12.67l-1.2-1.2M4.53 4.53l-1.2-1.2"
        stroke="#1e242c" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function CloseIcon(){
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M1.2 1.2l7.6 7.6M8.8 1.2l-7.6 7.6" stroke="#1e242c" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
