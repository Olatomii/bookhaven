// The free hosted demo stores each reader's shelf in their own browser.
// The server-backed API remains available when VITE_DEMO is not set.
type Data = Record<string, unknown>;
type Book = {
  id: string; title: string; author: string; category: string;
  status: string; notes: string; addedAt: string;
  filePath?: string; fileName?: string; fileType?: string;
};
const KEY = 'bookhaven-demo-books-v1';
const DB = 'bookhaven-demo-files-v1';

function books(): Book[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Book[]; }
  catch { return []; }
}
function save(items: Book[]) { localStorage.setItem(KEY, JSON.stringify(items)); }
function fail(message: string): never { throw new Error(message); }
function fileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('files');
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(new Error('Browser file storage is unavailable.'));
  });
}
async function fileOperation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void): Promise<T> {
  const db = await fileDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('files', mode);
      transaction.onerror = () => reject(new Error('Could not access the saved file.'));
      action(transaction.objectStore('files'), resolve, reject);
    });
  } finally { db.close(); }
}
const putFile = (id: string, blob: Blob) => fileOperation<void>('readwrite', (store, resolve) => {
  const request = store.put(blob, id);
  request.onsuccess = () => resolve();
});
const getFile = (id: string) => fileOperation<Blob | undefined>('readonly', (store, resolve) => {
  const request = store.get(id);
  request.onsuccess = () => resolve(request.result as Blob | undefined);
});
const deleteFile = (id: string) => fileOperation<void>('readwrite', (store, resolve) => {
  const request = store.delete(id);
  request.onsuccess = () => resolve();
});
function fields(body?: Data) {
  const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const title = clean(body?.title, 160);
  const author = clean(body?.author, 120);
  if (!title || !author) fail('Title and author are required.');
  return { title, author, category: clean(body?.category, 80), status: ['To read', 'Reading', 'Finished'].includes(String(body?.status)) ? String(body?.status) : 'To read', notes: clean(body?.notes, 2000) };
}
function find(id: string) {
  return books().find(book => book.id === id) || fail('Book not found.');
}

export async function localRequest(method: string, path: string, body?: Data): Promise<{ data: any }> {
  if (path === '/api/books' && method === 'GET') {
    const items = books().sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    const start = body?.cursor ? Number(body.cursor) : 0;
    if (!Number.isSafeInteger(start) || start < 0) fail('Invalid page cursor.');
    return { data: { items: items.slice(start, start + 100), nextToken: items.length > start + 100 ? String(start + 100) : null } };
  }
  if (path === '/api/books' && method === 'POST') {
    const book = { id: crypto.randomUUID(), ...fields(body), addedAt: new Date().toISOString() };
    save([book, ...books()]);
    return { data: book };
  }
  const match = /^\/api\/books\/([0-9a-f-]{36})(?:\/(file))?$/.exec(path);
  if (!match) fail('Unknown request.');
  const id = match[1];
  const old = find(id);
  if (!match[2]) {
    if (method === 'PUT') {
      const book = { ...old, ...fields(body) };
      save(books().map(item => item.id === id ? book : item));
      return { data: book };
    }
    if (method === 'DELETE') {
      save(books().filter(item => item.id !== id));
      await deleteFile(id);
      return { data: { deleted: true } };
    }
  } else {
    if (method === 'POST') {
      const name = String(body?.fileName || '').slice(0, 180);
      const type = body?.fileType;
      const encoded = body?.base64;
      const extension = type === 'application/pdf' && name.toLowerCase().endsWith('.pdf') ? 'pdf' : type === 'application/epub+zip' && name.toLowerCase().endsWith('.epub') ? 'epub' : null;
      if (!extension || typeof encoded !== 'string' || encoded.length > 4_100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail('Choose a PDF or EPUB under 3 MB.');
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const valid = extension === 'pdf' ? String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-' : bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
      if (!valid || bytes.length > 3_000_000) fail('This file is not a valid PDF or EPUB under 3 MB.');
      await putFile(id, new Blob([bytes], { type: String(type) }));
      const book = { ...old, filePath: id, fileName: name, fileType: String(type) };
      save(books().map(item => item.id === id ? book : item));
      return { data: book };
    }
    if (method === 'GET') {
      const blob = await getFile(id);
      if (!blob) fail('File not found.');
      return { data: { url: URL.createObjectURL(blob), fileName: old.fileName } };
    }
    if (method === 'DELETE') {
      await deleteFile(id);
      const book = { ...old, filePath: undefined, fileName: undefined, fileType: undefined };
      save(books().map(item => item.id === id ? book : item));
      return { data: book };
    }
  }
  fail('Unknown request.');
}
