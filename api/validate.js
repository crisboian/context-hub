const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const ajv = new Ajv({ allErrors: true });
const validators = {};

// Load all schemas
const schemaDir = path.join(__dirname, '..', 'schemas');
for (const file of fs.readdirSync(schemaDir)) {
  if (!file.endsWith('.schema.json')) continue;
  const type = file.replace('.schema.json', '');
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8'));
  validators[type] = ajv.compile(schema);
}

function validate(type, body) {
  const validator = validators[type];
  if (!validator) {
    return { valid: false, errors: `Unknown type: ${type}. Valid: ${Object.keys(validators).join(', ')}` };
  }
  const valid = validator(body);
  if (!valid) {
    return { valid: false, errors: validator.errors.map(e => `${e.instancePath} ${e.message}`) };
  }
  return { valid: true, errors: null };
}

module.exports = { validate, validTypes: Object.keys(validators) };
