import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { api } from './api';
import { readEpub, type EpubChapter } from './epub-text';

type UploadedBook = { id: string; title: string; author: string; fileName?: string; fileType?: string };
const positionKey = (id: string) => `bookhaven-uploaded-epub-position-${id}`;

export default function UploadedReader({ book, onClose }: { book: UploadedBook; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [chapters, setChapters] = useState<EpubChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [fontSize, setFontSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const isPdf = book.fileType === 'application/pdf' || book.fileName?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get(`/api/books/${book.id}/file`);
        const sourceUrl = String(data.url);
        let blob: Blob;
        try {
          const response = await fetch(sourceUrl, { credentials: 'same-origin' });
          if (!response.ok) throw new Error('Could not load this file.');
          blob = await response.blob();
        } finally {
          if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
        }
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        if (!isPdf) {
          const parsed = await readEpub(await blob.arrayBuffer());
          if (!active) return;
          setChapters(parsed);
          try {
            const saved = Number(localStorage.getItem(positionKey(book.id)));
            if (Number.isSafeInteger(saved) && saved >= 0 && saved < parsed.length) setChapterIndex(saved);
          } catch { /* private browsing can disable storage */ }
        }
        setLoading(false);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Could not open this file.');
        setLoading(false);
      }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [book.id, isPdf]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    back.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  function goTo(index: number) {
    const next = Math.max(0, Math.min(chapters.length - 1, index));
    setChapterIndex(next);
    scroller.current?.scrollTo(0, 0);
    try { localStorage.setItem(positionKey(book.id), String(next)); } catch { /* storage may be unavailable */ }
  }
  function download() {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = book.fileName || (isPdf ? 'book.pdf' : 'book.epub');
    link.click();
  }

  return (
    <div className="reader uploaded-reader" role="dialog" aria-modal="true" aria-label={`Read ${book.title}`}>
      <header className="reader-top">
        <button className="reader-back" ref={back} onClick={onClose}><ArrowLeft size={18} /><span>Back to library</span></button>
        <div className="reader-heading"><strong>{book.title}</strong><span>{book.author}</span></div>
        <button className="reader-file-download" onClick={download} disabled={!url}><ArrowDownToLine size={17} /><span>Download</span></button>
      </header>
      {loading && <div className="uploaded-reader-state" role="status">Opening your ebook…</div>}
      {error && <div className="uploaded-reader-state" role="alert"><p>{error}</p><button onClick={download} disabled={!url}>Download the file instead</button></div>}
      {!loading && !error && isPdf && <iframe className="uploaded-pdf" src={url} title={`PDF reader for ${book.title}`} />}
      {!loading && !error && !isPdf && chapters.length > 0 && <>
        <div className="uploaded-reader-nav">
          <button onClick={() => goTo(chapterIndex - 1)} disabled={chapterIndex === 0} aria-label="Previous section"><ChevronLeft size={18} /></button>
          <label><span>Section</span><select aria-label="Select section" value={chapterIndex} onChange={event => goTo(Number(event.target.value))}>{chapters.map((chapter, index) => <option key={index} value={index}>{index + 1}. {chapter.title}</option>)}</select></label>
          <button onClick={() => goTo(chapterIndex + 1)} disabled={chapterIndex === chapters.length - 1} aria-label="Next section"><ChevronRight size={18} /></button>
          <span className="uploaded-reader-count">{chapterIndex + 1} / {chapters.length}</span>
          <div className="uploaded-reader-size"><button onClick={() => setFontSize(size => Math.max(16, size - 2))} disabled={fontSize === 16} aria-label="Smaller text"><Minus size={17} /></button><span>Aa</span><button onClick={() => setFontSize(size => Math.min(28, size + 2))} disabled={fontSize === 28} aria-label="Larger text"><Plus size={17} /></button></div>
        </div>
        <div className="reader-scroll" ref={scroller}>
          <div className="reader-paper uploaded-paper">
            <span className="eyebrow">YOUR EBOOK · {book.fileName}</span>
            <h1>{chapters[chapterIndex].title}</h1>
            <div className="reader-body" style={{ fontSize }}>{chapters[chapterIndex].paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            <div className="reader-end"><button className="secondary" onClick={() => goTo(chapterIndex + 1)} disabled={chapterIndex === chapters.length - 1}>Next section <ChevronRight size={16} /></button></div>
          </div>
        </div>
      </>}
    </div>
  );
}
