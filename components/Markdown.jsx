"use client";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Model output rendered as markdown. Raw HTML is not enabled, so model text
// cannot inject markup. `compact` trims vertical rhythm for dense panels.
export default function Markdown({ children, compact = false }) {
  return (
    <div className={`md${compact ? ' md-compact' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ''}</ReactMarkdown>
      <style jsx>{`
        .md {
          font-size: 14px;
          line-height: 1.6;
          color: #1e242c;
          overflow-wrap: anywhere;
        }
        .md-compact { font-size: 13px; line-height: 1.55; }
        .md :global(p) { margin: 0 0 10px; }
        .md :global(p:last-child) { margin-bottom: 0; }
        .md :global(h1), .md :global(h2), .md :global(h3),
        .md :global(h4), .md :global(h5), .md :global(h6) {
          margin: 16px 0 6px; line-height: 1.3; font-weight: 600;
        }
        .md :global(h1) { font-size: 1.35em; }
        .md :global(h2) { font-size: 1.2em; }
        .md :global(h3) { font-size: 1.08em; }
        .md :global(h4), .md :global(h5), .md :global(h6) { font-size: 1em; }
        .md :global(> :first-child) { margin-top: 0; }
        .md :global(ul), .md :global(ol) { margin: 0 0 10px; padding-left: 22px; }
        .md :global(li) { margin: 2px 0; }
        .md :global(li > p) { margin: 0; }
        .md :global(a) { color: #2a78d6; }
        .md :global(code) {
          background: #eef2f6; border-radius: 4px; padding: 1px 5px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em;
        }
        .md :global(pre) {
          background: #f4f7f9; border: 1px solid #e2e8f0; border-radius: 6px;
          padding: 10px 12px; overflow-x: auto; margin: 0 0 10px;
        }
        .md :global(pre code) { background: none; padding: 0; font-size: 12px; line-height: 1.5; }
        .md :global(blockquote) {
          margin: 0 0 10px; padding: 2px 0 2px 12px;
          border-left: 3px solid #cfd8e0; color: #52514e;
        }
        .md :global(table) {
          border-collapse: collapse; margin: 0 0 10px; font-size: 0.93em;
          display: block; overflow-x: auto; max-width: 100%;
        }
        .md :global(th), .md :global(td) {
          border: 1px solid #e2e8f0; padding: 5px 9px; text-align: left;
        }
        .md :global(th) { background: #f4f7f9; font-weight: 600; }
        .md :global(hr) { border: none; border-top: 1px solid #e2e8f0; margin: 14px 0; }
        .md :global(img) { max-width: 100%; }
      `}</style>
    </div>
  );
}
