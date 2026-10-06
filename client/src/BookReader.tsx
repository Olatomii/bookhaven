import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowDownToLine, Minus, Plus } from 'lucide-react';

type ReaderBook = { id: number; title: string; author: string };
const notice = 'This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the Project Gutenberg License included with this eBook or online at www.gutenberg.org. If you are not located in the United States, you’ll have to check the laws of the country where you are located before using this ebook.';
const key = (id: number) => `bookhaven-reading-position-${id}`;
const sizeKey = 'bookhaven-reader-font-size';
const savedNumber = (name: string, fallback: number) => {
  try { const stored = localStorage.getItem(name); if (stored === null) return fallback; const value = Number(stored); return Number.isFinite(value) && value >= 0 ? value : fallback; }
  catch { return fallback; }
};

export default function BookReader({ book, onClose }: { book: ReaderBook; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(() => Math.min(100, savedNumber(key(book.id), 0)));
  const [fontSize, setFontSize] = useState(() => Math.min(28, Math.max(16, savedNumber(sizeKey, 20))));
  const scroller = useRef<HTMLDivElement>(null);
  const latest = useRef(progress);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}books/${book.id}.txt`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('This edition could not be loaded.'); return response.text(); })
      .then(content => {
        if (!content.includes('START OF THE PROJECT GUTENBERG EBOOK') || !content.includes('END OF THE PROJECT GUTENBERG EBOOK')) throw new Error('The edition is incomplete.');
        setText(content.replace(/\r\n/g, '\n'));
        setError('');
        setLoading(false);
      })
      .catch(err => { if (controller.signal.aborted) return; setError(err instanceof Error ? err.message : 'The edition could not be loaded.'); setLoading(false); });
    return () => controller.abort();
  }, [book.id]);

  useEffect(() => {
    if (!text) return;
    const frame = requestAnimationFrame(() => {
      const node = scroller.current;
      if (node) node.scrollTop = latest.current / 100 * Math.max(0, node.scrollHeight - node.clientHeight);
    });
    return () => cancelAnimationFrame(frame);
  }, [text]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape); };
  }, [onClose]);

  function move(value: number) {
    const next = Math.min(100, Math.max(0, value));
    const node = scroller.current;
    if (node) node.scrollTop = next / 100 * Math.max(0, node.scrollHeight - node.clientHeight);
    latest.current = next;
    setProgress(next);
    try { localStorage.setItem(key(book.id), String(next)); } catch { /* storage may be unavailable */ }
  }
  function onScroll() {
    const node = scroller.current;
    if (!node) return;
    const max = node.scrollHeight - node.clientHeight;
    const next = max > 0 ? Math.round(node.scrollTop / max * 100) : 0;
    if (next === latest.current) return;
    latest.current = next;
    setProgress(next);
    try { localStorage.setItem(key(book.id), String(next)); } catch { /* storage may be unavailable */ }
  }
  function resize(delta: number) {
    const next = Math.min(28, Math.max(16, fontSize + delta));
    const current = latest.current;
    setFontSize(next);
    try { localStorage.setItem(sizeKey, String(next)); } catch { /* storage may be unavailable */ }
    requestAnimationFrame(() => move(current));
  }

  // The source is complete, including its front matter and license. Reflowing
  // soft line breaks gives the plain text edition a more comfortable measure.
  const paragraphs = useMemo(() => text.split(/\n[ \t]*\n+/).filter(Boolean).map(part => part.replace(/\n/g, ' ').replace(/[ \t]+/g, ' ').trim()), [text]);

  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label={`Read ${book.title}`}>
      <header className="reader-top">
        <button className="reader-back" onClick={onClose}><ArrowLeft size={18} /> <span>Back to books</span></button>
        <div className="reader-heading"><strong>{book.title}</strong><span>{book.author}</span></div>
        <div className="reader-tools" aria-label="Reading controls">
          <button onClick={() => resize(-2)} disabled={fontSize <= 16} aria-label="Smaller text"><Minus size={17} /></button>
          <span>Aa</span>
          <button onClick={() => resize(2)} disabled={fontSize >= 28} aria-label="Larger text"><Plus size={17} /></button>
        </div>
      </header>
      <div className="reader-progress"><input type="range" min="0" max="100" value={progress} onChange={event => move(Number(event.target.value))} aria-label="Reading position" disabled={!text} /><span>{progress}%</span></div>
      <div className="reader-scroll" ref={scroller} onScroll={onScroll}>
        <div className="reader-paper">
          <span className="eyebrow">A FREE CLASSIC</span>
          <h1>{book.title}</h1>
          <p className="reader-byline">by {book.author}</p>
          <aside className="reader-license">{notice} <a href="https://www.gutenberg.org/policy/license.html" target="_blank" rel="noopener noreferrer">Full license ↗</a></aside>
          {loading && <p className="reader-message" role="status">Opening this book…</p>}
          {error && <p className="reader-message" role="alert">{error} <a href={`https://www.gutenberg.org/ebooks/${book.id}`} target="_blank" rel="noopener noreferrer">Open the source edition ↗</a></p>}
          {text && <div className="reader-body" style={{ fontSize }} lang="en">{paragraphs.map((part, index) => <p key={index}>{part}</p>)}</div>}
          <div className="reader-end"><span>✦</span><p>End of edition</p><a href={`https://www.gutenberg.org/ebooks/${book.id}`} target="_blank" rel="noopener noreferrer"><ArrowDownToLine size={16} /> Source and download options</a></div>
        </div>
      </div>
    </div>
  );
}
