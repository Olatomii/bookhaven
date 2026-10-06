import path from 'node:path';
import { createApp } from './app.mjs';
import { openDatabase } from './db.mjs';

const dataDir = path.resolve(process.env.DATA_DIR || './data');
const db = openDatabase(dataDir);
const app = createApp({ db, dataDir, serveClient: process.env.NODE_ENV === 'production' });
const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => console.log(`Bookhaven listening on port ${port}`));
