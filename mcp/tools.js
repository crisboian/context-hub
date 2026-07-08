// Hermes MCP tool descriptors
// These define the MCP tools Hermes uses to talk to Context Hub
// Imported by Hermes MCP server

const tools = [
  {
    name: 'context_write',
    description: 'Write an entry to Context Hub. Types: decision (title+problem+decision), task (name+priority), state (agent+status), note (content)',
    inputSchema: {
      type: 'object',
      required: ['type', 'body'],
      properties: {
        type: { type: 'string', enum: ['decision', 'task', 'state', 'note'] },
        body: { type: 'object' },
        provenance: { type: 'string' }
      }
    }
  },
  {
    name: 'context_read',
    description: 'Read a context entry by ID',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' }
      }
    }
  },
  {
    name: 'context_search',
    description: 'Search context entries by type, active status, and text query',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['decision', 'task', 'state', 'note'] },
        active: { type: 'boolean' },
        q: { type: 'string' }
      }
    }
  },
  {
    name: 'context_budget',
    description: 'Get current spending budget stats',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'router_decide',
    description: 'Evaluate a task and return model routing. SHADOW MODE by default — records decision but does not execute. Pass execute=true to override.',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        task: {
          type: 'object',
          required: ['title', 'type'],
          properties: {
            title: { type: 'string' },
            type: { type: 'string', enum: ['feature-critical', 'feature', 'bugfix', 'refactor', 'design', 'image', 'other'] },
            criticality: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            description: { type: 'string' }
          }
        },
        execute: { type: 'boolean' }
      }
    }
  },
  {
    name: 'router_enqueue',
    description: 'Enqueue a task for execution. Auto-selects maker/verifier based on task type. Shadow mode — recorded but not executed.',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        task: {
          type: 'object',
          required: ['title', 'type'],
          properties: {
            title: { type: 'string' },
            type: { type: 'string', enum: ['feature-critical', 'feature', 'bugfix', 'refactor', 'design', 'image', 'other'] },
            criticality: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            description: { type: 'string' }
          }
        }
      }
    }
  },
  {
    name: 'router_jobs',
    description: 'List recent jobs or check status of a specific job by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        status: { type: 'string', enum: ['pending', 'making', 'gating', 'verifying', 'done', 'failed', 'escalated', 'needs_human'] }
      }
    }
  }
];

module.exports = { tools };
