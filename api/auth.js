const config = require('../config');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  if (token !== config.token) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
}

module.exports = { authMiddleware };
