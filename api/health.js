module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.statusCode = 200;
  res.end(JSON.stringify({
    status: 'online',
    node: process.version,
    env_keys: Object.keys(process.env).filter(k => k.startsWith('GEMINI') || k.startsWith('VERCEL') || k === 'NODE_ENV'),
    timestamp: new Date().toISOString()
  }));
};
