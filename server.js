require('dotenv').config();
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');
const { authMiddleware } = require('./api/auth');
const setupRoutes = require('./api/routes');

// Use token from env or file
if (!config.token) {
  try {
    const fs = require('fs');
    config.token = fs.readFileSync(path.join(__dirname, '.token'), 'utf8').trim();
  } catch (e) {
    console.error('FATAL: No CTXHUB_TOKEN in env and no .token file');
    process.exit(1);
  }
}

// Initialize DB
const db = new Database(config.db.path, { /* WAL default in better-sqlite3 */ });
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('decision','task','state','note')),
    body TEXT NOT NULL,
    provenance TEXT NOT NULL DEFAULT 'agent:hermes',
    created_at TEXT DEFAULT (datetime('now')),
    active INTEGER DEFAULT 1,
    superseded_by INTEGER REFERENCES entries(id)
  );

  CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
  CREATE INDEX IF NOT EXISTS idx_entries_active ON entries(active);
`);

// Jobs table (for router phase 2)
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending','making','gating','verifying','done','failed','escalated','needs_human')),
    priority INTEGER DEFAULT 5,
    rounds INTEGER DEFAULT 0,
    max_rounds INTEGER DEFAULT 3,
    assigned_maker TEXT,
    assigned_verifier TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// LLM calls log
db.exec(`
  CREATE TABLE IF NOT EXISTS llm_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER REFERENCES jobs(id),
    role TEXT CHECK(role IN ('maker','verifier','judge','router')),
    model TEXT NOT NULL,
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_eur REAL,
    latency_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const app = express();
app.use(express.json({ limit: '1mb' }));

// Health endpoint (no auth)
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      entries: db.prepare('SELECT COUNT(*) as count FROM entries').get().count
    });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Auth required for everything else
app.use(authMiddleware);

// Routes
setupRoutes(app, db);

// Start
app.listen(config.port, '0.0.0.0', () => {
  console.log(`Context Hub running on 0.0.0.0:${config.port}`);
  console.log(`Token: ${config.token.slice(0, 8)}...`);
});
