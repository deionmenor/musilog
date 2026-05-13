import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'musilog.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS listen_later (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    provider    TEXT    NOT NULL DEFAULT 'lastfm',
    user_id     TEXT    NOT NULL,
    artist      TEXT    NOT NULL,
    album       TEXT    NOT NULL,
    added_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, user_id, artist, album)
  )
`);

export default db;
