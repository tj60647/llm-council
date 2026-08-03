"use client";
import { useEffect } from 'react';

// Shared dialog shell: overlay, click-outside and Escape to dismiss, and a
// consistent header. Used by the seat inspector and About.
export default function Modal({ title, subtitle, badge, onClose, children, width = 680 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(11,11,11,0.45)', zIndex:100,
        display:'flex', alignItems:'center', justifyContent:'center', padding:20
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background:'#fff', borderRadius:10, width:`min(${width}px, 100%)`, maxHeight:'85vh',
          overflowY:'auto', boxShadow:'0 12px 40px rgba(0,0,0,0.25)'
        }}
      >
        <div style={{
          display:'flex', alignItems:'center', gap:10, padding:'14px 18px',
          borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, background:'#fff'
        }}>
          {badge}
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontWeight:600, fontSize:15}}>{title}</div>
            {subtitle && <div style={{fontSize:11, color:'#52514e'}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            border:'1px solid #c9d1d9', background:'#fff', borderRadius:6,
            width:28, height:28, cursor:'pointer', fontSize:15, lineHeight:1, color:'#1e242c', flexShrink:0
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
