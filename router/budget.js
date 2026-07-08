// Price estimates per model (€ / 1M tokens)
// Source: current DeepSeek/OpenRouter/Anthropic pricing
const rates = {
  'deepseek-chat':     { in: 0.07,  out: 0.21  },
  'deepseek-reasoner': { in: 0.55,  out: 2.19  },
  'gpt-4o':            { in: 2.50,  out: 10.00 },
  'gpt-4o-mini':       { in: 0.15,  out: 0.60  },
  'claude-sonnet-4':   { in: 3.00,  out: 15.00 },
  'glm-5v':            { in: 0.10,  out: 0.10  },
  'deepseek-v4-flash':  { in: 0.07,  out: 0.21  },
  'deepseek-v4-pro':    { in: 0.55,  out: 2.19  }
};

const DAILY_CAP = parseFloat(process.env.CTXHUB_DAILY_CAP || '5.0');
const JOB_CAP = parseFloat(process.env.CTXHUB_JOB_CAP || '0.50');

function estimateCost(model, tokensIn, tokensOut) {
  const r = rates[model];
  if (!r) return 0;
  return ((tokensIn / 1_000_000) * r.in) + ((tokensOut / 1_000_000) * r.out);
}

function checkDailyCap(db, estimate) {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(
    "SELECT COALESCE(SUM(cost_eur), 0) as spent FROM llm_calls WHERE created_at LIKE ?"
  ).get(`${today}%`);
  return (row.spent + estimate) < DAILY_CAP;
}

function checkJobCap(spentSoFar, estimate) {
  return (spentSoFar + estimate) < JOB_CAP;
}

function getStats(db) {
  const today = new Date().toISOString().slice(0, 10);
  const daily = db.prepare(
    "SELECT COALESCE(SUM(cost_eur), 0) as spent FROM llm_calls WHERE created_at LIKE ?"
  ).get(`${today}%`);
  const total = db.prepare("SELECT COALESCE(SUM(cost_eur), 0) as total FROM llm_calls").get();
  return {
    spent_today_eur: Math.round(daily.spent * 100) / 100,
    total_eur: Math.round(total.total * 100) / 100,
    daily_cap_eur: DAILY_CAP,
    job_cap_eur: JOB_CAP
  };
}

module.exports = { rates, estimateCost, checkDailyCap, checkJobCap, getStats, DAILY_CAP };
