"use client";
import { useEffect, useRef, useState } from 'react';

// The council's real input is a pasted passage plus a question about it — the
// original was built for reading books, where you paste a chapter and ask.
// So: multiline, auto-growing, Enter sends, Shift+Enter breaks the line.
const MAX_HEIGHT = 260;

export default function PromptBox({ loading, onSend }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  function submit() {
    const v = value.trim();
    if (!v || loading) return;
    onSend(v);
    setValue('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }}>
      <div style={{display:'flex', gap:8, alignItems:'flex-end'}}>
        <textarea
          ref={ref}
          rows={2}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Paste a passage and ask the council about it…"
          style={{
            flex:1, minHeight:44, padding:'9px 11px', border:'1px solid #c9d1d9', borderRadius:8,
            fontSize:14, lineHeight:1.5, fontFamily:'inherit', resize:'none', color:'#1e242c'
          }}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          style={{
            padding:'9px 18px', border:'1px solid #1e242c', borderRadius:8,
            background:'#1e242c', color:'#fff', fontSize:12, lineHeight:'16px',
            cursor: (loading || !value.trim()) ? 'default' : 'pointer',
            opacity: (loading || !value.trim()) ? 0.55 : 1, flexShrink:0
          }}
        >{loading ? 'Deliberating…' : 'Send'}</button>
      </div>
      <div style={{display:'flex', gap:10, marginTop:5, fontSize:10.5, color:'#898781'}}>
        <span>Enter sends · Shift+Enter for a new line</span>
        {words > 0 && <span>· {words.toLocaleString()} words</span>}
      </div>
    </form>
  );
}
