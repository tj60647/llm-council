"use client";
import Modal from './Modal.jsx';

const REPO = 'https://github.com/karpathy/llm-council';
const READING_THREAD = 'https://x.com/karpathy/status/1990577951671509438';
const FORK = 'https://github.com/tj60647/llm-council';

const p = { fontSize:13, lineHeight:1.6, color:'#1e242c', margin:'0 0 10px' };
const h = { fontSize:13, fontWeight:600, margin:'18px 0 6px' };
const quote = {
  margin:'0 0 10px', padding:'8px 12px', borderLeft:'3px solid #cfd8e0',
  background:'#f7f9fb', fontSize:12.5, lineHeight:1.6, color:'#52514e'
};
const link = { color:'#2a78d6' };

export default function AboutModal({ onClose }) {
  return (
    <Modal
      title="About LLM Council"
      subtitle="what it is, and why Andrej Karpathy built the original"
      badge={<img src="/logo.svg" alt="" width={30} height={30} style={{borderRadius:7, flexShrink:0}}/>}
      onClose={onClose}
      width={640}
    >
      <div style={{padding:'14px 18px 20px'}}>
        <p style={p}>
          Instead of putting a question to one favourite model, you seat several of them as a
          <strong> council</strong>. Every seat answers independently, the seats then rank each other's
          answers, and a chairperson writes the final answer from all of it.
        </p>

        <h4 style={h}>What the original was demonstrating</h4>
        <p style={p}>
          Andrej Karpathy released <a href={REPO} target="_blank" rel="noreferrer" style={link}>karpathy/llm-council</a> in
          November 2025. He built it to <em>evaluate models against each other</em> as much as to answer questions —
          it came out of {' '}
          <a href={READING_THREAD} target="_blank" rel="noreferrer" style={link}>reading books alongside LLMs</a> and
          wanting to see how they differed:
        </p>
        <blockquote style={quote}>
          “This project was 99% vibe coded as a fun Saturday hack because I wanted to explore and evaluate a
          number of LLMs side by side… It's nice and useful to see multiple responses side by side, and also
          the cross-opinions of all LLMs on each other's outputs.”
        </blockquote>
        <p style={p}>
          The load-bearing design choice is in stage 2. When the seats review each other, the model names are
          stripped out and replaced with “Response A, B, C…”, because — in his words — it means
          “the LLM can't play favorites when judging their outputs.” Take the anonymity away and you are
          measuring brand loyalty rather than answer quality.
        </p>
        <p style={p}>
          He was also making a point about the code itself, and it is the reason this fork exists:
        </p>
        <blockquote style={quote}>
          “I'm not going to support it in any way, it's provided here as is for other people's inspiration…
          Code is ephemeral now and libraries are over, ask your LLM to change it in whatever way you like.”
        </blockquote>

        <h4 style={h}>What this version adds</h4>
        <p style={p}>
          The original is a local app that keeps conversations in JSON files. This one is a single Next.js app
          that survives being deployed: persistent storage, live streaming of every stage, real per-model timing
          and cost, markdown answers, and sign-in with group-based access for running the council in a workshop.
          The three-stage design and the anonymised peer review are his, unchanged.
        </p>

        <h4 style={h}>Links</h4>
        <p style={{...p, margin:0}}>
          <a href={REPO} target="_blank" rel="noreferrer" style={link}>karpathy/llm-council</a> — the original ·{' '}
          <a href={FORK} target="_blank" rel="noreferrer" style={link}>this fork's source</a>
        </p>
      </div>
    </Modal>
  );
}
