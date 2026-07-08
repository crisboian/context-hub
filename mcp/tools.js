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
  }
];

module.exports = { tools };
