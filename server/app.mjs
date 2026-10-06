import express from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bookFromRow } from './db.mjs';
import { cookieToken, hashPassword, newSessionToken, tokenHash, verifyPassword } from './security.mjs';

const SESSION_AGE = 30 * 24 * 60 * 60 * 1000;
const statuses = new Set(['To read', 'Reading', 'Finished']);
const clamp = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const validUuid = value => /^[0-9a-f-]{36}$/i.test(value);
const failure = (res, status, message) => res.status(status).json({ error: message });
const safeName = value => value.replace(/[^a-zA-Z0-9. _-]/g, '_').slice(0, 180);

function bookFields(body) {
  return {
    title: clamp(body?.title, 160),
    author: clamp(body?.author, 120),
    category: clamp(body?.category, 80),
    status: statuses.has(body?.status) ? body.status : 'To read',
    notes: clamp(body?.notes, 2000),
  };
}

function decodeCursor(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const [date, id] = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof date === 'string' && validUuid(id) && !Number.isNaN(Date.parse(date))) return [date, id];
  } catch { /* invalid cursor */ }
  return null;
}

export function createApp({ db, dataDir, serveClient = false }) {
  const app = express();
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      const expected = `${req.protocol}://${req.get('host')}`;
      if ((origin && origin !== expected) || req.get('sec-fetch-site') === 'cross-site') return failure(res, 403, 'Cross-site request blocked.');
    }
    next();
  });
  app.use(express.json({ limit: '4.5mb' }));

  const uploads = path.resolve(dataDir, 'uploads');
  const loginAttempts = new Map();
  const loginLimit = (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const current = loginAttempts.get(key);
    const attempt = current && current.until > now ? current : { count: 0, until: now + 15 * 60 * 1000 };
    attempt.count += 1;
    loginAttempts.set(key, attempt);
    if (attempt.count > 12) return failure(res, 429, 'Too many attempts. Try again later.');
    next();
  };
  function setSession(req, res, userId) {
    const token = newSessionToken();
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), userId, Date.now() + SESSION_AGE);
    res.cookie('bookhaven_session', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/', maxAge: SESSION_AGE });
  }
  function currentUser(req) {
    const token = cookieToken(req.get('cookie'));
    if (!token) return null;
    return db.prepare(`SELECT users.id, users.email, users.name FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?`).get(tokenHash(token), Date.now()) || null;
  }
  function requireUser(req, res, next) {
    const user = currentUser(req);
    if (!user) return failure(res, 401, 'Please sign in.');
    req.account = user;
    next();
  }
  const ownedBook = (req) => db.prepare('SELECT * FROM books WHERE id = ? AND user_id = ?').get(req.params.id, req.account.id);
  const bookOr404 = (req, res) => {
    const row = ownedBook(req);
    if (!row) failure(res, 404, 'Book not found.');
    return row;
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/register', loginLimit, async (req, res) => {
    const email = clamp(req.body?.email, 254).toLowerCase();
    const name = clamp(req.body?.name, 80);
    const password = req.body?.password;
    if (!isEmail(email) || !name || typeof password !== 'string' || password.length < 8 || password.length > 128) return failure(res, 400, 'Enter a name, valid email, and password of 8–128 characters.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return failure(res, 409, 'This email is already registered.');
    const user = { id: randomUUID(), email, name };
    db.prepare('INSERT INTO users(id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(user.id, email, name, await hashPassword(password), new Date().toISOString());
    setSession(req, res, user.id);
    return res.status(201).json({ user });
  });
  app.post('/api/login', loginLimit, async (req, res) => {
    const email = clamp(req.body?.email, 254).toLowerCase();
    const password = req.body?.password;
    if (!isEmail(email) || typeof password !== 'string' || password.length > 128) return failure(res, 401, 'Invalid email or password.');
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !(await verifyPassword(password, row.password_hash))) return failure(res, 401, 'Invalid email or password.');
    setSession(req, res, row.id);
    return res.json({ user: { id: row.id, name: row.name, email: row.email } });
  });
  app.post('/api/logout', (req, res) => {
    const token = cookieToken(req.get('cookie'));
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
    res.clearCookie('bookhaven_session', { path: '/', sameSite: 'lax', secure: req.secure });
    res.json({ signedOut: true });
  });
  app.get('/api/me', requireUser, (req, res) => res.json({ user: req.account }));

  app.get('/api/books', requireUser, (req, res) => {
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) return failure(res, 400, 'Invalid page cursor.');
    const rows = cursor
      ? db.prepare('SELECT * FROM books WHERE user_id = ? AND (added_at < ? OR (added_at = ? AND id < ?)) ORDER BY added_at DESC, id DESC LIMIT 101').all(req.account.id, cursor[0], cursor[0], cursor[1])
      : db.prepare('SELECT * FROM books WHERE user_id = ? ORDER BY added_at DESC, id DESC LIMIT 101').all(req.account.id);
    const page = rows.slice(0, 100);
    const last = page.at(-1);
    const nextToken = rows.length > 100 ? Buffer.from(JSON.stringify([last.added_at, last.id])).toString('base64url') : null;
    res.json({ items: page.map(bookFromRow), nextToken });
  });
  app.post('/api/books', requireUser, (req, res) => {
    const book = bookFields(req.body);
    if (!book.title || !book.author) return failure(res, 400, 'Title and author are required.');
    const id = randomUUID();
    const addedAt = new Date().toISOString();
    db.prepare('INSERT INTO books(id, user_id, title, author, category, status, notes, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.account.id, book.title, book.author, book.category, book.status, book.notes, addedAt);
    res.status(201).json({ id, ...book, addedAt });
  });
  app.put('/api/books/:id', requireUser, (req, res) => {
    const old = bookOr404(req, res);
    if (!old) return;
    const book = bookFields(req.body);
    if (!book.title || !book.author) return failure(res, 400, 'Title and author are required.');
    db.prepare('UPDATE books SET title = ?, author = ?, category = ?, status = ?, notes = ? WHERE id = ? AND user_id = ?').run(book.title, book.author, book.category, book.status, book.notes, old.id, req.account.id);
    res.json(bookFromRow({ ...old, ...book }));
  });
  app.delete('/api/books/:id', requireUser, async (req, res) => {
    const old = bookOr404(req, res);
    if (!old) return;
    db.prepare('DELETE FROM books WHERE id = ? AND user_id = ?').run(old.id, req.account.id);
    if (old.file_path) await unlink(path.join(uploads, old.file_path)).catch(() => {});
    res.json({ deleted: true });
  });
  app.post('/api/books/:id/file', requireUser, async (req, res) => {
    const old = bookOr404(req, res);
    if (!old) return;
    const fileName = safeName(clamp(req.body?.fileName, 180));
    const fileType = req.body?.fileType;
    const base64 = req.body?.base64;
    const extension = fileType === 'application/pdf' && fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : fileType === 'application/epub+zip' && fileName.toLowerCase().endsWith('.epub') ? 'epub' : null;
    if (!extension || typeof base64 !== 'string' || base64.length > 4_100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return failure(res, 400, 'Choose a PDF or EPUB under 3 MB.');
    const bytes = Buffer.from(base64, 'base64');
    const signature = extension === 'pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    if (!signature || bytes.length > 3_000_000) return failure(res, 400, 'This file is not a valid PDF or EPUB under 3 MB.');
    const relative = path.join(req.account.id, `${randomUUID()}.${extension}`);
    const absolute = path.join(uploads, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes, { flag: 'wx', mode: 0o600 });
    try {
      db.prepare('UPDATE books SET file_path = ?, file_name = ?, file_type = ? WHERE id = ? AND user_id = ?').run(relative, fileName, fileType, old.id, req.account.id);
    } catch (err) { await unlink(absolute).catch(() => {}); throw err; }
    if (old.file_path) await unlink(path.join(uploads, old.file_path)).catch(() => {});
    res.json(bookFromRow({ ...old, file_path: relative, file_name: fileName, file_type: fileType }));
  });
  app.get('/api/books/:id/file', requireUser, (req, res) => {
    const row = bookOr404(req, res);
    if (!row) return;
    if (!row.file_path) return failure(res, 404, 'File not found.');
    res.json({ url: `/api/books/${row.id}/download` });
  });
  app.get('/api/books/:id/download', requireUser, (req, res, next) => {
    const row = bookOr404(req, res);
    if (!row) return;
    if (!row.file_path) return failure(res, 404, 'File not found.');
    res.download(path.join(uploads, row.file_path), row.file_name, err => { if (err && !res.headersSent) next(err); });
  });
  app.delete('/api/books/:id/file', requireUser, async (req, res) => {
    const row = bookOr404(req, res);
    if (!row) return;
    if (!row.file_path) return failure(res, 404, 'File not found.');
    db.prepare('UPDATE books SET file_path = NULL, file_name = NULL, file_type = NULL WHERE id = ? AND user_id = ?').run(row.id, req.account.id);
    await unlink(path.join(uploads, row.file_path)).catch(() => {});
    res.json(bookFromRow({ ...row, file_path: null, file_name: null, file_type: null }));
  });

  if (serveClient) {
    const dist = path.resolve('client/dist');
    app.use(express.static(dist, { index: false }));
    app.get('/{*path}', async (_req, res) => {
      const html = await readFile(path.join(dist, 'index.html'), 'utf8');
      res.type('html').send(html);
    });
  }
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    if (err?.type === 'entity.too.large') return failure(res, 413, 'File or request is too large.');
    console.error(err);
    failure(res, 500, 'Something went wrong. Please try again.');
  });
  return app;
}
