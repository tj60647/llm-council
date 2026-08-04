"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import ModelPicker from '../../components/ModelPicker.jsx';
import JoinPresenter from '../../components/JoinPresenter.jsx';

// Workshop admin: manage groups (access window, allowed models, run caps, join
// codes) and members. Gated server-side by ADMIN_EMAILS; this page mirrors that
// state and refreshes itself so you can watch a room fill up.

const INK = '#1e242c';
const INK_2 = '#52514e';
const MUTED = '#898781';

const btn = { padding:'5px 12px', border:'1px solid #c9d1d9', borderRadius:6, background:'#fff', color:INK, fontSize:12, lineHeight:'16px', cursor:'pointer' };
const btnPrimary = { ...btn, background:INK, borderColor:INK, color:'#fff' };
const btnQuiet = { ...btn, border:'1px solid transparent', background:'transparent', color:INK_2 };
const btnDanger = { ...btn, color:'#b02a2a', borderColor:'#e6c3c3' };
const input = { padding:'6px 8px', border:'1px solid #c9d1d9', borderRadius:6, fontSize:13, color:INK };
const cell = { padding:'7px 10px', borderBottom:'1px solid #eef2f6', fontSize:12.5, textAlign:'left', verticalAlign:'middle' };
const th = { ...cell, fontSize:11, fontWeight:600, color:INK_2, borderBottom:'1px solid #dde3e9', whiteSpace:'nowrap' };
const card = { border:'1px solid #e2e8f0', borderRadius:10, background:'#fff', padding:14, marginBottom:10 };

function isoToLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const localToIso = v => (v ? new Date(v).toISOString() : null);
const money = n => (typeof n === 'number' && n > 0 ? `$${n < 0.01 ? n.toFixed(5) : n.toFixed(4)}` : '—');

// A workshop admin's first question is "is this live right now?"
function windowState(g) {
  const now = Date.now();
  if (g.valid_from && now < Date.parse(g.valid_from)) return { key:'upcoming', label:'upcoming', bg:'#f2f5f8', fg:'#52514e', border:'#cfd8e0' };
  if (g.valid_until && now > Date.parse(g.valid_until)) return { key:'ended', label:'ended', bg:'#f7f7f6', fg:'#898781', border:'#e1e0d9' };
  return { key:'live', label:'live now', bg:'#e8f6e8', fg:'#106b10', border:'#bfe3bf' };
}

function relative(iso) {
  if (!iso) return null;
  const diff = Date.parse(iso) - Date.now();
  const abs = Math.abs(diff);
  const day = 864e5, hr = 36e5, min = 6e4;
  const n = abs >= day ? `${Math.round(abs/day)}d` : abs >= hr ? `${Math.round(abs/hr)}h` : `${Math.max(1, Math.round(abs/min))}m`;
  return diff >= 0 ? `in ${n}` : `${n} ago`;
}

function Badge({ children, tone = {} }) {
  return <span style={{
    fontSize:11, padding:'2px 8px', borderRadius:16, whiteSpace:'nowrap',
    border:`1px solid ${tone.border || '#cfd8e0'}`, background: tone.bg || '#f2f5f8', color: tone.fg || INK_2
  }}>{children}</span>;
}

function CopyButton({ value, label = 'Copy', title }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); } catch {}
      }}
      style={{ ...btn, ...(done ? { borderColor:'#bfe3bf', background:'#e8f6e8', color:'#106b10' } : {}) }}
    >{done ? 'Copied' : label}</button>
  );
}

function GroupForm({ initial, models, modelsLoading, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [from, setFrom] = useState(isoToLocal(initial?.valid_from));
  const [until, setUntil] = useState(isoToLocal(initial?.valid_until));
  const [picked, setPicked] = useState(initial?.models || []);
  const [runs, setRuns] = useState(initial?.runs_per_day ?? 10);
  const [regen, setRegen] = useState(false);

  const known = useMemo(() => new Set(models.map(m => m.id)), [models]);
  const unknown = picked.filter(id => models.length > 0 && !known.has(id));
  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  return (
    <div style={{ ...card, borderColor:'#c9d1d9' }}>
      <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:12}}>
        <label style={{fontSize:12, color:INK_2}}>Group name<br/>
          <input style={{...input, width:190}} value={name} onChange={e=>setName(e.target.value)} placeholder="Sept Workshop"/>
        </label>
        <label style={{fontSize:12, color:INK_2}}>Access from<br/>
          <input style={input} type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)}/>
        </label>
        <label style={{fontSize:12, color:INK_2}}>Access until<br/>
          <input style={input} type="datetime-local" value={until} onChange={e=>setUntil(e.target.value)}/>
        </label>
        <label style={{fontSize:12, color:INK_2}}>Runs / person / day<br/>
          <input style={{...input, width:90}} type="number" min="0" value={runs} onChange={e=>setRuns(e.target.value)}/>
          <span style={{fontSize:10, color:MUTED, display:'block'}}>0 = unlimited</span>
        </label>
      </div>

      <div style={{fontSize:12, color:INK_2, marginBottom:6}}>
        Allowed models — <strong>{picked.length ? `${picked.length} selected` : 'none selected = every model allowed'}</strong>
      </div>
      {picked.length > 0 && (
        <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:8}}>
          {picked.map(id => (
            <span key={id} style={{
              display:'inline-flex', alignItems:'center', gap:5, fontSize:11,
              border:`1px solid ${unknown.includes(id) ? '#e6c3c3' : '#cfd8e0'}`,
              background: unknown.includes(id) ? '#fdf3f3' : '#f2f5f8',
              borderRadius:6, padding:'2px 6px'
            }}>
              {unknown.includes(id) && <span title="Not in the current OpenRouter catalog — it may be retired">⚠</span>}
              <code style={{fontSize:10}}>{id}</code>
              <button type="button" onClick={()=>toggle(id)} aria-label={`Remove ${id}`}
                style={{border:'none', background:'none', cursor:'pointer', fontSize:12, lineHeight:1, color:INK_2, padding:0}}>×</button>
            </span>
          ))}
        </div>
      )}
      {unknown.length > 0 && (
        <div style={{fontSize:11, color:'#b02a2a', marginBottom:8}}>
          {unknown.length} selected model{unknown.length > 1 ? 's are' : ' is'} not in the live catalog — retired models return empty answers.
        </div>
      )}
      <div style={{border:'1px solid #e2e8f0', borderRadius:8, marginBottom:12, overflow:'hidden'}}>
        <ModelPicker
          models={models}
          loading={modelsLoading}
          mode="multi"
          selected={picked}
          onToggle={toggle}
          height={220}
          autoFocus={false}
        />
      </div>

      {initial && (
        <label style={{fontSize:12, display:'block', marginBottom:10, color:INK_2}}>
          <input type="checkbox" checked={regen} onChange={e=>setRegen(e.target.checked)}/> Regenerate join code
          <span style={{color:MUTED}}> — the old code stops working immediately</span>
        </label>
      )}
      <button style={{...btnPrimary, marginRight:8}} onClick={() => onSave({
        id: initial?.id, name,
        valid_from: localToIso(from), valid_until: localToIso(until),
        models: picked, runs_per_day: Number(runs) || 0, regenerate_code: regen
      })}>{initial ? 'Save changes' : 'Create group'}</button>
      <button style={btnQuiet} onClick={onCancel}>Cancel</button>
    </div>
  );
}

function GroupCard({ g, origin, onEdit, onDelete, onPresent }) {
  const state = windowState(g);
  const joinUrl = `${origin}/?join=${encodeURIComponent(g.code)}`;
  return (
    <div style={card}>
      <div style={{display:'flex', alignItems:'center', gap:9, flexWrap:'wrap', marginBottom:10}}>
        <strong style={{fontSize:14}}>{g.name}</strong>
        <Badge tone={state}>{state.label}</Badge>
        <div style={{flex:1}}/>
        <button style={btn} onClick={onEdit}>Edit</button>
        <button style={btnDanger} onClick={onDelete}>Delete</button>
      </div>

      {/* The join code is the thing you read out or project, so it leads */}
      <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:10,
        background:'#f7f9fb', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px'}}>
        <span style={{fontSize:10.5, color:MUTED, textTransform:'uppercase', letterSpacing:0.4}}>Join code</span>
        <code style={{fontSize:22, fontWeight:700, letterSpacing:2, color:INK}}>{g.code}</code>
        <CopyButton value={g.code} label="Copy code"/>
        <CopyButton value={joinUrl} label="Copy join link" title={joinUrl}/>
        <button style={btnPrimary} onClick={onPresent} title="Full-screen QR and code for projecting">
          Present ⤢
        </button>
      </div>

      <div style={{display:'flex', gap:'6px 18px', flexWrap:'wrap', fontSize:12, color:INK_2}}>
        <span><strong style={{color:INK}}>{g.member_count}</strong> member{g.member_count === 1 ? '' : 's'}</span>
        <span><strong style={{color:INK}}>{g.models?.length ? g.models.length : 'all'}</strong> model{g.models?.length === 1 ? '' : 's'} allowed</span>
        <span><strong style={{color:INK}}>{g.runs_per_day || '∞'}</strong> runs/person/day</span>
        <span><strong style={{color:INK}}>{g.runs_today || 0}</strong> runs today</span>
        <span>spend <strong style={{color:INK}}>{money(g.spend)}</strong></span>
      </div>
      <div style={{fontSize:11, color:MUTED, marginTop:6}}>
        {g.valid_from ? `${new Date(g.valid_from).toLocaleString()} (${relative(g.valid_from)})` : 'no start'}
        {' → '}
        {g.valid_until ? `${new Date(g.valid_until).toLocaleString()} (${relative(g.valid_until)})` : 'no end'}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // group id | 'new' | null
  const [error, setError] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailGroup, setNewEmailGroup] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [origin, setOrigin] = useState('');
  const [presenting, setPresenting] = useState(null); // join code being projected

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/overview');
    if (!r.ok) { setError(`Could not load admin data (${r.status})`); return; }
    setError(null);
    setData(await r.json());
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch('/api/auth/me').then(r => r.json()).then(m => {
      setMe(m);
      if (m.admin || !m.auth_enabled) {
        refresh();
        fetch('/api/models')
          .then(r => r.ok ? r.json() : { models: [] })
          .then(d => setModels(d.models || []))
          .catch(() => {})
          .finally(() => setModelsLoading(false));
      }
    });
  }, [refresh]);

  // Keep the view current during a live session without a manual reload
  useEffect(() => {
    if (!me || (me.auth_enabled && !me.admin)) return;
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [me, refresh]);

  async function saveGroup(payload) {
    const r = await fetch('/api/admin/groups', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) { setError(explain((await r.json()).error)); return; }
    setEditing(null); refresh();
  }
  async function removeGroup(g) {
    const warn = g.member_count
      ? `Delete "${g.name}"? Its ${g.member_count} member${g.member_count === 1 ? '' : 's'} lose access immediately and will need a new join code.`
      : `Delete "${g.name}"? Its join code stops working.`;
    if (!confirm(warn)) return;
    await fetch(`/api/admin/groups?id=${encodeURIComponent(g.id)}`, { method:'DELETE' });
    refresh();
  }
  async function addEmail() {
    const r = await fetch('/api/admin/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:newEmail, group_id:newEmailGroup }) });
    if (!r.ok) { setError(explain((await r.json()).error)); return; }
    setNewEmail(''); refresh();
  }
  async function patchUser(email, patch) {
    await fetch('/api/admin/users', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, ...patch }) });
    refresh();
  }
  async function removeUser(email) {
    if (!confirm(`Remove ${email}? They can re-enrol with a valid join code.`)) return;
    await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`, { method:'DELETE' });
    refresh();
  }

  const groups = data?.groups || [];
  const users = data?.users || [];
  const shownUsers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      (u.github_login || '').toLowerCase().includes(q) ||
      (u.group_name || '').toLowerCase().includes(q));
  }, [users, memberQuery]);
  const totalSpend = users.reduce((a, u) => a + (u.spend || 0), 0);
  const runsToday = users.reduce((a, u) => a + (u.runs_today || 0), 0);

  if (!me) return <div style={{padding:32, fontSize:13}}>Loading…</div>;
  if (me.auth_enabled && !me.admin) {
    return <div style={{padding:32, fontSize:13}}>Admin access only. <a href="/">Back to the app</a></div>;
  }

  return (
    <div style={{minHeight:'100vh', background:'#fafbfc'}}>
      {presenting && <JoinPresenter code={presenting} onClose={() => setPresenting(null)}/>}
      <header style={{display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:'1px solid #ddd', background:'#fff'}}>
        <img src="/logo.svg" alt="" width={34} height={34} style={{borderRadius:8}}/>
        <div style={{lineHeight:1.25}}>
          <div style={{fontSize:15, fontWeight:600}}>Council admin</div>
          <div style={{fontSize:11, color:MUTED}}>groups, access windows, members</div>
        </div>
        <div style={{flex:1}}/>
        <button style={btn} onClick={refresh}>Refresh</button>
        <a href="/" style={{...btn, textDecoration:'none', display:'inline-flex', alignItems:'center'}}>← Back to app</a>
      </header>

      <div style={{padding:'16px 20px', maxWidth:1080, margin:'0 auto'}}>
        {!me.auth_enabled && (
          <div style={{...card, background:'#fbf5e6', borderColor:'#e4d3ac', fontSize:12.5, color:'#7a5b16'}}>
            <strong>Auth is off.</strong> The app is open to anyone with the URL — groups below have no effect until
            <code style={{margin:'0 4px'}}>AUTH_GITHUB_ID</code>, <code style={{margin:'0 4px'}}>AUTH_GITHUB_SECRET</code> and
            <code style={{margin:'0 4px'}}>AUTH_SECRET</code> are set.
          </div>
        )}
        {error && (
          <div style={{...card, background:'#fdf3f3', borderColor:'#e6c3c3', fontSize:12.5, color:'#b02a2a'}}>{error}</div>
        )}

        {/* Totals first — a host's standing question is what this is costing */}
        <div style={{display:'flex', gap:10, flexWrap:'wrap', marginBottom:14}}>
          <Stat label="Groups" value={groups.length} sub={`${groups.filter(g => windowState(g).key === 'live').length} live now`}/>
          <Stat label="Members" value={users.length} sub={`${users.filter(u => u.revoked).length} revoked`}/>
          <Stat label="Runs today" value={runsToday}/>
          <Stat label="Total spend" value={money(totalSpend)} sub="all members, all time"/>
        </div>

        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
          <h3 style={{margin:0, fontSize:14}}>Groups</h3>
          <div style={{flex:1}}/>
          {editing !== 'new' && <button style={btnPrimary} onClick={()=>setEditing('new')}>+ New group</button>}
        </div>

        {editing === 'new' && (
          <GroupForm models={models} modelsLoading={modelsLoading} onSave={saveGroup} onCancel={()=>setEditing(null)}/>
        )}
        {groups.map(g => editing === g.id
          ? <GroupForm key={g.id} initial={g} models={models} modelsLoading={modelsLoading} onSave={saveGroup} onCancel={()=>setEditing(null)}/>
          : <GroupCard key={g.id} g={g} origin={origin} onEdit={()=>setEditing(g.id)}
              onDelete={()=>removeGroup(g)} onPresent={()=>setPresenting(g.code)}/>
        )}
        {!groups.length && editing !== 'new' && (
          <div style={{...card, color:INK_2, fontSize:12.5}}>
            No groups yet. Create one, set its access window and model list, then share the join code or link at the workshop.
          </div>
        )}

        <div style={{display:'flex', alignItems:'center', gap:10, margin:'22px 0 8px'}}>
          <h3 style={{margin:0, fontSize:14}}>Members</h3>
          <span style={{fontSize:11, color:MUTED}}>{shownUsers.length} of {users.length}</span>
          <div style={{flex:1}}/>
          <input value={memberQuery} onChange={e=>setMemberQuery(e.target.value)} placeholder="Search members…"
            style={{...input, fontSize:12, width:180}}/>
        </div>

        <div style={{...card, padding:'10px 12px', display:'flex', gap:7, flexWrap:'wrap', alignItems:'center'}}>
          <span style={{fontSize:12, color:INK_2}}>Pre-approve an email (skips the join code):</span>
          <input style={{...input, fontSize:12, width:210}} value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="attendee@example.com"/>
          <select style={{...input, fontSize:12}} value={newEmailGroup} onChange={e=>setNewEmailGroup(e.target.value)}>
            <option value="">choose group…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button style={newEmail && newEmailGroup ? btnPrimary : {...btn, opacity:0.5, cursor:'default'}}
            onClick={addEmail} disabled={!newEmail || !newEmailGroup}>Add</button>
        </div>

        <div style={{...card, padding:0, overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse', width:'100%', minWidth:720}}>
            <thead><tr>
              <th style={th}>Email</th><th style={th}>GitHub</th><th style={th}>Group</th>
              <th style={th}>Runs today</th><th style={th}>Spend</th><th style={th}>Last seen</th>
              <th style={th}>Status</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {shownUsers.map(u => (
                <tr key={u.email} style={u.revoked ? {opacity:0.55} : undefined}>
                  <td style={cell}>{u.email}</td>
                  <td style={cell}>{u.github_login || <span style={{color:MUTED}}>not signed in yet</span>}</td>
                  <td style={cell}>
                    <select style={{...input, fontSize:12, padding:'3px 6px'}} value={u.group_id || ''}
                      onChange={e=>patchUser(u.email, { group_id: e.target.value })}>
                      {!u.group_name && <option value={u.group_id || ''}>⚠ group deleted</option>}
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </td>
                  <td style={cell}>{u.runs_today}</td>
                  <td style={cell}>{money(u.spend)}</td>
                  <td style={cell}>{u.last_login ? relative(u.last_login) : <span style={{color:MUTED}}>never</span>}</td>
                  <td style={cell}>
                    {u.revoked
                      ? <Badge tone={{bg:'#fdf3f3', fg:'#b02a2a', border:'#e6c3c3'}}>revoked</Badge>
                      : <Badge tone={{bg:'#e8f6e8', fg:'#106b10', border:'#bfe3bf'}}>active</Badge>}
                  </td>
                  <td style={{...cell, whiteSpace:'nowrap'}}>
                    <button style={{...btn, marginRight:5}} onClick={()=>patchUser(u.email, { revoked: !u.revoked })}>
                      {u.revoked ? 'Restore' : 'Revoke'}
                    </button>
                    <button style={btnDanger} onClick={()=>removeUser(u.email)}>Remove</button>
                  </td>
                </tr>
              ))}
              {!shownUsers.length && (
                <tr><td style={{...cell, color:INK_2}} colSpan={8}>
                  {users.length ? 'No members match that search.' : 'No members yet — share a join code, or pre-approve an email above.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={{flex:'1 1 150px', border:'1px solid #e2e8f0', borderRadius:10, background:'#fff', padding:'10px 14px'}}>
      <div style={{fontSize:11, color:MUTED}}>{label}</div>
      <div style={{fontSize:20, fontWeight:600, color:INK, lineHeight:1.3}}>{value}</div>
      {sub && <div style={{fontSize:10.5, color:MUTED}}>{sub}</div>}
    </div>
  );
}

function explain(code) {
  return ({
    name_required: 'Give the group a name.',
    valid_email_required: 'That does not look like an email address.',
    valid_group_required: 'Choose a group for this member.',
    not_found: 'That group no longer exists — refresh the page.',
    admin_only: 'Your account is not an admin.',
    unauthenticated: 'Your session expired — sign in again.'
  })[code] || `Something went wrong (${code}).`;
}
