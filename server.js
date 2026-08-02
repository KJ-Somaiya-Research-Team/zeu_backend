try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed — try native loadEnvFile (Node 22+)
  try { process.loadEnvFile(); } catch (_) { /* .env missing or old Node */ }
}

const http = require('http');
const indexHandler = require('./api/index');
const generateHandler = require('./api/generate');
const feedbackHandler = require('./api/feedback');

// Import v1 handlers
const startSessionHandler = require('./api/v1/chat/session/start');
const chatMessageHandler = require('./api/v1/chat/message');
const chatHistoryHandler = require('./api/v1/chat/history/[sessionId]');
const chatStatusHandler = require('./api/v1/chat/status/[sessionId]');
const transferHandler = require('./api/v1/chat/transfer-to-human');
const resolveHandler = require('./api/v1/chat/resolve');
const agentQueueHandler = require('./api/v1/agent/queue');
const claimTicketHandler = require('./api/v1/agent/claim-ticket');
const agentMessageHandler = require('./api/v1/agent/message');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Polyfill res.status and res.json for Vercel handler compatibility
  if (!res.status) {
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function (data) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
      return this;
    };
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);
  const pathname = url.pathname;

  // Parse query params
  req.query = req.query || {};
  url.searchParams.forEach((val, key) => { req.query[key] = val; });

  // Helper to parse JSON body for POST/PUT requests
  const runWithJsonBody = (handler) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => {
        try { req.body = body ? JSON.parse(body) : {}; }
        catch (e) { req.body = {}; }
        handler(req, res);
      });
    } else {
      handler(req, res);
    }
  };

  // Route dispatch
  if (pathname === '/api/generate') {
    runWithJsonBody(generateHandler);
  } else if (pathname === '/api/feedback') {
    feedbackHandler(req, res);
  } else if (pathname === '/api/v1/chat/session/start') {
    runWithJsonBody(startSessionHandler);
  } else if (pathname === '/api/v1/chat/message') {
    runWithJsonBody(chatMessageHandler);
  } else if (pathname.startsWith('/api/v1/chat/history/')) {
    req.query.sessionId = pathname.replace('/api/v1/chat/history/', '').split('?')[0];
    runWithJsonBody(chatHistoryHandler);
  } else if (pathname.startsWith('/api/v1/chat/status/')) {
    req.query.sessionId = pathname.replace('/api/v1/chat/status/', '').split('?')[0];
    runWithJsonBody(chatStatusHandler);
  } else if (pathname === '/api/v1/chat/transfer-to-human') {
    runWithJsonBody(transferHandler);
  } else if (pathname === '/api/v1/chat/resolve') {
    runWithJsonBody(resolveHandler);
  } else if (pathname === '/api/v1/agent/queue') {
    agentQueueHandler(req, res);
  } else if (pathname === '/api/v1/agent/claim-ticket') {
    runWithJsonBody(claimTicketHandler);
  } else if (pathname === '/api/v1/agent/message') {
    runWithJsonBody(agentMessageHandler);
  } else if (pathname === '/' || pathname === '/api' || pathname === '/api/index') {
    indexHandler(req, res);
  } else {
    res.status(404).json({ error: 'Endpoint Not Found' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Zeu Backend running at http://localhost:${PORT}`);
  console.log(`📍 Health: GET http://localhost:${PORT}/api`);
  console.log(`📍 ${Object.keys(require('./api/v1/_utils/store').sessions).length} active sessions`);
});
