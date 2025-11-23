"use client";
import { useEffect, useState } from 'react';
import { DEFAULT_COUNCIL_MODELS } from '../lib/config/models.js';

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
  const seats = (value && value.length ? value : DEFAULT_COUNCIL_MODELS).slice(0, max);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/models');
        if(res.ok){
          const data = await res.json();
          setAvailable(data);
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

  return (
    <div style={{display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-start'}}>
      {seats.map((m, i) => (
        <div key={i} style={{ position:'relative' }}>
          <button
            type="button"
            onClick={() => editable && setOpenIndex(openIndex === i ? null : i)}
            style={{
              padding:'6px 12px',
              border:'1px solid #777',
              borderRadius:24,
              background: editable ? '#f9f9f9' : '#fafafa',
              cursor: editable ? 'pointer' : 'default',
              fontSize:12,
              maxWidth:150,
              display:'flex',
              alignItems:'center',
              gap:6
            }}
            title={m}
          >
            {showSeatNumbers && <span style={{
              display:'inline-block',
              minWidth:18,
              textAlign:'center',
              fontWeight:'600',
              color:'#444'
            }}>{i+1}</span>}
            <span style={{overflow:'hidden', textOverflow:'ellipsis'}}>{m ? m.replace(/^[^/]+\//,'') : 'Empty'}</span>
          </button>
          {editable && seats.length > 1 && (
            <button
              type="button"
              aria-label="Remove seat"
              onClick={() => removeSeat(i)}
              style={{
                position:'absolute', top:-6, right:-6,
                width:18, height:18, lineHeight:'18px',
                background:'#fff', border:'1px solid #bbb', borderRadius:'50%',
                cursor:'pointer', fontSize:10, fontWeight:'bold'
              }}>×</button>
          )}
          {editable && openIndex === i && (
            <div style={{
              position:'absolute', top:'110%', left:0, zIndex:20,
              background:'#fff', border:'1px solid #ccc', borderRadius:6,
              width:260, maxHeight:300, overflowY:'auto', boxShadow:'0 2px 10px rgba(0,0,0,0.15)'
            }}>
              {available.length === 0 && <div style={{padding:8, fontSize:12}}>Loading models...</div>}
              {available.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateSeat(i, opt.id)}
                  style={{
                    display:'block', width:'100%', textAlign:'left',
                    padding:'6px 8px', border:'none', background: opt.id === m ? '#e6f0ff' : '#fff',
                    borderBottom:'1px solid #eee', cursor:'pointer', fontSize:12
                  }}
                >{opt.id} {opt.pricing?.input ? `($${opt.pricing.input}/in)` : ''}</button>
              ))}
            </div>
          )}
        </div>
      ))}
      {editable && seats.length < max && (
        <button type="button" onClick={addSeat} style={{ padding:'6px 12px', border:'1px dashed #999', borderRadius:24, background:'#fff', fontSize:12 }}>+ Add Seat</button>
      )}
      {editable && (
        <div style={{width:'100%', fontSize:11, color:'#555', marginTop:4}}>Seats: {seats.length} / {max}</div>
      )}
    </div>
  );
}
