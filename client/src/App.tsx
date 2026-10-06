import { useEffect, useMemo, useRef, useState } from 'react';
import { api, auth } from './api';
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  ChevronDown,
  CirclePlus,
  CloudUpload,
  FileText,
  LibraryBig,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

type Status = 'To read' | 'Reading' | 'Finished';
type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  status: Status;
  notes: string;
  addedAt: string;
  filePath?: string;
  fileName?: string;
  fileType?: string;
};
type Form = Pick<Book, 'title' | 'author' | 'category' | 'status' | 'notes'>;
const empty: Form = {
  title: '',
  author: '',
  category: '',
  status: 'To read',
  notes: '',
};
const filters = ['All books', 'To read', 'Reading', 'Finished'] as const;
const palettes = [
  ['#b57353', '#edc4a5'],
  ['#426e72', '#b5dad7'],
  ['#6a5d80', '#d2c5de'],
  ['#a3774b', '#ead6a9'],
  ['#6d784d', '#d9d7a4'],
  ['#6b738e', '#c6d0df'],
];
function palette(title: string) {
  return palettes[
    [...title].reduce((n, c) => n + c.charCodeAt(0), 0) % palettes.length
  ];
}
function messageOf(err: unknown) {
  return err instanceof Error
    ? err.message
    : 'Something went wrong. Please try again.';
}

type FreeBook = {
  id: number;
  title: string;
  author: string;
  genre: string;
  year: string;
  description: string;
};
const freeBooks: FreeBook[] = [
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'Romance', year: '1813', description: 'Elizabeth Bennet and Mr. Darcy learn that first impressions rarely tell the whole story.' },
  { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', genre: 'Fantasy', year: '1865', description: 'Follow Alice down the rabbit hole into a wonderfully strange world.' },
  { id: 84, title: 'Frankenstein', author: 'Mary Shelley', genre: 'Gothic', year: '1818', description: 'A young scientist creates life and must face the consequences.' },
  { id: 46, title: 'A Christmas Carol', author: 'Charles Dickens', genre: 'Classic', year: '1843', description: 'A miser is given one night to reconsider the life he has chosen.' },
  { id: 76, title: 'Adventures of Huckleberry Finn', author: 'Mark Twain', genre: 'Adventure', year: '1884', description: 'A journey down the Mississippi becomes a story of friendship and freedom.' },
];
const freeGenres = ['All books', 'Romance', 'Fantasy', 'Gothic', 'Classic', 'Adventure'];
const demo = import.meta.env.VITE_DEMO === 'true';

function FreeCatalog({ onLibrary, signedIn }: { onLibrary: () => void; signedIn: boolean }) {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All books');
  const matches = freeBooks.filter(book =>
    (genre === 'All books' || book.genre === genre) &&
    (!query.trim() || [book.title, book.author, book.genre].some(value =>
      value.toLowerCase().includes(query.trim().toLowerCase())))
  );
  return (
    <div className="free-page">
      <header className="free-topbar">
        <div className="brand"><span className="brand-mark"><BookOpen size={20} /></span> bookhaven<span className="brand-dot">.</span></div>
        <button className="free-library-link" onClick={onLibrary}>{signedIn ? 'My library' : 'Sign in'} <span>↗</span></button>
      </header>
      <main className="free-content">
        <section className="free-hero">
          <div><span className="eyebrow">OPEN TO EVERY READER</span><h1>Stories worth sharing<span className="period">.</span></h1><p>Discover timeless books you can read for free. No account or payment needed.</p><div className="free-hero-meta"><span>✦ &nbsp; 5 curated classics</span><span>Free EPUB downloads</span></div></div>
          <div className="free-hero-art" aria-hidden="true"><span/><span/><span/><span/></div>
        </section>
        <div className="free-section-heading"><div><span className="eyebrow">THE OPEN SHELF</span><h2>Explore free books</h2></div><p>Choose a book and download from its original source.</p></div>
        <div className="free-controls"><label className="search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title or author…" aria-label="Search free books"/></label><div className="free-tags" aria-label="Filter free books">{freeGenres.map(item => <button key={item} className={genre === item ? 'chosen' : ''} onClick={() => setGenre(item)}>{item}</button>)}</div></div>
        {matches.length ? <div className="free-grid">{matches.map(book => {
          const [dark, light] = palette(book.title);
          return <article className="free-card" key={book.id}>
            <div className="free-cover" style={{ background: `linear-gradient(145deg, ${dark}, ${light})` }}><span>✦</span><strong>{book.title}</strong><i/><small>{book.author}</small></div>
            <div className="free-card-info"><div className="free-card-label"><span>{book.genre}</span><span>{book.year}</span></div><h3>{book.title}</h3><p className="free-author">by {book.author}</p><p className="free-description">{book.description}</p><div className="free-card-actions"><a className="free-download" href={`https://www.gutenberg.org/ebooks/${book.id}.epub3.images`} target="_blank" rel="noopener noreferrer"><ArrowDownToLine size={16}/> Download EPUB</a><a className="free-source" href={`https://www.gutenberg.org/ebooks/${book.id}`} target="_blank" rel="noopener noreferrer">Other formats ↗</a></div></div>
          </article>;
        })}</div> : <div className="empty"><h3>No books found</h3><p>Try another title, author, or category.</p></div>}
        <div className="free-note"><BookOpen size={20}/><div><strong>About these editions</strong><p>Downloads open on Project Gutenberg, which provides these books free of charge. The listed editions are marked public domain in the United States. If you are elsewhere, check your local copyright rules and the source's terms before downloading.</p></div></div>
        <footer>Made for the books you can't forget. <span>✦</span></footer>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(
    null
  );
  const [authBusy, setAuthBusy] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All books');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('Newest first');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [selected, setSelected] = useState<Book | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<'personal' | 'free'>(demo ? 'free' : 'personal');
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(next?: string) {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(
        '/api/books',
        next ? { cursor: next } : undefined
      );
      const data = response.data as { items: Book[]; nextToken: string | null };
      setBooks(prev =>
        next
          ? [
              ...prev,
              ...data.items.filter(
                item => !prev.some(existing => existing.id === item.id)
              ),
            ]
          : data.items
      );
      setCursor(data.nextToken);
    } catch (err) {
      setError(`Could not load your books. ${messageOf(err)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    auth
      .getUser()
      .then(person => {
        if (!active) return;
        setUser(person);
        setAuthBusy(false);
        if (person) void load();
      })
      .catch(() => {
        if (active) setAuthBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const items = books.filter(
      book =>
        (filter === 'All books' || book.status === filter) &&
        (!needle ||
          [book.title, book.author, book.category].some(value =>
            value.toLocaleLowerCase().includes(needle)
          ))
    );
    return [...items].sort((a, b) =>
      sort === 'Title A–Z'
        ? a.title.localeCompare(b.title)
        : sort === 'Author A–Z'
          ? a.author.localeCompare(b.author)
          : b.addedAt.localeCompare(a.addedAt)
    );
  }, [books, filter, search, sort]);

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setPendingFile(null);
    setFormError('');
    setModal(true);
    setMenuOpen(false);
  }
  function openEdit(book: Book) {
    setEditing(book);
    setForm({
      title: book.title,
      author: book.author,
      category: book.category,
      status: book.status,
      notes: book.notes,
    });
    setPendingFile(null);
    setFormError('');
    setModal(true);
    setSelected(null);
  }
  function upsert(book: Book) {
    setBooks(prev => [book, ...prev.filter(item => item.id !== book.id)]);
    setSelected(book);
  }
  function chooseFile(file: File | undefined) {
    if (!file) return;
    const type = file.name.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : file.name.toLowerCase().endsWith('.epub')
        ? 'application/epub+zip'
        : '';
    if (!type || file.size > 3_000_000) {
      setFormError('Choose a PDF or EPUB smaller than 3 MB.');
      return;
    }
    setFormError('');
    setPendingFile(file);
  }
  function base64Of(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.readAsDataURL(file);
    });
  }
  async function upload(book: Book, file: File) {
    const fileType = file.name.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/epub+zip';
    const response = await api.post(`/api/books/${book.id}/file`, {
      fileName: file.name,
      fileType,
      base64: await base64Of(file),
    });
    return response.data as Book;
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      setFormError('Please add a title and author.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const result = editing
        ? await api.put(`/api/books/${editing.id}`, form)
        : await api.post('/api/books', form);
      let book = result.data as Book;
      if (pendingFile) book = await upload(book, pendingFile);
      upsert(book);
      setModal(false);
      setPendingFile(null);
    } catch (err) {
      setFormError(
        `Could not save. ${messageOf(err)}${pendingFile ? ' If the book was created, refresh to check before trying again.' : ''}`
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove(book: Book) {
    if (
      !window.confirm(
        `Remove '${book.title}' from your library? This also removes its uploaded file.`
      )
    )
      return;
    try {
      await api.delete(`/api/books/${book.id}`);
      setBooks(prev => prev.filter(item => item.id !== book.id));
      setSelected(null);
    } catch (err) {
      setError(`Could not remove the book. ${messageOf(err)}`);
    }
  }
  async function openFile(book: Book) {
    try {
      const { data } = await api.get(`/api/books/${book.id}/file`);
      if (demo) {
        const link = document.createElement('a');
        link.href = data.url;
        link.download = book.fileName || 'ebook';
        link.click();
        setTimeout(() => URL.revokeObjectURL(data.url), 60_000);
      } else window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(`Could not open the file. ${messageOf(err)}`);
    }
  }
  async function removeFile(book: Book) {
    if (!window.confirm(`Remove the file attached to '${book.title}'?`)) return;
    try {
      const { data } = await api.delete(`/api/books/${book.id}/file`);
      upsert(data as Book);
    } catch (err) {
      setError(`Could not remove the file. ${messageOf(err)}`);
    }
  }
  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setAuthSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(authMode === 'signin' ? '/api/login' : '/api/register', {
        email,
        password,
        ...(authMode === 'register' ? { name } : {}),
      });
      setUser(data.user);
      setPassword('');
      setView('personal');
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setAuthSubmitting(false);
    }
  }
  async function signOut() {
    await auth.signOut();
    setUser(null);
    setBooks([]);
    setSelected(null);
    setCursor(null);
  }
  const count = (key: string) =>
    key === 'All books'
      ? books.length
      : books.filter(book => book.status === key).length;

  if (authBusy)
    return (
      <div className="startup">
        <LibraryBig size={34} />
        <p>Opening your library…</p>
      </div>
    );
  if (view === 'free') return <FreeCatalog signedIn={!!user} onLibrary={() => setView('personal')} />;
  if (!user)
    return (
      <div className="welcome">
        <div className="welcome-art">
          <div className="brand">
            <span className="brand-mark">
              <BookOpen size={20} />
            </span>{' '}
            bookhaven<span className="brand-dot">.</span>
          </div>
          <div className="welcome-books">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p>A home for every story.</p>
        </div>
        <div className="welcome-copy">
          <span className="eyebrow">YOUR PERSONAL LIBRARY</span>
          <h1>
            Every great read,
            <br />
            <em>in one place.</em>
          </h1>
          <p>
            Keep a thoughtful collection of books you own, love, and want to
            read next. Add an ebook to open it anytime.
          </p>
          <form className="auth-form" onSubmit={signIn}>
            {authMode === 'register' && <label>Display name<input required maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></label>}
            <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <label>Password<input required minLength={8} type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={authMode === 'register' ? 'At least 8 characters' : 'Your password'} /></label>
            <button className="primary big" type="submit" disabled={authSubmitting}>{authSubmitting ? 'Please wait…' : authMode === 'signin' ? 'Sign in to your library' : 'Create your account'} <span>↗</span></button>
          </form>
          <button className="auth-switch" onClick={() => { setAuthMode(authMode === 'signin' ? 'register' : 'signin'); setError(''); }}>
            {authMode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
          <button className="browse-link" onClick={() => setView('free')}>Browse free books <span>→</span></button>
          {error && <p className="alert">{error}</p>}
          <div className="welcome-note">
            <Check size={16} /> Your collection is private to your account
          </div>
        </div>
      </div>
    );

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'show' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <BookOpen size={20} />
          </span>{' '}
          bookhaven<span className="brand-dot">.</span>
        </div>
        <div className="side-label">YOUR LIBRARY</div>
        <nav aria-label="Library filters">
          {filters.map(item => (
            <button
              key={item}
              className={`nav-item ${filter === item ? 'active' : ''}`}
              onClick={() => {
                setFilter(item);
                setMenuOpen(false);
              }}
            >
              <span>
                <LibraryBig size={17} />
                {item}
              </span>
              <small>{count(item)}</small>
            </button>
          ))}
        </nav>
        <div className="side-label explore-label">EXPLORE</div>
        <button className="nav-item free-nav" onClick={() => { setView('free'); setMenuOpen(false); }}><span><BookOpen size={17}/> Free books</span><small>↗</small></button>
        <div className="side-bottom">
          <div className="side-quote">
            <Sparkles size={17} />
            <p>“A reader lives a thousand lives before he dies.”</p>
            <span>— George R. R. Martin</span>
          </div>
          <div className="profile" title={demo ? 'This shelf is saved in this browser' : 'Your account'}>
            <span className="avatar">
              {(user.name || user.email || 'R')[0].toUpperCase()}
            </span>
            <span className="profile-name">
              <strong>{user.name || 'Your account'}</strong>
              <small>{user.email || 'Sign out'}</small>
            </span>
            {!demo && <button className="profile-signout" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>}
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            My library <span>/</span> <strong>{filter}</strong>
          </div>
          <div className="top-actions">
            <span className="top-welcome">A space for your stories</span>
            <span className="top-avatar">
              {(user.name || user.email || 'R')[0].toUpperCase()}
            </span>
          </div>
        </header>
        <div className="content">
          <div className="hero">
            <div>
              <span className="eyebrow">THE COLLECTION</span>
              <h1>
                Your library<span className="period">.</span>
              </h1>
              <p>
                All the stories you've kept close, beautifully in one place.
              </p>
            </div>
            <button className="primary" onClick={openAdd}>
              <CirclePlus size={18} /> Add a book
            </button>
          </div>
          {demo && <p className="demo-note"><strong>Free demo:</strong> Your shelf and uploaded files are saved only in this browser. They do not sync to other devices; clearing browser data removes them.</p>}
          <div className="stats">
            <div>
              <span>ALL BOOKS</span>
              <strong>{books.length.toString().padStart(2, '0')}</strong>
              <small>In your collection</small>
            </div>
            <div>
              <span>CURRENTLY READING</span>
              <strong>{count('Reading').toString().padStart(2, '0')}</strong>
              <small>Pages in progress</small>
            </div>
            <div>
              <span>FINISHED</span>
              <strong>{count('Finished').toString().padStart(2, '0')}</strong>
              <small>Stories completed</small>
            </div>
          </div>
          <div className="section-head">
            <div>
              <span className="eyebrow">BROWSE THE SHELVES</span>
              <h2>{filter === 'All books' ? 'The collection' : filter}</h2>
            </div>
            <span className="result-count">
              {visible.length} {visible.length === 1 ? 'book' : 'books'}
            </span>
          </div>
          <div className="toolbar">
            <label className="search">
              <Search size={19} />
              <input
                placeholder="Search titles, authors, categories…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search books"
              />
            </label>
            <div className="sort">
              <SlidersHorizontal size={17} />
              <select
                aria-label="Sort books"
                value={sort}
                onChange={e => setSort(e.target.value)}
              >
                <option>Newest first</option>
                <option>Title A–Z</option>
                <option>Author A–Z</option>
              </select>
              <ChevronDown size={15} />
            </div>
          </div>
          {error && (
            <div className="alert inline" role="alert">
              {error}
              <button onClick={() => setError('')} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {loading && books.length === 0 ? (
            <div className="empty">
              <p>Loading your collection…</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <BookOpen size={30} />
              </div>
              <h3>
                {search || filter !== 'All books'
                  ? 'No books found'
                  : 'Your story starts here'}
              </h3>
              <p>
                {search || filter !== 'All books'
                  ? 'Try a different search or shelf.'
                  : 'Add your first book to begin building your collection.'}
              </p>
              {!search && filter === 'All books' && (
                <button className="primary" onClick={openAdd}>
                  <CirclePlus size={17} /> Add your first book
                </button>
              )}
            </div>
          ) : (
            <div className="grid">
              {visible.map(book => {
                const [dark, light] = palette(book.title);
                return (
                  <article className="book-card" key={book.id}>
                    <button
                      className="cover"
                      style={{
                        background: `linear-gradient(145deg, ${dark}, ${light})`,
                      }}
                      onClick={() => setSelected(book)}
                      aria-label={`View ${book.title}`}
                    >
                      <span className="cover-ornament">✦</span>
                      <span className="cover-title">{book.title}</span>
                      <span className="cover-line" />
                      <span className="cover-author">{book.author}</span>
                    </button>
                    <div className="card-info">
                      <div className="card-top">
                        <span
                          className={`badge ${book.status.toLowerCase().replace(' ', '-')}`}
                        >
                          {book.status}
                        </span>
                        <button
                          className="dots"
                          onClick={() => setSelected(book)}
                          aria-label={`Details for ${book.title}`}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                      <button
                        className="card-title"
                        onClick={() => setSelected(book)}
                      >
                        {book.title}
                      </button>
                      <p>{book.author}</p>
                      <div className="card-footer">
                        <span>{book.category || 'Uncategorized'}</span>
                        {book.filePath && (
                          <FileText size={15} aria-label="Ebook attached" />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {cursor && (
            <button
              className="load-more"
              disabled={loading}
              onClick={() => void load(cursor)}
            >
              {loading ? 'Loading…' : 'Load more books'}
            </button>
          )}
          <footer>
            Made for the books you can't forget. <span>✦</span>
          </footer>
        </div>
      </main>
      {menuOpen && (
        <button
          className="scrim mobile-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div
            className="detail panel"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Book details"
          >
            <button
              className="close icon-button"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X size={21} />
            </button>
            <div className="detail-head">
              <div
                className="detail-cover"
                style={{
                  background: `linear-gradient(145deg, ${palette(selected.title)[0]}, ${palette(selected.title)[1]})`,
                }}
              >
                <span>✦</span>
                <strong>{selected.title}</strong>
                <small>{selected.author}</small>
              </div>
              <div>
                <span className="eyebrow">BOOK DETAILS</span>
                <h2>{selected.title}</h2>
                <p>by {selected.author}</p>
                <span
                  className={`badge ${selected.status.toLowerCase().replace(' ', '-')}`}
                >
                  {selected.status}
                </span>
              </div>
            </div>
            <div className="detail-meta">
              <div>
                <span>CATEGORY</span>
                <strong>{selected.category || 'Uncategorized'}</strong>
              </div>
              <div>
                <span>ADDED</span>
                <strong>
                  {new Date(selected.addedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            </div>
            {selected.notes && (
              <div className="notes">
                <span>YOUR NOTES</span>
                <p>{selected.notes}</p>
              </div>
            )}
            <div className="file-area">
              <span>EBOOK FILE</span>
              {selected.filePath ? (
                <div className="file-row">
                  <FileText size={21} />
                  <span title={selected.fileName}>{selected.fileName}</span>
                  <button
                    onClick={() => void openFile(selected)}
                    aria-label="Open ebook"
                  >
                    <ArrowDownToLine size={18} />
                  </button>
                  <button
                    onClick={() => void removeFile(selected)}
                    aria-label="Remove ebook file"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ) : (
                <p>
                  No file attached yet. Edit this book to upload a PDF or EPUB.
                </p>
              )}
            </div>
            <div className="detail-actions">
              <button className="secondary" onClick={() => openEdit(selected)}>
                Edit book
              </button>
              <button className="danger" onClick={() => void remove(selected)}>
                <Trash2 size={16} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {modal && (
        <div className="overlay" onClick={() => !saving && setModal(false)}>
          <div
            className="form-panel panel"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Edit book' : 'Add a book'}
          >
            <button
              className="close icon-button"
              onClick={() => setModal(false)}
              disabled={saving}
              aria-label="Close"
            >
              <X size={21} />
            </button>
            <span className="eyebrow">YOUR COLLECTION</span>
            <h2>{editing ? 'Edit this book' : 'Add a new book'}</h2>
            <p className="form-intro">
              {editing
                ? 'Update the details on your shelf.'
                : 'Give this story a place on your shelf.'}
            </p>
            <form onSubmit={save}>
              <div className="field">
                <label htmlFor="title">
                  Book title <b>*</b>
                </label>
                <input
                  id="title"
                  autoFocus
                  value={form.title}
                  maxLength={160}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. The Midnight Library"
                />
              </div>
              <div className="field">
                <label htmlFor="author">
                  Author <b>*</b>
                </label>
                <input
                  id="author"
                  value={form.author}
                  maxLength={120}
                  onChange={e => setForm({ ...form, author: e.target.value })}
                  placeholder="e.g. Matt Haig"
                />
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="category">Category</label>
                  <input
                    id="category"
                    value={form.category}
                    maxLength={80}
                    onChange={e =>
                      setForm({ ...form, category: e.target.value })
                    }
                    placeholder="Fiction, History…"
                  />
                </div>
                <div className="field">
                  <label htmlFor="status">Reading status</label>
                  <select
                    id="status"
                    value={form.status}
                    onChange={e =>
                      setForm({ ...form, status: e.target.value as Status })
                    }
                  >
                    {filters.slice(1).map(item => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="notes">
                  Your notes <span>(optional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  maxLength={2000}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="A thought, a quote, or why you picked it up…"
                />
              </div>
              <div className="field">
                <label>
                  Ebook file <span>(optional, PDF or EPUB under 3 MB)</span>
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.epub,application/pdf,application/epub+zip"
                  hidden
                  onChange={e => chooseFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="upload-box"
                  onClick={() => fileRef.current?.click()}
                >
                  <CloudUpload size={22} />
                  <span>
                    {pendingFile
                      ? pendingFile.name
                      : editing?.fileName
                        ? `Replace ${editing.fileName}`
                        : 'Choose a file to attach'}
                  </span>
                </button>
              </div>
              {formError && (
                <div className="alert" role="alert">
                  {formError}
                </div>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving
                    ? 'Saving…'
                    : editing
                      ? 'Save changes'
                      : 'Add to library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
