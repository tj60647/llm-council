"use client";
import { useEffect, useState } from 'react';

export default function ModelSelector({ selected, onChange }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load(){
      try {
        const res = await fetch('/api/models');
        if(!res.ok) throw new Error('Failed to load models');
        const data = await res.json();
        if(!cancelled){ setModels(data.models); }
      } catch(e){ if(!cancelled){ setError(e.message); } }
      finally { if(!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function toggle(id){
    if(selected.includes(id)){
      onChange(selected.filter(m => m !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const filtered = models.filter(m => m.id.toLowerCase().includes(filter.toLowerCase()) || (m.name || '').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ border:'1px solid #ccc', padding:8, marginBottom:12, background:'#f9f9f9' }}>
      <div style={{display:'flex', gap:4, marginBottom:6}}>
        <input
          placeholder="Filter models"
          value={filter}
          onChange={e=>setFilter(e.target.value)}
          style={{flex:1}}
        />
        <button type="button" onClick={()=>onChange([])} title="Clear selection">Clear</button>
      </div>
      {loading && <div style={{fontSize:12}}>Loading models...</div>}
      {error && <div style={{color:'red', fontSize:12}}>Error: {error}</div>}
      {!loading && !error && (
        <div style={{ maxHeight:220, overflowY:'auto', fontSize:12 }}>
          {filtered.map(m => {
            const isSel = selected.includes(m.id);
            return (
              <label key={m.id} style={{display:'flex', alignItems:'center', gap:4, marginBottom:4}}>
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={()=>toggle(m.id)}
                />
                <span style={{fontWeight:isSel?600:400}}>{m.id}</span>
                {m.pricing?.prompt && <span style={{color:'#666'}} title="Prompt price">{m.pricing.prompt}</span>}
              </label>
            );
          })}
          {filtered.length === 0 && <div style={{padding:8}}>No models match filter.</div>}
        </div>
      )}
      {selected.length > 0 && (
        <div style={{marginTop:6, fontSize:11}}>
          Selected ({selected.length}): {selected.slice(0,5).join(', ')}{selected.length>5?'…':''}
        </div>
      )}
    </div>
  );
}
