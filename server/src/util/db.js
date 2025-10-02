import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "./config.js";

const dbPath = path.resolve(process.cwd(), config.DB_FILE);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);

db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT,
  tier TEXT,
  homepage_url TEXT,
  enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  dek_zh TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  section_hint TEXT,
  hash TEXT,
  UNIQUE(url)
);

CREATE TABLE IF NOT EXISTS translations (
  article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  title_en TEXT,
  dek_en TEXT,
  engine TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS classifications (
  article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  category TEXT,
  confidence REAL,
  method TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  run_started_at TEXT NOT NULL,
  run_completed_at TEXT,
  schedule_kind TEXT,
  timezone TEXT,
  total_articles INTEGER
);

CREATE TABLE IF NOT EXISTS scan_items (
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  category TEXT,
  rank_in_category INTEGER,
  salience_score REAL,
  is_duplicate INTEGER DEFAULT 0,
  cluster_id TEXT,
  PRIMARY KEY (scan_id, article_id)
);

CREATE TABLE IF NOT EXISTS summaries (
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  json_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (scan_id, category)
);
`);

const scanItemColumns = db.prepare("PRAGMA table_info(scan_items)").all();
if (!scanItemColumns.some(col => col.name === "salience_score")) {
  db.exec("ALTER TABLE scan_items ADD COLUMN salience_score REAL");
}
