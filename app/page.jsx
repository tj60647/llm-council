"use client";
import { useState, useEffect } from 'react';
import SankeyCouncil from '../components/SankeyCouncil';
import FlowDiagram from '../components/FlowDiagram';
import ModelSelector from '../components/ModelSelector';
import ModelRing from '../components/ModelRing';
import { DEFAULT_COUNCIL_MODELS } from '../lib/config/models.js';

export default function HomePage() {
  // Header state
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

  async function listConversations() {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Failed to list conversations');
      const data = await res.json();
      console.log('[listConversations] received', data.length, 'items');
      setConversations(data);
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
      console.log('[createConversation] created id:', data.id, 'metadata:', data.metadata);
      setConversations(prev => [data.metadata, ...prev]);
      setCurrentConversation(data);
      setTempModels(data.models || []);
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
  }

  useEffect(() => { listConversations(); }, []);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>
      {/* Header */}
      <header style={{padding:'12px 20px', borderBottom:'1px solid #ddd', background:'#ffffff'}}>
        <h2 style={{margin:'0 0 4px', fontWeight:600}}>LLM Council</h2>
        <p style={{margin:0, fontSize:13, lineHeight:'18px', maxWidth:960}}>
          A conversation is a titled session with a set of <strong>seats</strong>. Each seat holds one conversationalist model.
          When you send a prompt the council runs multi-stage reasoning: models respond, they peer-evaluate, rankings are
          aggregated, and a chairman synthesizes a final answer. Adjust default seats on the left, then create conversations
          with those occupants or edit seats per conversation.
        </p>
      </header>
      <div style={{ display:'flex', flex:1, minHeight:0 }}>
      {/* Conversations Panel */}
      <div style={{ width:260, borderRight:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fcfcfc' }}>
        <h3 style={{marginTop:0}}>Conversations</h3>
        <button onClick={() => createConversation(selectedModelsForNew)} style={{marginBottom:12}}>New Conversation</button>
        {offline && <div style={{color:'#b36b00', fontSize:12, marginBottom:8}}>API unreachable. Retrying...</div>}
        {error && <div style={{color:'red', fontSize:12, marginBottom:8}}>Error: {error}</div>}
        <ul style={{listStyle:'none', padding:0, margin:0}}>
          {conversations.map(c => (
            <li key={c.id} style={{marginBottom:8}}>
              <button style={{width:'100%', textAlign:'left', fontSize:13}} onClick={async () => {
                const r = await fetch(`/api/conversations/${c.id}`);
                if(r.ok){ const full = await r.json(); setCurrentConversation(full); setTempModels(full.models || []); setEditingModels(false); }
              }}>{c.title || 'Untitled'} <span style={{opacity:0.6}}>({c.message_count})</span></button>
            </li>
          ))}
        </ul>
      </div>
      {/* Conversationalists Panel */}
      <div style={{ width:300, borderRight:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fff' }}>
        <h3 style={{marginTop:0}}>Conversationalists</h3>
        <h4 style={{margin:'8px 0 4px'}}>Default Seats (New)</h4>
        <ModelRing value={selectedModelsForNew} onChange={setSelectedModelsForNew} editable={true} showSeatNumbers={true} />
        <div style={{marginTop:20}}>
          <h4 style={{margin:'8px 0 4px'}}>This Conversation</h4>
          {currentConversation ? (
            <>
              <ModelRing
                value={editingModels ? tempModels : (currentConversation.models || [])}
                onChange={setTempModels}
                editable={editingModels}
                showSeatNumbers={true}
              />
              {editingModels ? (
                <div style={{marginTop:8}}>
                  <button onClick={saveModels} style={{marginRight:8}}>Save</button>
                  <button onClick={() => { setEditingModels(false); setTempModels(currentConversation.models || []); }} style={{fontSize:12}}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => { setEditingModels(true); setTempModels(currentConversation.models || []); }} style={{fontSize:12, marginTop:8}}>Edit Seats</button>
              )}
            </>
          ) : (
            <div style={{fontSize:12, opacity:0.7}}>Select a conversation to view its seats.</div>
          )}
        </div>
      </div>
      {/* Messages Panel */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fafafa' }}>
        {currentConversation ? (
          <>
            <div style={{flex:1, overflowY:'auto', padding:16}}>
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
          <div style={{padding:32}}>Select or create a conversation.</div>
        )}
      </div>
      {/* Visualization Panel */}
      <div style={{ width:400, borderLeft:'1px solid #ddd', padding:16, overflowY:'auto', background:'#fcfcfc' }}>
        <FlowDiagram conversation={currentConversation} />
        <SankeyCouncil conversation={currentConversation} />
      </div>
      </div>{/* end flex main row */}
    </div>
  );
}
