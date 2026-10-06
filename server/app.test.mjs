import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './app.mjs';
import { openDatabase } from './db.mjs';

async function fixture(t) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'bookhaven-test-'));
  const db = openDatabase(dataDir);
  const server = createApp({ db, dataDir }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  async function call(method, route, body, cookie, extraHeaders = {}) {
    const response = await fetch(base + route, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await response.arrayBuffer();
    let data;
    try { data = JSON.parse(Buffer.from(raw).toString()); } catch { data = Buffer.from(raw); }
    return { response, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  return { call, base, dataDir };
}

test('accounts have durable, isolated book collections', async t => {
  const { call, dataDir } = await fixture(t);
  const alice = await call('POST', '/api/register', { name: 'Alice', email: 'alice@example.com', password: 'correct-horse-42' });
  assert.equal(alice.response.status, 201);
  assert.match(alice.response.headers.get('set-cookie'), /HttpOnly/);
  const created = await call('POST', '/api/books', { title: 'Example Book', author: 'Test Writer', category: 'Fiction', status: 'To read' }, alice.cookie);
  assert.equal(created.response.status, 201);
  const id = created.data.id;
  const updated = await call('PUT', `/api/books/${id}`, { title: 'Example Book', author: 'Test Writer', status: 'Reading', notes: 'Chapter one' }, alice.cookie);
  assert.equal(updated.data.status, 'Reading');
  const page = await call('GET', '/api/books', null, alice.cookie);
  assert.equal(page.data.items.length, 1);
  assert.equal(page.data.items[0].notes, 'Chapter one');

  const bob = await call('POST', '/api/register', { name: 'Bob', email: 'bob@example.com', password: 'correct-horse-84' });
  assert.equal((await call('GET', '/api/books', null, bob.cookie)).data.items.length, 0);
  assert.equal((await call('PUT', `/api/books/${id}`, { title: 'Hijacked', author: 'Bob' }, bob.cookie)).response.status, 404);
  assert.equal((await call('DELETE', `/api/books/${id}`, null, bob.cookie)).response.status, 404);
  assert.equal((await call('GET', '/api/books')).response.status, 401);
  assert.equal((await call('POST', '/api/books', { title: 'Cross-site', author: 'Bad' }, alice.cookie, { Origin: 'https://other.example' })).response.status, 403);

  const reopened = openDatabase(dataDir);
  assert.equal(reopened.prepare('SELECT title FROM books WHERE id = ?').get(id).title, 'Example Book');
  reopened.close();
  assert.equal((await call('DELETE', `/api/books/${id}`, null, alice.cookie)).response.status, 200);
  assert.equal((await call('GET', '/api/books', null, alice.cookie)).data.items.length, 0);
  await call('POST', '/api/logout', null, alice.cookie);
  assert.equal((await call('GET', '/api/me', null, alice.cookie)).response.status, 401);
  const login = await call('POST', '/api/login', { email: 'alice@example.com', password: 'correct-horse-42' });
  assert.equal(login.response.status, 200);
});

test('uploaded ebooks are validated and downloaded only by their owner', async t => {
  const { call } = await fixture(t);
  const alice = await call('POST', '/api/register', { name: 'Alice', email: 'alice@example.com', password: 'correct-horse-42' });
  const bob = await call('POST', '/api/register', { name: 'Bob', email: 'bob@example.com', password: 'correct-horse-84' });
  const created = await call('POST', '/api/books', { title: 'Document', author: 'A Writer' }, alice.cookie);
  const route = `/api/books/${created.data.id}`;
  const invalid = await call('POST', `${route}/file`, { fileName: 'bad.pdf', fileType: 'application/pdf', base64: Buffer.from('not a PDF').toString('base64') }, alice.cookie);
  assert.equal(invalid.response.status, 400);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const uploaded = await call('POST', `${route}/file`, { fileName: 'sample.pdf', fileType: 'application/pdf', base64: pdf.toString('base64') }, alice.cookie);
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.data.fileName, 'sample.pdf');
  const link = await call('GET', `${route}/file`, null, alice.cookie);
  assert.equal(link.data.url, `${route}/download`);
  assert.equal((await call('GET', `${route}/download`, null, bob.cookie)).response.status, 404);
  assert.equal((await call('GET', `${route}/file`, null, bob.cookie)).response.status, 404);
  const download = await call('GET', `${route}/download`, null, alice.cookie);
  assert.equal(download.response.status, 200);
  assert.deepEqual(download.data, pdf);
  assert.match(download.response.headers.get('content-disposition'), /attachment/);
  assert.equal((await call('DELETE', `${route}/file`, null, alice.cookie)).response.status, 200);
  assert.equal((await call('GET', `${route}/download`, null, alice.cookie)).response.status, 404);
  assert.equal((await call('GET', '/api/books', null, alice.cookie)).data.items[0].filePath, undefined);
});
