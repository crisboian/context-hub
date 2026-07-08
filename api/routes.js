const { validate, validTypes } = require('./validate');

module.exports = function setupRoutes(app, db) {
  // Health
  app.get('/health', (req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        entries: db.prepare('SELECT COUNT(*) as count FROM entries').get().count,
        types: validTypes
      });
    } catch (e) {
      res.status(500).json({ status: 'error', error: e.message });
    }
  });

  // Create context entry
  app.post('/context', (req, res) => {
    const { type, body, provenance } = req.body;
    if (!type || !body) {
      return res.status(400).json({ error: 'type and body are required' });
    }
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Valid: ${validTypes.join(', ')}` });
    }

    const validation = validate(type, body);
    if (!validation.valid) {
      return res.status(422).json({ error: 'Validation failed', details: validation.errors });
    }

    const prov = provenance || 'agent:hermes';
    const result = db.prepare(
      'INSERT INTO entries (type, body, provenance) VALUES (?, ?, ?)'
    ).run(type, JSON.stringify(body), prov);

    res.status(201).json({
      id: result.lastInsertRowid,
      type,
      provenance: prov,
      created_at: new Date().toISOString()
    });
  });

  // Read entry
  app.get('/context/:id', (req, res) => {
    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    entry.body = JSON.parse(entry.body);
    res.json(entry);
  });

  // Search entries
  app.get('/context', (req, res) => {
    const { type, active, q } = req.query;
    let sql = 'SELECT * FROM entries WHERE 1=1';
    const params = [];

    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0); }
    if (q) {
      // FTS on body JSON
      sql += ' AND body LIKE ?';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY id DESC LIMIT 50';

    const entries = db.prepare(sql).all(...params);
    entries.forEach(e => { e.body = JSON.parse(e.body); });
    res.json(entries);
  });

  // Deactivate entry (append-only - no DELETE)
  app.put('/context/:id/deactivate', (req, res) => {
    const result = db.prepare('UPDATE entries SET active = 0 WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ status: 'deactivated', id: parseInt(req.params.id) });
  });

  // Get budget stats
  app.get('/budget', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const daily = db.prepare(
      "SELECT COALESCE(SUM(cost_eur), 0) as spent FROM llm_calls WHERE created_at LIKE ?"
    ).get(`${today}%`);
    const total = db.prepare("SELECT COALESCE(SUM(cost_eur), 0) as total FROM llm_calls").get();
    const calls_today = db.prepare(
      "SELECT COUNT(*) as count FROM llm_calls WHERE created_at LIKE ?"
    ).get(`${today}%`);
    res.json({
      today: today,
      spent_today_eur: daily.spent,
      total_eur: total.total,
      calls_today: calls_today.count
    });
  });
};
