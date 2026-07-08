const express = require('express');
const { decide, estimateJobCost } = require('./decide');
const budget = require('./budget');

module.exports = function setupRouterRoutes(app, db) {
  const router = express.Router();

  // POST /router/decide — evaluate a task, return model routing
  app.post('/router/decide', (req, res) => {
    const { task } = req.body;
    if (!task || !task.title || !task.type) {
      return res.status(400).json({ error: 'task with title and type required' });
    }

    // 1. Decide routing
    const routing = decide(task);
    const estimate = estimateJobCost(routing);

    // 2. Check budget
    const withinDaily = budget.checkDailyCap(db, estimate);
    const withinJob = budget.checkJobCap(0, estimate);

    // 3. Record decision (shadow mode by default)
    const shadow = req.body.execute !== true;
    const result = db.prepare(
      `INSERT INTO router_decisions (task_body, decision, estimate_eur, shadow)
       VALUES (?, ?, ?, ?)`
    ).run(JSON.stringify(task), JSON.stringify(routing), estimate, shadow ? 1 : 0);

    res.json({
      decision_id: result.lastInsertRowid,
      routing,
      estimate_eur: Math.round(estimate * 1000) / 1000,
      within_daily_budget: withinDaily,
      within_job_budget: withinJob,
      shadow,
      note: shadow ? 'SHADOW MODE — decisión registrada, no ejecutada' : undefined
    });
  });

  // POST /jobs — enqueue a task for execution
  app.post('/jobs', (req, res) => {
    const { task } = req.body;
    if (!task || !task.title || !task.type) {
      return res.status(400).json({ error: 'task with title and type required' });
    }

    // Auto-decide routing
    const routing = decide(task);
    const estimate = estimateJobCost(routing);
    const withinDaily = budget.checkDailyCap(db, estimate);

    if (!withinDaily) {
      return res.status(429).json({ error: 'Daily budget exceeded', budget: budget.getStats(db) });
    }

    const result = db.prepare(
      `INSERT INTO jobs (task, status, priority, assigned_maker, assigned_verifier)
       VALUES (?, 'pending', ?, ?, ?)`
    ).run(JSON.stringify(task), task.criticality === 'high' || task.criticality === 'critical' ? 8 : 5,
           routing.maker, routing.verifier);

    // Also record router decision
    db.prepare(
      `INSERT INTO router_decisions (job_id, task_body, decision, estimate_eur, shadow)
       VALUES (?, ?, ?, ?, 1)`
    ).run(result.lastInsertRowid, JSON.stringify(task), JSON.stringify(routing), estimate);

    res.status(201).json({
      job_id: result.lastInsertRowid,
      routing,
      estimate_eur: Math.round(estimate * 1000) / 1000,
      status: 'pending',
      note: 'SHADOW MODE — no se ejecutará automáticamente'
    });
  });

  // GET /jobs/:id — check job status
  app.get('/jobs/:id', (req, res) => {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    job.task = JSON.parse(job.task);
    const decisions = db.prepare(
      'SELECT * FROM router_decisions WHERE job_id = ? ORDER BY id DESC'
    ).all(req.params.id);
    job.decisions = decisions;
    res.json(job);
  });

  // GET /jobs — list recent jobs
  app.get('/jobs', (req, res) => {
    const { status, limit } = req.query;
    let sql = 'SELECT * FROM jobs';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(Math.min(parseInt(limit) || 20, 50));
    const jobs = db.prepare(sql).all(...params);
    jobs.forEach(j => { j.task = JSON.parse(j.task); });
    res.json(jobs);
  });

  // GET /router/decisions — recent router decisions
  app.get('/router/decisions', (req, res) => {
    const decisions = db.prepare(
      'SELECT * FROM router_decisions ORDER BY id DESC LIMIT 20'
    ).all();
    decisions.forEach(d => {
      d.task_body = JSON.parse(d.task_body);
      d.decision = JSON.parse(d.decision);
    });
    res.json(decisions);
  });
};
