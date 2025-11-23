"use client";
import React, { useMemo } from 'react';

// Simple flow diagram showing council pipeline with status coloring.
// Stages: Prompt -> Stage 1 Responses -> Peer Evaluations -> Aggregated Rankings -> Final Synthesis

function stageStatus(msg, stageKey) {
  if(!msg) return 'pending';
  const loading = msg.loading || {};
  switch(stageKey){
    case 'stage1': return loading.stage1 ? 'running' : (msg.stage1 ? 'complete' : 'pending');
    case 'stage2': return loading.stage2 ? 'running' : (msg.stage2 ? 'complete' : 'pending');
    case 'aggregate': return msg.metadata?.aggregate_rankings ? 'complete' : (msg.stage2 ? 'running' : 'pending');
    case 'stage3': return loading.stage3 ? 'running' : (msg.stage3 ? 'complete' : 'pending');
    default: return 'pending';
  }
}

function boxColor(status){
  switch(status){
    case 'running': return '#ffe08a';
    case 'complete': return '#c5f7c5';
    default: return '#f0f0f0';
  }
}

export default function FlowDiagram({ conversation }) {
  const lastAssistant = useMemo(() => {
    if(!conversation) return null;
    const rev = [...conversation.messages].reverse();
    return rev.find(m => m.role === 'assistant') || null;
  }, [conversation]);

  const s1 = stageStatus(lastAssistant, 'stage1');
  const s2 = stageStatus(lastAssistant, 'stage2');
  const sa = stageStatus(lastAssistant, 'aggregate');
  const s3 = stageStatus(lastAssistant, 'stage3');

  return (
    <div style={{marginBottom:24}}>
      <h3 style={{margin:'8px 0'}}>Council Flow</h3>
      <div style={{fontSize:12, marginBottom:8, lineHeight:1.4}}>
        This diagram shows how your prompt travels through the council: each model drafts a response (Stage 1), all models rank every draft (Stage 2), rankings are merged (Aggregate), then the chairman model synthesizes the final answer (Stage 3). You can expand message details to inspect raw artifacts.
      </div>
      <div style={{display:'flex', alignItems:'center', flexWrap:'wrap', gap:12}}>
        <Stage label="Prompt" status={conversation ? 'complete' : 'pending'} tooltip="Your latest submitted question." />
        <Arrow />
        <Stage label="Stage 1 Responses" status={s1} tooltip="Parallel model answers." />
        <Arrow />
        <Stage label="Peer Evaluations" status={s2} tooltip="Each model ranks all responses." />
        <Arrow />
        <Stage label="Aggregate Rankings" status={sa} tooltip="Consensus ordering derived from peer rankings." />
        <Arrow />
        <Stage label="Final Synthesis" status={s3} tooltip="Chairman model produces consolidated answer." />
      </div>
      <Legend />
    </div>
  );
}

function Stage({ label, status, tooltip }) {
  return (
    <div title={tooltip} style={{
      padding:'10px 12px',
      border:'1px solid #ccc',
      borderRadius:6,
      background: boxColor(status),
      minWidth:140,
      textAlign:'center',
      fontSize:12
    }}>
      <div style={{fontWeight:600}}>{label}</div>
      <div style={{opacity:0.7}}>{status}</div>
    </div>
  );
}

function Arrow(){
  return <div style={{width:24, textAlign:'center', fontSize:18}}>→</div>;
}

function Legend(){
  const itemStyle = { display:'flex', alignItems:'center', gap:6, fontSize:11 };
  const swatch = c => <div style={{width:14, height:14, background:c, border:'1px solid #bbb', borderRadius:3}} />;
  return (
    <div style={{marginTop:12, display:'flex', gap:16, flexWrap:'wrap'}}>
      <div style={itemStyle}>{swatch(boxColor('pending'))} Pending</div>
      <div style={itemStyle}>{swatch(boxColor('running'))} Running</div>
      <div style={itemStyle}>{swatch(boxColor('complete'))} Complete</div>
    </div>
  );
}
