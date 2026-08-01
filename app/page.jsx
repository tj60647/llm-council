"use client";
import { useState, useEffect } from 'react';
import SankeyCouncil from '../components/SankeyCouncil';
import FlowDiagram from '../components/FlowDiagram';
import ModelSelector from '../components/ModelSelector';
import ModelRing from '../components/ModelRing';
import { DEFAULT_COUNCIL_MODELS } from '../lib/config/models.js';

export default function HomePage() {
  // Auth state: null = loading; me.status routes between login/enroll/app screens
  const [me, setMe] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState(null);
  // Conversations state
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);
  // Seats (conversationalists) defaults & editing
  const [selectedModelsForNew, setSelectedModelsForNew] = useState(DEFAULT_COUNCIL_MODELS);
  const [editingModels, setEditingModels] = useState(false);
  const [tempModels, setTempModels] = useState([]);

  async function fetchMe() {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    setMe(data);
    return data;
  }

  async function enroll(e) {
    e.preventDefault();
    setJoinError(null);
    const res = await fetch('/api/auth/enroll', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: joinCode }) });
    const data = await res.json();
    if (!res.ok) { setJoinError(data.error || 'enrollment failed'); return; }
    const m = await fetchMe();
    if (m.status === 'active' || m.status === 'open' || m.admin) listConversations();
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method:'POST' });
    window.location.reload();
  }

  // Guide strip: visible until dismissed; reopen via the header "Guide" button
  const [showGuide, setShowGuide] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem('council_guide_hidden') === '1') setShowGuide(false); } catch {}
  }, []);
  function toggleGuide() {
    setShowGuide(s => {
      try { localStorage.setItem('council_guide_hidden', s ? '1' : '0'); } catch {}
      return !s;
    });
  }

  const firstName = me?.auth_enabled ? ((me?.name || '').trim().split(/\s+/)[0] || null) : null;

  // When a group restricts models, seed the default seats from it so new
  // conversations start valid.
  useEffect(() => {
    if (me?.group?.models?.length) setSelectedModelsForNew(me.group.models.slice(0, 4));
  }, [me?.group?.models?.join(',')]);

  async function listConversations() {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Failed to list conversations');
      const data = await res.json();
      console.log('[listConversations] received', (data.conversations || []).length, 'items');
      setConversations(data.conversations || []);
      setOffline(false);
    } catch (e) {
      setError(e.message);
      setOffline(true);
    }
  }

  async function createConversation(models=[]) {
    try {
      const res = await fetch('/api/conversations', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ models }) });
      if (!res.ok) throw new Error('Failed to create conversation');
      const data = await res.json();
      const conversation = data.conversation;
      console.log('[createConversation] created id:', conversation.id, 'metadata:', conversation.metadata);
      setConversations(prev => [conversation.metadata, ...prev]);
      setCurrentConversation(conversation);
      setTempModels(conversation.models || []);
    } catch (e) { setError(e.message); }
  }

  async function saveModels() {
    if(!currentConversation) return;
    try {
      const res = await fetch(`/api/conversations/${currentConversation.id}/models`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ models: tempModels }) });
      if(!res.ok) throw new Error('Failed to update models');
      const data = await res.json();
      setCurrentConversation(prev => ({ ...prev, models: data.models }));
      setConversations(prev => prev.map(c => c.id === currentConversation.id ? { ...c, models: data.models } : c));
      setEditingModels(false);
    } catch(e){ setError(e.message); }
  }

  async function sendMessage(content) {
    if (!currentConversation) return;
    setLoading(true);
    const id = currentConversation.id;
    const res = await fetch(`/api/conversations/${id}/message/stream`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content }) });
    if (!res.ok) {
      // Fallback to non-stream endpoint if stream missing (e.g. in-memory conversation lost or route issue)
      if(res.status === 404){
        try {
          const simple = await fetch(`/api/conversations/${id}/message`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content }) });
          if(simple.ok){
            const data = await simple.json();
            // Attach assistant stages directly
            setCurrentConversation(prev => ({...prev, messages:[...prev.messages, { role:'user', content }, { role:'assistant', stage1:data.stage1, stage2:data.stage2, stage3:data.stage3, metadata:data.metadata }]}));
          } else {
            setError('Message failed (fallback)');
          }
        } catch(fallErr){ setError('Message stream & fallback failed'); }
      } else if (res.status === 429) {
        const d = await res.json().catch(() => ({}));
        setError(`Daily council-run limit reached${d.limit ? ` (${d.limit}/day)` : ''}. Try again tomorrow.`);
      } else {
        setError('Failed message');
      }
      setLoading(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistant = { role:'assistant', stage1:null, stage2:null, stage3:null, metadata:null, loading:{stage1:false,stage2:false,stage3:false} };
    setCurrentConversation(prev => ({...prev, messages:[...prev.messages, {role:'user', content}, assistant]}));
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      const chunk = decoder.decode(value);
      chunk.split('\n').forEach(line => {
        if(line.startsWith('data: ')){
          try {
            const evt = JSON.parse(line.slice(6));
            if(evt.type === 'title_complete'){
              const t = evt.data?.title;
              if(t){
                setCurrentConversation(prev => ({...prev, title: t}));
                setConversations(prev => prev.map(cv => cv.id === id ? {...cv, title: t} : cv));
              }
              return;
            }
            setCurrentConversation(prev => {
              const messages = [...prev.messages];
              const last = messages[messages.length-1];
              switch(evt.type){
                case 'stage1_start': last.loading.stage1 = true; break;
                case 'stage1_complete': last.stage1 = evt.data; last.loading.stage1 = false; break;
                case 'stage2_start': last.loading.stage2 = true; break;
                case 'stage2_complete': last.stage2 = evt.data; last.metadata = evt.metadata; last.loading.stage2 = false; break;
                case 'stage3_start': last.loading.stage3 = true; break;
                case 'stage3_complete': last.stage3 = evt.data; last.loading.stage3 = false; break;
                case 'complete': break;
                case 'error': last.error = evt.message; break;
              }
              return {...prev, messages};
            });
          } catch(e){ console.error('SSE parse', e); }
        }
      });
    }
    setLoading(false);
    if (me?.auth_enabled) fetchMe(); // refresh runs-left counter
  }

  useEffect(() => {
    fetchMe().then(m => {
      if (!m.auth_enabled || m.status === 'active' || m.admin) listConversations();
    });
  }, []);

  const authError = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('auth_error') : null;

  const gateWrap = { display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#fafafa' };
  const gateCard = { background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:32, maxWidth:420, textAlign:'center' };

  if (!me) {
    return <div style={gateWrap}><div style={gateCard}>Loading…</div></div>;
  }
  if (me.auth_enabled && me.status === 'unauthenticated') {
    return (
      <div style={gateWrap}><div style={gateCard}>
        <h2 style={{marginTop:0}}>LLM Council <span style={{fontWeight:400, opacity:0.6}}>— Reconvened</span></h2>
        <p style={{fontSize:14}}>Sign in to convene the council.</p>
        {authError && <p style={{color:'red', fontSize:13}}>Sign-in failed ({authError}). Try again.</p>}
        <a href="/api/auth/login" style={{display:'inline-block', padding:'10px 18px', background:'#24292f', color:'#fff', borderRadius:6, textDecoration:'none', fontSize:14}}>Sign in with GitHub</a>
        <p style={{fontSize:11, opacity:0.55, marginTop:16, marginBottom:0}}>derived from <a href="https://github.com/karpathy/llm-council" target="_blank" rel="noreferrer" style={{color:'inherit'}}>karpathy/llm-council</a></p>
      </div></div>
    );
  }
  if (me.auth_enabled && (me.status === 'not_enrolled' || me.status === 'group_missing')) {
    return (
      <div style={gateWrap}><div style={gateCard}>
        <h2 style={{marginTop:0}}>Almost in</h2>
        <p style={{fontSize:14}}>Signed in as <strong>{me.email}</strong>. Enter your workshop join code to get access.</p>
        <form onSubmit={enroll}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" style={{padding:'10px', fontSize:16, fontFamily:'monospace', textAlign:'center', border:'1px solid #ccc', borderRadius:6, width:160}}/>
          <div style={{marginTop:12}}>
            <button type="submit" style={{padding:'8px 16px'}}>Join</button>
            <button type="button" onClick={signOut} style={{marginLeft:8, fontSize:12}}>Sign out</button>
          </div>
        </form>
        {joinError && <p style={{color:'red', fontSize:13}}>{joinError === 'invalid_code' ? 'That code is not valid.' : joinError === 'expired' ? 'That workshop has ended.' : joinError}</p>}
      </div></div>
    );
  }
  if (me.auth_enabled && ['revoked', 'expired', 'not_yet_valid'].includes(me.status)) {
    const msg = me.status === 'revoked' ? 'Your access has been revoked.'
      : me.status === 'expired' ? `This workshop's access window ended ${me.group?.valid_until ? new Date(me.group.valid_until).toLocaleString() : ''}.`
      : `Access starts ${me.group?.valid_from ? new Date(me.group.valid_from).toLocaleString() : 'soon'}.`;
    return (
      <div style={gateWrap}><div style={gateCard}>
        <h2 style={{marginTop:0}}>No access</h2>
        <p style={{fontSize:14}}>{msg}</p>
        <button onClick={signOut} style={{fontSize:12}}>Sign out</button>
      </div></div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>
      {/* Header */}
      <header style={{display:'flex', alignItems:'center', gap:14, padding:'10px 20px', borderBottom:'1px solid #ddd', background:'#ffffff'}}>
        <img src="/logo.svg" alt="LLM Council logo" width={42} height={42} style={{borderRadius:10, flexShrink:0}}/>
        <div style={{lineHeight:1.25}}>
          <div style={{fontSize:17, fontWeight:600}}>LLM Council <span style={{fontWeight:400, opacity:0.55}}>— Reconvened</span></div>
          <div style={{fontSize:11, opacity:0.55}}>independent answers · anonymous peer review · chairman synthesis</div>
        </div>
        <div style={{flex:1}}/>
        <button onClick={toggleGuide} title="Show or hide the guide" style={{fontSize:12, padding:'4px 10px', border:'1px solid #ccc', borderRadius:16, background: showGuide ? '#eef2f6' : '#fff', cursor:'pointer'}}>? Guide</button>
        {me.auth_enabled && (
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {me.group && <span style={{fontSize:11, padding:'3px 10px', border:'1px solid #cfd8e0', borderRadius:16, background:'#f2f5f8'}} title={me.group.valid_until ? `access until ${new Date(me.group.valid_until).toLocaleString()}` : undefined}>{me.group.name}</span>}
            {me.group?.runs_per_day > 0 && (
              <span style={{fontSize:11, padding:'3px 10px', border:'1px solid #e4d3ac', borderRadius:16, background:'#fbf5e6'}} title="Council runs remaining today">
                {Math.max(0, me.group.runs_per_day - (me.runs_today || 0))}/{me.group.runs_per_day} runs
              </span>
            )}
            {me.admin && <span style={{fontSize:11, padding:'3px 10px', border:'1px solid #1e242c', borderRadius:16, background:'#1e242c', color:'#fff'}}>admin</span>}
            <span style={{fontSize:13, fontWeight:600}}>{me.name || me.email}</span>
            {me.admin && <a href="/admin" style={{fontSize:12}}>Admin</a>}
            <button onClick={signOut} style={{fontSize:11, cursor:'pointer'}}>Sign out</button>
          </div>
        )}
      </header>
      {/* Guide strip */}
      {showGuide && (
        <div style={{display:'flex', gap:20, alignItems:'flex-start', padding:'10px 20px', borderBottom:'1px solid #e6eaee', background:'#f7f9fb', fontSize:12, lineHeight:'17px'}}>
          <div style={{flex:1, minWidth:0}}>
            <strong>1 · Conversations</strong><br/>
            A conversation is one titled session with the council. Creating it snapshots your current seats; its transcript fills the middle panel, the flow diagram on the right.
          </div>
          <div style={{flex:1, minWidth:0}}>
            <strong>2 · Conversationalists = seats</strong><br/>
            Each seat holds one model. <strong>Seat 1 is the chairman</strong> — it writes the final synthesized answer after the others weigh in.
          </div>
          <div style={{flex:1, minWidth:0}}>
            <strong>3 · Add / remove a seat</strong><br/>
            Left panel: <em>+ Add Seat</em> (up to 7) or <em>×</em> sets the seats for <em>new</em> conversations. For the current one, use <em>Edit Seats</em> at the top of the chat, then Save.
          </div>
          <div style={{flex:1, minWidth:0}}>
            <strong>4 · Change a seat's model</strong><br/>
            Click the seat pill and pick from the list{me.group?.models?.length ? ' (your group limits the catalog)' : ''}. Then ask a question — every seat answers, they rank each other anonymously, the chairman concludes.
          </div>
          <button onClick={toggleGuide} title="Hide guide" style={{border:'none', background:'none', cursor:'pointer', fontSize:14, opacity:0.5, padding:0}}>×</button>
        </div>
      )}
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
      {/* Conversations Panel */}
      <div style={{ width:260, borderRight:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fcfcfc' }}>
        <h3 style={{margin:'0 0 2px'}}>Conversations</h3>
        <div style={{fontSize:11, opacity:0.6, marginBottom:10}}>your sessions with the council</div>
        <button onClick={() => createConversation(selectedModelsForNew)} style={{marginBottom:12}}>+ New Conversation</button>
        {offline && <div style={{color:'#b36b00', fontSize:12, marginBottom:8}}>API unreachable. Retrying...</div>}
        {error && <div style={{color:'red', fontSize:12, marginBottom:8}}>Error: {error}</div>}
        <ul style={{listStyle:'none', padding:0, margin:0}}>
          {conversations.map(c => (
            <li key={c.id} style={{marginBottom:8}}>
              <button style={{width:'100%', textAlign:'left', fontSize:13}} onClick={async () => {
                const r = await fetch(`/api/conversations/${c.id}`);
                if(r.ok){ const data = await r.json(); const conv = data.conversation; setCurrentConversation(conv); setTempModels(conv?.models || []); setEditingModels(false); }
              }}>{c.title || 'Untitled'} <span style={{opacity:0.6}}>({c.message_count})</span></button>
            </li>
          ))}
        </ul>
      </div>
      {/* Conversationalists Panel */}
      <div style={{ width:300, borderRight:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fff' }}>
        <h3 style={{margin:'0 0 2px'}}>Conversationalists</h3>
        <div style={{fontSize:11, opacity:0.6, marginBottom:8}}>default seats for new conversations — seat 1 chairs</div>
        <ModelRing value={selectedModelsForNew} onChange={setSelectedModelsForNew} editable={true} showSeatNumbers={true} />
        <div style={{fontSize:11, opacity:0.55, marginTop:14}}>The active conversation's seats appear at the top of the chat panel.</div>
      </div>
      {/* Messages Panel */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fafafa' }}>
        {currentConversation ? (
          <>
            {/* This conversation: title + seats */}
            <div style={{padding:'10px 16px', borderBottom:'1px solid #e5e5e5', background:'#fff'}}>
              <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom:8}}>
                <strong style={{fontSize:14}}>{currentConversation.title || 'Untitled'}</strong>
                <span style={{fontSize:11, opacity:0.55}}>this conversation's seats</span>
                <div style={{flex:1}}/>
                {editingModels ? (
                  <span>
                    <button onClick={saveModels} style={{marginRight:6, fontSize:12}}>Save</button>
                    <button onClick={() => { setEditingModels(false); setTempModels(currentConversation.models || []); }} style={{fontSize:12}}>Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => { setEditingModels(true); setTempModels(currentConversation.models || []); }} style={{fontSize:12}}>Edit Seats</button>
                )}
              </div>
              <ModelRing
                value={editingModels ? tempModels : (currentConversation.models || [])}
                onChange={setTempModels}
                editable={editingModels}
                showSeatNumbers={true}
              />
            </div>
            <div style={{flex:1, overflowY:'auto', padding:16}}>
              {currentConversation.messages.length === 0 && (
                <div style={{background:'#f7f9fb', border:'1px solid #e2e8f0', borderRadius:8, padding:'18px 20px', maxWidth:640}}>
                  <div style={{fontSize:15, fontWeight:600, marginBottom:6}}>The council is seated{firstName ? `, ${firstName}` : ''}.</div>
                  <div style={{fontSize:13, marginBottom:8}}>
                    {(currentConversation.models || []).length} conversationalists at the table:{' '}
                    {(currentConversation.models || []).map(m => m.replace(/^[^/]+\//, '')).join(', ')}.
                    {' '}Seat 1 chairs.
                  </div>
                  <div style={{fontSize:13, opacity:0.8}}>
                    Ask your question below. Every seat answers independently, they rank each other's answers anonymously,
                    and the chairman synthesizes the final word — watch it flow through the diagram on the right.
                  </div>
                </div>
              )}
              {currentConversation.messages.map((m,i)=>(
                <div key={i} style={{marginBottom:16, background:'#fff', border:'1px solid #e5e5e5', borderRadius:6, padding:12}}>
                  <div style={{fontWeight:'600', marginBottom:4}}>{m.role}</div>
                  {m.content && <div style={{marginBottom:6}}>{m.content}</div>}
                  {m.stage1 && <details style={{marginBottom:4}}><summary>Stage 1 Responses</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(m.stage1,null,2)}</pre></details>}
                  {m.stage2 && <details style={{marginBottom:4}}><summary>Stage 2 Peer Eval</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(m.stage2,null,2)}</pre></details>}
                  {m.stage3 && <details style={{marginBottom:4}}><summary>Stage 3 Synthesis</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(m.stage3,null,2)}</pre></details>}
                </div>
              ))}
            </div>
            <div style={{padding:16, borderTop:'1px solid #ddd', background:'#fff'}}>
              <form onSubmit={e => { e.preventDefault(); const v = e.target.prompt.value.trim(); if(v) sendMessage(v); e.target.reset(); }}>
                <input name="prompt" style={{width:'70%', padding:'8px', border:'1px solid #ccc', borderRadius:4}} placeholder="Ask the council" />
                <button type="submit" disabled={loading} style={{marginLeft:8, padding:'8px 14px'}}>{loading? 'Thinking...' : 'Send'}</button>
              </form>
            </div>
          </>
        ) : (
          <div style={{padding:32, maxWidth:560}}>
            <h3 style={{margin:'0 0 6px'}}>Welcome{firstName ? `, ${firstName}` : ''}.</h3>
            <p style={{fontSize:13, margin:'0 0 14px', opacity:0.8}}>
              Convene a council: check the seats in the Conversationalists panel, then start a conversation.
              Not sure what anything means? Open the <button onClick={toggleGuide} style={{border:'none', background:'none', padding:0, cursor:'pointer', textDecoration:'underline', fontSize:13}}>guide</button>.
            </p>
            <button onClick={() => createConversation(selectedModelsForNew)} style={{padding:'8px 16px'}}>+ New Conversation</button>
            {conversations.length > 0 && <p style={{fontSize:12, opacity:0.6, marginTop:12}}>…or pick a previous conversation from the left.</p>}
          </div>
        )}
      </div>
      {/* Visualization Panel */}
      <div style={{ width:400, borderLeft:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fcfcfc' }}>
        <FlowDiagram conversation={currentConversation} />
        <SankeyCouncil conversation={currentConversation} />
      </div>
      </div>{/* end flex main row */}
      {/* Footer */}
      <footer style={{display:'flex', alignItems:'center', gap:14, padding:'7px 20px', borderTop:'1px solid #ddd', background:'#fff', fontSize:11, color:'#555'}}>
        <span style={{fontWeight:600}}>LLM Council — Reconvened</span>
        <span style={{opacity:0.75}}>derived from <a href="https://github.com/karpathy/llm-council" target="_blank" rel="noreferrer" style={{color:'inherit'}}>karpathy/llm-council</a></span>
        <div style={{flex:1}}/>
        <a href="https://github.com/tj60647/llm-council" target="_blank" rel="noreferrer" style={{color:'inherit'}}>source</a>
        {me.admin && <a href="/admin" style={{color:'inherit'}}>admin</a>}
        <span style={{opacity:0.6}}>{me.auth_enabled ? (me.email || 'signed in') : 'open mode'}</span>
      </footer>
    </div>
  );
}
