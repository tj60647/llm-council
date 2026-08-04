"use client";
import { useState, useEffect } from 'react';
import SankeyCouncil from '../components/SankeyCouncil';
import CouncilFlow from '../components/CouncilFlow';
import CouncilMessage from '../components/CouncilMessage';
import ModelRing from '../components/ModelRing';
import AboutModal from '../components/AboutModal';
import PromptBox from '../components/PromptBox';
import { DEFAULT_COUNCIL_MODELS } from '../lib/config/models.js';

// Shared button styles — every button on the page uses one of these three
// lineHeight is explicit so <button> and <a> compute to the same box height
const btn = { padding:'5px 12px', border:'1px solid #c9d1d9', borderRadius:6, background:'#fff', color:'#1e242c', fontSize:12, lineHeight:'16px', cursor:'pointer' };
const btnPrimary = { ...btn, background:'#1e242c', borderColor:'#1e242c', color:'#fff' };
const btnQuiet = { ...btn, borderColor:'transparent', background:'transparent', color:'#555' };
// Anchors that act as buttons must opt out of link styling to match them
const btnLink = { ...btn, textDecoration:'none', display:'inline-flex', alignItems:'center' };
// Status, not a control: badges never look clickable
const badge = {
  fontSize:11, padding:'3px 9px', borderRadius:16, whiteSpace:'nowrap',
  border:'1px solid #cfd8e0', background:'#f2f5f8', color:'#52514e'
};

// Panel widths are shared with the guide strip so each guide column sits
// directly above the panel it explains. Order = the workflow:
// pick conversationalists -> start conversation -> deliberate -> read the flow.
const PANEL_SEATS = 300;
const PANEL_CONVOS = 260;
const PANEL_FLOW = 400;

// Workflow step marker, used in the guide and on each panel heading.
function Step({ n }) {
  return <span style={{
    display:'inline-flex', alignItems:'center', justifyContent:'center',
    width:17, height:17, borderRadius:'50%', background:'#1e242c', color:'#fff',
    fontSize:10, fontWeight:700, flexShrink:0
  }}>{n}</span>;
}

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

  const [showAbout, setShowAbout] = useState(false);
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
    const assistant = {
      role:'assistant', stage1:[], stage2:[], stage3:null, streamingText:'',
      chairperson:null, metadata:null, loading:{stage1:false,stage2:false,stage3:false}
    };
    setCurrentConversation(prev => ({...prev, messages:[...prev.messages, {role:'user', content}, assistant]}));

    // Update the in-flight assistant message immutably so React re-renders.
    const patchLast = (fn) => setCurrentConversation(prev => {
      const messages = [...prev.messages];
      const i = messages.length - 1;
      messages[i] = fn({ ...messages[i] });
      return { ...prev, messages };
    });

    const handle = (evt) => {
      switch(evt.type){
        case 'council_start':
          patchLast(m => ({ ...m, chairperson: evt.data?.chairperson || null }));
          break;
        case 'stage1_start':
          patchLast(m => ({ ...m, loading:{...m.loading, stage1:true} }));
          break;
        case 'stage1_model':
          // Seats stream in as they finish rather than all at once
          patchLast(m => ({ ...m, stage1: [...(m.stage1 || []), evt.data] }));
          break;
        case 'stage1_complete':
          patchLast(m => ({ ...m, stage1: evt.data, loading:{...m.loading, stage1:false} }));
          break;
        case 'stage2_start':
          patchLast(m => ({ ...m, loading:{...m.loading, stage2:true} }));
          break;
        case 'stage2_model':
          patchLast(m => ({ ...m, stage2: [...(m.stage2 || []), evt.data] }));
          break;
        case 'stage2_complete':
          patchLast(m => ({ ...m, stage2: evt.data, metadata: evt.metadata, loading:{...m.loading, stage2:false} }));
          break;
        case 'stage3_start':
          patchLast(m => ({ ...m, chairperson: evt.data?.model || m.chairperson, loading:{...m.loading, stage3:true} }));
          break;
        case 'stage3_delta':
          patchLast(m => ({ ...m, streamingText: (m.streamingText || '') + evt.data }));
          break;
        case 'stage3_complete':
          patchLast(m => ({ ...m, stage3: evt.data, streamingText:'', loading:{...m.loading, stage3:false} }));
          break;
        case 'title_complete': {
          const t = evt.data?.title;
          if(t){
            setCurrentConversation(prev => ({...prev, title: t}));
            setConversations(prev => prev.map(cv => cv.id === id ? {...cv, title: t} : cv));
          }
          break;
        }
        case 'complete':
          patchLast(m => ({ ...m, metadata: { ...(m.metadata || {}), ...(evt.metadata || {}) } }));
          setConversations(prev => prev.map(cv => cv.id === id ? {...cv, message_count: (cv.message_count || 0) + 2} : cv));
          break;
        case 'error':
          patchLast(m => ({ ...m, error: evt.message || evt.error }));
          break;
      }
    };

    // SSE frames are separated by a blank line and can split across chunks —
    // buffer until a frame is whole, otherwise token deltas arrive corrupted.
    let buffer = '';
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream:true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for(const frame of frames){
        for(const line of frame.split('\n')){
          if(!line.startsWith('data: ')) continue;
          try { handle(JSON.parse(line.slice(6))); }
          catch(e){ console.error('SSE parse', e, line.slice(0, 120)); }
        }
      }
    }
    setLoading(false);
    if (me?.auth_enabled) fetchMe(); // refresh runs-left counter
  }

  useEffect(() => {
    fetchMe().then(m => {
      if (!m.auth_enabled || m.status === 'active' || m.admin) listConversations();
    });
    // A shared join link (/?join=CODE) prefills the code so attendees don't type it
    try {
      const code = new URLSearchParams(window.location.search).get('join');
      if (code) setJoinCode(code.toUpperCase());
    } catch {}
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
        <div style={{marginTop:14}}>
          <button onClick={() => setShowAbout(true)} style={btn}>About</button>
        </div>
        <p style={{fontSize:11, opacity:0.55, marginTop:16, marginBottom:0}}>derived from <a href="https://github.com/karpathy/llm-council" target="_blank" rel="noreferrer" style={{color:'inherit'}}>karpathy/llm-council</a></p>
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
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
            <button type="submit" style={btnPrimary}>Join</button>
            <button type="button" onClick={signOut} style={{...btnQuiet, marginLeft:8}}>Sign out</button>
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
        <button onClick={signOut} style={btnQuiet}>Sign out</button>
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
          <div style={{fontSize:11, opacity:0.55}}>independent answers · anonymous peer review · chairperson synthesis</div>
        </div>
        <div style={{flex:1}}/>
        {/* Status: who you are and what your access allows */}
        {me.auth_enabled && (
          <div style={{display:'flex', alignItems:'center', gap:7}}>
            {me.group && (
              <span style={badge} title={me.group.valid_until ? `access until ${new Date(me.group.valid_until).toLocaleString()}` : undefined}>
                {me.group.name}
              </span>
            )}
            {me.group?.runs_per_day > 0 && (() => {
              const left = Math.max(0, me.group.runs_per_day - (me.runs_today || 0));
              const low = left <= 2;
              return (
                <span
                  style={low ? { ...badge, border:'1px solid #e4d3ac', background:'#fbf5e6', color:'#7a5b16' } : badge}
                  title="Council runs remaining today"
                >{left}/{me.group.runs_per_day} runs</span>
              );
            })()}
            {me.admin && <span style={{ ...badge, borderColor:'#1e242c', background:'#fff', color:'#1e242c' }}>admin</span>}
            <span style={{fontSize:13, fontWeight:600, marginLeft:2}}>{me.name || me.email}</span>
          </div>
        )}
        {/* Actions: one shape for every control */}
        <div style={{display:'flex', alignItems:'center', gap:7}}>
          <button onClick={toggleGuide} style={btn}>{showGuide ? 'Hide guide' : 'Show guide'}</button>
          <button onClick={() => setShowAbout(true)} style={btn}>About</button>
          {me.admin && <a href="/admin" style={btnLink}>Admin</a>}
          {me.auth_enabled && <button onClick={signOut} style={btn}>Sign out</button>}
        </div>
      </header>
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {/* Guide strip — columns sit directly above the panel each one describes */}
      {showGuide && (
        <div style={{display:'flex', alignItems:'stretch', borderBottom:'1px solid #e6eaee', background:'#f7f9fb', fontSize:12, lineHeight:'17px'}}>
          <div style={{width:PANEL_SEATS, flexShrink:0, padding:'10px 14px', borderRight:'1px solid #e6eaee'}}>
            <Step n={1}/> <strong>Pick your conversationalists</strong><br/>
            Each seat holds one model and <strong>seat 1 chairs</strong>. Click a seat to change its model{me.group?.models?.length ? ' (your group sets the catalog)' : ''}, <em>+ Add Seat</em> for more (up to 7), <em>×</em> to remove.
          </div>
          <div style={{width:PANEL_CONVOS, flexShrink:0, padding:'10px 14px', borderRight:'1px solid #e6eaee'}}>
            <Step n={2}/> <strong>Start a conversation</strong><br/>
            A titled session that <em>snapshots</em> those seats. Come back to any of them here; change one session's seats with <em>Edit Seats</em> above the chat.
          </div>
          <div style={{flex:1, minWidth:0, padding:'10px 14px', borderRight:'1px solid #e6eaee'}}>
            <Step n={3}/> <strong>Ask — the council deliberates</strong><br/>
            Every seat answers independently, then ranks the others' answers anonymously, then the chairperson synthesizes the final word. The transcript lands here.
          </div>
          <div style={{width:PANEL_FLOW, flexShrink:0, padding:'10px 14px'}}>
            <Step n={4}/> <strong>Watch the council flow</strong><br/>
            The diagram traces each stage live: prompt → individual responses → peer rankings → aggregate → synthesis.
          </div>
        </div>
      )}
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
      {/* 1 · Conversationalists Panel */}
      <div style={{ width:PANEL_SEATS, flexShrink:0, borderRight:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fff' }}>
        <h3 style={{margin:'0 0 2px', display:'flex', alignItems:'center', gap:7}}><Step n={1}/> Conversationalists</h3>
        <div style={{fontSize:11, opacity:0.6, marginBottom:8}}>default seats for new conversations — seat 1 chairs</div>
        <ModelRing value={selectedModelsForNew} onChange={setSelectedModelsForNew} editable={true} showSeatNumbers={true} />
        <div style={{fontSize:11, opacity:0.55, marginTop:14}}>These seats apply to the next conversation you start. The active conversation's seats sit above the chat.</div>
      </div>
      {/* 2 · Conversations Panel */}
      <div style={{ width:PANEL_CONVOS, flexShrink:0, borderRight:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fcfcfc' }}>
        <h3 style={{margin:'0 0 2px', display:'flex', alignItems:'center', gap:7}}><Step n={2}/> Conversations</h3>
        <div style={{fontSize:11, opacity:0.6, marginBottom:10}}>your sessions with the council</div>
        <button onClick={() => createConversation(selectedModelsForNew)} style={{...btnPrimary, marginBottom:12, width:'100%'}}>+ New Conversation</button>
        {offline && <div style={{color:'#b36b00', fontSize:12, marginBottom:8}}>API unreachable. Retrying...</div>}
        {error && <div style={{color:'red', fontSize:12, marginBottom:8}}>Error: {error}</div>}
        <ul style={{listStyle:'none', padding:0, margin:0}}>
          {conversations.map(c => (
            <li key={c.id} style={{marginBottom:8}}>
              <button data-conversation-id={c.id} style={{
                ...btn,
                width:'100%', textAlign:'left', fontSize:13, padding:'7px 10px',
                ...(currentConversation?.id === c.id ? { borderColor:'#1e242c', background:'#eef2f6', fontWeight:600 } : {})
              }} onClick={async () => {
                const r = await fetch(`/api/conversations/${c.id}`);
                if(r.ok){ const data = await r.json(); const conv = data.conversation; setCurrentConversation(conv); setTempModels(conv?.models || []); setEditingModels(false); }
              }}>{c.title || 'Untitled'} <span style={{opacity:0.6, fontWeight:400}}>({c.message_count})</span></button>
            </li>
          ))}
          {!conversations.length && <li style={{fontSize:11, opacity:0.6}}>None yet — start one above.</li>}
        </ul>
      </div>
      {/* 3 · Messages Panel */}
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', background:'#fafafa' }}>
        {currentConversation ? (
          <>
            {/* This conversation: title + seats */}
            <div style={{padding:'10px 16px', borderBottom:'1px solid #e5e5e5', background:'#fff'}}>
              <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
                <Step n={3}/>
                <strong style={{fontSize:14}}>{currentConversation.title || 'Untitled'}</strong>
                <span style={{fontSize:11, opacity:0.55}}>this conversation's seats</span>
                <div style={{flex:1}}/>
                {editingModels ? (
                  <span>
                    <button onClick={saveModels} style={{...btnPrimary, marginRight:6}}>Save</button>
                    <button onClick={() => { setEditingModels(false); setTempModels(currentConversation.models || []); }} style={btnQuiet}>Cancel</button>
                  </span>
                ) : (
                  <button onClick={() => { setEditingModels(true); setTempModels(currentConversation.models || []); }} style={btn}>Edit Seats</button>
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
                    and the chairperson synthesizes the final word — watch it flow through the diagram on the right.
                  </div>
                </div>
              )}
              {currentConversation.messages.map((m,i)=>(
                <CouncilMessage key={i} message={m} seats={currentConversation.models || []} />
              ))}
            </div>
            <div style={{padding:16, borderTop:'1px solid #ddd', background:'#fff'}}>
              <PromptBox loading={loading} onSend={sendMessage} />
            </div>
          </>
        ) : (
          <div style={{padding:32, maxWidth:560}}>
            <h3 style={{margin:'0 0 6px'}}>Welcome{firstName ? `, ${firstName}` : ''}.</h3>
            <p style={{fontSize:13, margin:'0 0 14px', opacity:0.8}}>
              Convene a council in two steps: <strong>1</strong> set the seats in the Conversationalists panel,
              then <strong>2</strong> start a conversation. Your question and the council's deliberation land here;
              the flow diagram tracks it on the right.
              Not sure what anything means? {showGuide ? 'See the guide above.' : (
                <>Use <button onClick={toggleGuide} style={{...btnQuiet, padding:0, textDecoration:'underline', fontSize:13}}>Show guide</button> in the header.</>
              )}
            </p>
            <button onClick={() => createConversation(selectedModelsForNew)} style={{...btnPrimary, padding:'8px 16px'}}>+ New Conversation</button>
            {conversations.length > 0 && <p style={{fontSize:12, opacity:0.6, marginTop:12}}>…or pick a previous conversation from the left.</p>}
          </div>
        )}
      </div>
      {/* 4 · Visualization Panel */}
      <div style={{ width:PANEL_FLOW, flexShrink:0, borderLeft:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fcfcfc' }}>
        <h3 style={{margin:'0 0 2px', display:'flex', alignItems:'center', gap:7}}><Step n={4}/> Council flow</h3>
        <div style={{fontSize:11, opacity:0.6, marginBottom:10}}>prompt → responses → rankings → synthesis</div>
        <CouncilFlow conversation={currentConversation} />
        <SankeyCouncil conversation={currentConversation} />
      </div>
      </div>{/* end flex main row */}
      {/* Footer */}
      <footer style={{display:'flex', alignItems:'center', gap:14, padding:'7px 20px', borderTop:'1px solid #ddd', background:'#fff', fontSize:11, color:'#555'}}>
        <span style={{fontWeight:600}}>LLM Council — Reconvened</span>
        <span style={{opacity:0.75}}>derived from <a href="https://github.com/karpathy/llm-council" target="_blank" rel="noreferrer" style={{color:'inherit'}}>karpathy/llm-council</a></span>
        <button onClick={() => setShowAbout(true)} style={{...btnQuiet, fontSize:11, padding:0, textDecoration:'underline'}}>about</button>
        <div style={{flex:1}}/>
        <a href="https://github.com/tj60647/llm-council" target="_blank" rel="noreferrer" style={{color:'inherit'}}>source</a>
        {me.admin && <a href="/admin" style={{color:'inherit'}}>admin</a>}
        <span style={{opacity:0.6}}>{me.auth_enabled ? (me.email || 'signed in') : 'open mode'}</span>
      </footer>
    </div>
  );
}
