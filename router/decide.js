// Mini-router: 3 reglas simples
// 1. crítica / imagen → modelo caro
// 2. simple / refactor → modelo barato
// 3. diseño → GLM 5.2

const TASK_TYPES = {
  'feature-critical': { maker: 'deepseek-v4-pro',  verifier: 'deepseek-v4-flash', judge: 'deepseek-v4-flash', reason: 'Crítica → Pro como Maker, Flash como Verifier' },
  'feature':          { maker: 'deepseek-v4-flash', verifier: 'deepseek-v4-flash', judge: 'deepseek-v4-flash', reason: 'Simple → Flash para todo' },
  'bugfix':           { maker: 'deepseek-v4-flash', verifier: 'deepseek-v4-pro',   judge: 'deepseek-v4-flash', reason: 'Bugfix → Flash escribe, Pro revisa' },
  'refactor':         { maker: 'deepseek-v4-flash', verifier: 'deepseek-v4-flash', judge: 'deepseek-v4-flash', reason: 'Refactor → Flash rápido' },
  'design':           { maker: 'glm-5v',            verifier: 'deepseek-v4-flash', judge: 'deepseek-v4-flash', reason: 'Diseño → GLM 5.2 (creativo), Flash sanity check' },
  'image':            { maker: 'gpt-4o',            verifier: 'deepseek-v4-flash', judge: 'deepseek-v4-flash', reason: 'Imagen → GPT-4o con visión, Flash verifica' }
};

function decide(task) {
  // task: { type, title, criticality?, description? }
  const taskType = task.type || 'feature';
  const criticality = task.criticality || 'low';

  // Regla 1: crítico o imagen → modelo caro
  if (criticality === 'high' || criticality === 'critical') {
    return {
      ...TASK_TYPES['feature-critical'],
      task_type: taskType,
      criticality
    };
  }

  // Regla 2: tipo conocido → su mapeo
  if (TASK_TYPES[taskType]) {
    return {
      ...TASK_TYPES[taskType],
      task_type: taskType,
      criticality
    };
  }

  // Regla 3: fallback
  return {
    ...TASK_TYPES['feature'],
    task_type: taskType,
    criticality
  };
}

function estimateJobCost(decision) {
  // Conservative estimate: ~2000 in, ~500 out per call
  const budget = require('./budget');
  const maker = budget.estimateCost(decision.maker, 2000, 500);
  const verifier = budget.estimateCost(decision.verifier, 1500, 300);
  const judge = budget.estimateCost(decision.judge, 1000, 100);
  return maker + verifier + judge;
}

module.exports = { decide, estimateJobCost, TASK_TYPES };
