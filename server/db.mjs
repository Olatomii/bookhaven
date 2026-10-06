import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'bookhaven.sqlite'));
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'To read',
      notes TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL,
      file_path TEXT,
      file_name TEXT,
      file_type TEXT
    );
    CREATE INDEX IF NOT EXISTS books_owner_order ON books(user_id, added_at DESC, id DESC);
  `);
  return db;
}

export function bookFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    category: row.category,
    status: row.status,
    notes: row.notes,
    addedAt: row.added_at,
    ...(row.file_path ? { filePath: row.file_path, fileName: row.file_name, fileType: row.file_type } : {}),
  };
}
