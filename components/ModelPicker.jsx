"use client";
import { useMemo, useState } from 'react';

// Searchable model catalog. Used for choosing one seat's model (mode="single")
// and for choosing a group's allowed set in admin (mode="multi").

const INK = '#1e242c';
const INK_2 = '#52514e';
const MUTED = '#898781';

export function formatContext(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M ctx`;
  if (n >= 1000) return `${Math.round(n / 1000)}K ctx`;
  return `${n} ctx`;
}

export function formatPrice(pricing) {
  const inP = Number(pricing?.prompt), outP = Number(pricing?.completion);
  if (!isFinite(inP) || inP <= 0) return isFinite(inP) && inP === 0 ? 'free' : null;
  const per = v => {
    const m = v * 1e6;
    return m >= 1 ? `$${m.toFixed(m >= 10 ? 0 : 2)}` : `$${m.toFixed(2)}`;
  };
  return isFinite(outP) && outP > 0 ? `${per(inP)}/${per(outP)} per 1M` : `${per(inP)} per 1M`;
}

const SORTS = {
  relevance: { label: 'Best match', fn: null },
  newest: { label: 'Newest', fn: (a, b) => (b.created || 0) - (a.created || 0) },
  cheapest: { label: 'Cheapest', fn: (a, b) => (Number(a.pricing?.prompt) || 0) - (Number(b.pricing?.prompt) || 0) },
  context: { label: 'Largest context', fn: (a, b) => (b.context_length || 0) - (a.context_length || 0) },
  name: { label: 'Name', fn: (a, b) => a.id.localeCompare(b.id) }
};

function score(m, q) {
  const id = m.id.toLowerCase(), name = (m.name || '').toLowerCase();
  if (id === q) return 100;
  if (id.startsWith(q) || name.startsWith(q)) return 80;
  if (id.includes(q) || name.includes(q)) return 60;
  if (m.provider?.toLowerCase().includes(q)) return 40;
  return 0;
}

const chip = {
  fontSize:10, padding:'1px 6px', borderRadius:4, border:'1px solid #dde3e9',
  background:'#f4f7f9', color:INK_2, whiteSpace:'nowrap'
};

export default function ModelPicker({
  models = [],
  loading = false,
  mode = 'single',
  selected = [],
  onSelect,          // single: (id) => void
  onToggle,          // multi:  (id) => void
  height = 300,
  autoFocus = true
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('relevance');
  const [provider, setProvider] = useState('');

  const providers = useMemo(() => {
    const counts = new Map();
    for (const m of models) counts.set(m.provider, (counts.get(m.provider) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [models]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = models;
    if (provider) out = out.filter(m => m.provider === provider);
    if (query) {
      out = out.map(m => ({ m, s: score(m, query) })).filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s || a.m.id.localeCompare(b.m.id)).map(x => x.m);
      if (sort !== 'relevance') out = [...out].sort(SORTS[sort].fn);
    } else {
      out = [...out].sort(SORTS[sort].fn || SORTS.newest.fn);
    }
    return out;
  }, [models, q, sort, provider]);

  const isSelected = (id) => selected.includes(id);

  return (
    <div style={{display:'flex', flexDirection:'column', minHeight:0}}>
      <div style={{padding:8, borderBottom:'1px solid #eef2f6', display:'flex', gap:6, flexWrap:'wrap'}}>
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search models, providers…"
          style={{flex:'1 1 150px', minWidth:0, padding:'5px 8px', border:'1px solid #c9d1d9', borderRadius:6, fontSize:12}}
        />
        <select value={sort} onChange={e => setSort(e.target.value)}
          style={{padding:'5px 6px', border:'1px solid #c9d1d9', borderRadius:6, fontSize:11, color:INK_2}}>
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {providers.length > 1 && (
        <div style={{display:'flex', gap:4, flexWrap:'wrap', padding:'6px 8px', borderBottom:'1px solid #eef2f6'}}>
          <button type="button" onClick={() => setProvider('')}
            style={{...chip, cursor:'pointer', ...(provider === '' ? {background:'#1e242c', color:'#fff', borderColor:'#1e242c'} : {})}}>all</button>
          {providers.map(([p, n]) => (
            <button key={p} type="button" onClick={() => setProvider(provider === p ? '' : p)}
              style={{...chip, cursor:'pointer', ...(provider === p ? {background:'#1e242c', color:'#fff', borderColor:'#1e242c'} : {})}}>
              {p} <span style={{opacity:0.6}}>{n}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{overflowY:'auto', maxHeight:height, minHeight:60}}>
        {loading && <div style={{padding:12, fontSize:12, color:INK_2}}>Loading catalog…</div>}
        {!loading && rows.length === 0 && (
          <div style={{padding:12, fontSize:12, color:INK_2}}>
            No models match{q ? ` “${q}”` : ''}{provider ? ` from ${provider}` : ''}.
          </div>
        )}
        {rows.map(m => {
          const sel = isSelected(m.id);
          const ctx = formatContext(m.context_length);
          const price = formatPrice(m.pricing);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => mode === 'multi' ? onToggle?.(m.id) : onSelect?.(m.id)}
              title={m.description || m.id}
              style={{
                display:'flex', gap:8, alignItems:'flex-start', width:'100%', textAlign:'left',
                padding:'7px 10px', border:'none', borderBottom:'1px solid #f2f5f8',
                background: sel ? '#eef2f6' : '#fff', cursor:'pointer'
              }}
            >
              {mode === 'multi' && (
                <span style={{
                  width:14, height:14, marginTop:2, flexShrink:0, borderRadius:3,
                  border:`1px solid ${sel ? '#1e242c' : '#c9d1d9'}`, background: sel ? '#1e242c' : '#fff',
                  color:'#fff', fontSize:10, lineHeight:'13px', textAlign:'center'
                }}>{sel ? '✓' : ''}</span>
              )}
              <span style={{flex:1, minWidth:0}}>
                <span style={{
                  display:'block', fontSize:12, fontWeight: sel ? 600 : 500, color:INK,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                }}>{m.name || m.id}</span>
                <span style={{
                  display:'block', fontSize:10, color:MUTED, fontFamily:'ui-monospace, Menlo, monospace',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                }}>{m.id}</span>
                <span style={{display:'flex', gap:4, flexWrap:'wrap', marginTop:3}}>
                  {ctx && <span style={chip}>{ctx}</span>}
                  {price && <span style={chip}>{price}</span>}
                  {m.caps?.vision && <span style={chip}>vision</span>}
                  {m.caps?.tools && <span style={chip}>tools</span>}
                  {m.caps?.reasoning && <span style={chip}>reasoning</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{padding:'5px 9px', borderTop:'1px solid #eef2f6', fontSize:10.5, color:MUTED}}>
        {rows.length} of {models.length} models
        {mode === 'multi' && selected.length > 0 && ` · ${selected.length} selected`}
      </div>
    </div>
  );
}
