"use client";
import { useState, useEffect } from 'react';

// Minimal workshop admin: manage groups (window, model set, run caps, join
// codes) and members (allowlist, revoke). Gated server-side by ADMIN_EMAILS;
// this page just mirrors that state.

function isoToLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(v) { return v ? new Date(v).toISOString() : null; }

const cell = { padding:'6px 10px', borderBottom:'1px solid #eee', fontSize:13, textAlign:'left', verticalAlign:'top' };
const input = { padding:'6px 8px', border:'1px solid #ccc', borderRadius:4, fontSize:13 };

function GroupForm({ initial, catalog, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [from, setFrom] = useState(isoToLocal(initial?.valid_from));
  const [until, setUntil] = useState(isoToLocal(initial?.valid_until));
  const [models, setModels] = useState((initial?.models || []).join('\n'));
  const [runs, setRuns] = useState(initial?.runs_per_day ?? 10);
  const [regen, setRegen] = useState(false);
  return (
    <div style={{border:'1px solid #ccc', borderRadius:6, padding:12, margin:'8px 0', background:'#fff'}}>
      <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:8}}>
        <label style={{fontSize:13}}>Name<br/><input style={input} value={name} onChange={e=>setName(e.target.value)} placeholder="Sept Workshop"/></label>
        <label style={{fontSize:13}}>Valid from<br/><input style={input} type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label style={{fontSize:13}}>Valid until<br/><input style={input} type="datetime-local" value={until} onChange={e=>setUntil(e.target.value)}/></label>
        <label style={{fontSize:13}}>Runs/user/day (0 = unlimited)<br/><input style={input} type="number" min="0" value={runs} onChange={e=>setRuns(e.target.value)}/></label>
      </div>
      <label style={{fontSize:13, display:'block', marginBottom:8}}>
        Allowed models — one id per line, empty = all models
        {catalog.length > 0 && (
          <select style={{...input, marginLeft:8}} value="" onChange={e=>{ if(e.target.value) setModels(m => (m ? m + '\n' : '') + e.target.value); }}>
            <option value="">+ add from catalog…</option>
            {catalog.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
          </select>
        )}
        <br/>
        <textarea style={{...input, width:'100%', minHeight:70, fontFamily:'monospace'}} value={models} onChange={e=>setModels(e.target.value)} placeholder={"anthropic/claude-sonnet-5\ngoogle/gemini-3.5-flash"}/>
      </label>
      {initial && <label style={{fontSize:13, display:'block', marginBottom:8}}><input type="checkbox" checked={regen} onChange={e=>setRegen(e.target.checked)}/> Regenerate join code (invalidates the old one)</label>}
      <button onClick={() => onSave({
        id: initial?.id,
        name,
        valid_from: localToIso(from),
        valid_until: localToIso(until),
        models: models.split('\n').map(s=>s.trim()).filter(Boolean),
        runs_per_day: Number(runs) || 0,
        regenerate_code: regen
      })} style={{marginRight:8}}>Save</button>
      <button onClick={onCancel} style={{fontSize:12}}>Cancel</button>
    </div>
  );
}

export default function AdminPage() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [editing, setEditing] = useState(null); // group id | 'new' | null
  const [error, setError] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailGroup, setNewEmailGroup] = useState('');

  async function refresh() {
    const r = await fetch('/api/admin/overview');
    if (!r.ok) { setError(`overview failed (${r.status})`); return; }
    setData(await r.json());
  }

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(m => {
      setMe(m);
      if (m.admin || !m.auth_enabled) {
        refresh();
        fetch('/api/models').then(r=>r.ok?r.json():{models:[]}).then(d=>setCatalog(d.models||[])).catch(()=>{});
      }
    });
  }, []);

  async function saveGroup(payload) {
    setError(null);
    const r = await fetch('/api/admin/groups', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) { setError((await r.json()).error || 'save failed'); return; }
    setEditing(null);
    refresh();
  }
  async function removeGroup(g) {
    if (!confirm(`Delete group "${g.name}"? Members lose access immediately.`)) return;
    await fetch(`/api/admin/groups?id=${encodeURIComponent(g.id)}`, { method:'DELETE' });
    refresh();
  }
  async function addEmail() {
    setError(null);
    const r = await fetch('/api/admin/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:newEmail, group_id:newEmailGroup }) });
    if (!r.ok) { setError((await r.json()).error || 'add failed'); return; }
    setNewEmail('');
    refresh();
  }
  async function patchUser(email, patch) {
    await fetch('/api/admin/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, ...patch }) });
    refresh();
  }
  async function removeUser(email) {
    if (!confirm(`Remove ${email}? They can re-enroll with a valid join code.`)) return;
    await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`, { method:'DELETE' });
    refresh();
  }

  if (!me) return <div style={{padding:32}}>Loading…</div>;
  if (me.auth_enabled && !me.admin) return <div style={{padding:32}}>Admin access only. <a href="/">Back to app</a></div>;

  return (
    <div style={{padding:'16px 24px', maxWidth:1100, margin:'0 auto'}}>
      <h2 style={{marginBottom:4}}>Council Admin</h2>
      <p style={{marginTop:0, fontSize:13}}>
        <a href="/">← back to app</a>
        {!me.auth_enabled && <span style={{color:'#b36b00', marginLeft:12}}>Auth is OFF (AUTH_GITHUB_ID/SECRET + AUTH_SECRET not set) — the app is open; groups below take effect once auth is enabled.</span>}
      </p>
      {error && <div style={{color:'red', fontSize:13, marginBottom:8}}>Error: {error}</div>}

      <h3>Groups</h3>
      {editing === 'new'
        ? <GroupForm catalog={catalog} onSave={saveGroup} onCancel={()=>setEditing(null)} />
        : <button onClick={()=>setEditing('new')} style={{marginBottom:8}}>New Group</button>}
      <table style={{borderCollapse:'collapse', width:'100%', background:'#fff', border:'1px solid #eee'}}>
        <thead><tr>
          <th style={cell}>Name</th><th style={cell}>Join code</th><th style={cell}>Window</th>
          <th style={cell}>Models</th><th style={cell}>Runs/day</th><th style={cell}>Members</th><th style={cell}></th>
        </tr></thead>
        <tbody>
          {(data?.groups || []).map(g => (
            editing === g.id
              ? <tr key={g.id}><td style={cell} colSpan={7}><GroupForm initial={g} catalog={catalog} onSave={saveGroup} onCancel={()=>setEditing(null)}/></td></tr>
              : <tr key={g.id}>
                  <td style={cell}>{g.name}</td>
                  <td style={{...cell, fontFamily:'monospace', fontWeight:600}}>{g.code}</td>
                  <td style={cell}>{g.valid_from ? new Date(g.valid_from).toLocaleString() : '—'} → {g.valid_until ? new Date(g.valid_until).toLocaleString() : '—'}</td>
                  <td style={cell}>{g.models?.length ? `${g.models.length} allowed` : 'all'}</td>
                  <td style={cell}>{g.runs_per_day || '∞'}</td>
                  <td style={cell}>{g.member_count}</td>
                  <td style={cell}>
                    <button onClick={()=>setEditing(g.id)} style={{fontSize:12, marginRight:6}}>Edit</button>
                    <button onClick={()=>removeGroup(g)} style={{fontSize:12}}>Delete</button>
                  </td>
                </tr>
          ))}
          {!data?.groups?.length && <tr><td style={cell} colSpan={7}>No groups yet — create one and share its join code at the workshop.</td></tr>}
        </tbody>
      </table>

      <h3 style={{marginTop:24}}>Members</h3>
      <div style={{marginBottom:8, fontSize:13}}>
        Allowlist an email (they skip the join-code step):{' '}
        <input style={input} value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="attendee@example.com"/>{' '}
        <select style={input} value={newEmailGroup} onChange={e=>setNewEmailGroup(e.target.value)}>
          <option value="">group…</option>
          {(data?.groups || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>{' '}
        <button onClick={addEmail} disabled={!newEmail || !newEmailGroup}>Add</button>
      </div>
      <table style={{borderCollapse:'collapse', width:'100%', background:'#fff', border:'1px solid #eee'}}>
        <thead><tr>
          <th style={cell}>Email</th><th style={cell}>GitHub</th><th style={cell}>Group</th>
          <th style={cell}>Runs today</th><th style={cell}>Last login</th><th style={cell}>Status</th><th style={cell}></th>
        </tr></thead>
        <tbody>
          {(data?.users || []).map(u => (
            <tr key={u.email} style={u.revoked ? {opacity:0.5} : undefined}>
              <td style={cell}>{u.email}</td>
              <td style={cell}>{u.github_login || '—'}</td>
              <td style={cell}>
                <select style={input} value={u.group_id || ''} onChange={e=>patchUser(u.email, { group_id: e.target.value })}>
                  {(data?.groups || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  {!u.group_name && <option value={u.group_id || ''}>(missing group)</option>}
                </select>
              </td>
              <td style={cell}>{u.runs_today}</td>
              <td style={cell}>{u.last_login ? new Date(u.last_login).toLocaleString() : 'never'}</td>
              <td style={cell}>{u.revoked ? 'revoked' : 'active'}</td>
              <td style={cell}>
                <button onClick={()=>patchUser(u.email, { revoked: !u.revoked })} style={{fontSize:12, marginRight:6}}>{u.revoked ? 'Restore' : 'Revoke'}</button>
                <button onClick={()=>removeUser(u.email)} style={{fontSize:12}}>Remove</button>
              </td>
            </tr>
          ))}
          {!data?.users?.length && <tr><td style={cell} colSpan={7}>No members yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
