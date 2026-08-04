"use client";
import { useEffect, useState } from 'react';

// Full-screen join screen for projecting at a workshop: QR, code and URL
// large enough to read from the back of a room.
export default function JoinPresenter({ code, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/qr?code=${encodeURIComponent(code)}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error || r.status))))
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'#fff', zIndex:200,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:22, padding:30
      }}
    >
      <div style={{position:'absolute', top:16, right:20, fontSize:12, color:'#898781'}}>
        click anywhere or press Esc to exit
      </div>

      {data?.group && <div style={{fontSize:'clamp(18px,2.4vw,30px)', fontWeight:600, color:'#1e242c'}}>{data.group}</div>}

      <div style={{
        width:'min(46vh, 60vw)', aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
        border:'1px solid #e2e8f0', borderRadius:14, padding:14, background:'#fff'
      }}>
        {data
          ? <div style={{width:'100%', height:'100%'}} dangerouslySetInnerHTML={{ __html: sizeSvg(data.svg) }}/>
          : <span style={{fontSize:13, color: error ? '#b02a2a' : '#898781'}}>
              {error ? `QR unavailable (${error})` : 'Generating…'}
            </span>}
      </div>

      <div style={{textAlign:'center'}}>
        <div style={{fontSize:12, color:'#898781', letterSpacing:1, textTransform:'uppercase', marginBottom:6}}>
          or enter this code after signing in
        </div>
        <div style={{fontSize:'clamp(38px,7vw,84px)', fontWeight:700, letterSpacing:'0.08em', lineHeight:1.05, color:'#1e242c'}}>
          {code}
        </div>
        {data?.url && (
          <div style={{fontSize:'clamp(12px,1.5vw,18px)', color:'#52514e', marginTop:10}}>{data.url}</div>
        )}
      </div>
    </div>
  );
}

// The generator emits a fixed pixel size; make it fill its container instead.
function sizeSvg(svg) {
  return String(svg || '')
    .replace(/\swidth="[^"]*"/, ' width="100%"')
    .replace(/\sheight="[^"]*"/, ' height="100%"');
}
