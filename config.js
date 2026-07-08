module.exports = {
  port: parseInt(process.env.CTXHUB_PORT || '8720', 10),
  token: process.env.CTXHUB_TOKEN,
  db: {
    path: process.env.CTXHUB_DB || __dirname + '/data/context.db'
  }
};
