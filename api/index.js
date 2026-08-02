const generateHandler = require('../src/generate');
const feedbackHandler = require('../src/feedback');
const startSessionHandler = require('../src/v1/chat/session/start');
const chatMessageHandler = require('../src/v1/chat/message');
const chatHistoryHandler = require('../src/v1/chat/history/[sessionId]');
const chatStatusHandler = require('../src/v1/chat/status/[sessionId]');
const transferHandler = require('../src/v1/chat/transfer-to-human');
const resolveHandler = require('../src/v1/chat/resolve');
const agentQueueHandler = require('../src/v1/agent/queue');
const claimTicketHandler = require('../src/v1/agent/claim-ticket');
const agentMessageHandler = require('../src/v1/agent/message');

module.exports = async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Helper response polyfills
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

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = url.pathname;

    // Normalize trailing slashes
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Parse query params into req.query
    req.query = req.query || {};
    url.searchParams.forEach((val, key) => {
      req.query[key] = val;
    });

    // Health check endpoint
    if (pathname === '/' || pathname === '/api' || pathname === '/api/index') {
      return res.status(200).json({
        status: 'online',
        message: 'Zeu Chatbot API Backend is running!',
        endpoints: [
          'POST /api/generate',
          'POST /api/feedback',
          'POST /api/v1/chat/session/start',
          'POST /api/v1/chat/message',
          'GET /api/v1/chat/history/:sessionId',
          'GET /api/v1/chat/status/:sessionId',
          'POST /api/v1/chat/transfer-to-human',
          'GET /api/v1/agent/queue',
          'POST /api/v1/agent/claim-ticket',
          'POST /api/v1/agent/message',
          'POST /api/v1/chat/resolve'
        ]
      });
    }

    // Route dispatch
    if (pathname === '/api/generate') {
      return await generateHandler(req, res);
    }
    if (pathname === '/api/feedback') {
      return await feedbackHandler(req, res);
    }
    if (pathname === '/api/v1/chat/session/start') {
      return await startSessionHandler(req, res);
    }
    if (pathname === '/api/v1/chat/message') {
      return await chatMessageHandler(req, res);
    }
    if (pathname.startsWith('/api/v1/chat/history/')) {
      const sessionId = pathname.replace('/api/v1/chat/history/', '');
      req.query.sessionId = sessionId;
      return await chatHistoryHandler(req, res);
    }
    if (pathname.startsWith('/api/v1/chat/status/')) {
      const sessionId = pathname.replace('/api/v1/chat/status/', '');
      req.query.sessionId = sessionId;
      return await chatStatusHandler(req, res);
    }
    if (pathname === '/api/v1/chat/transfer-to-human') {
      return await transferHandler(req, res);
    }
    if (pathname === '/api/v1/chat/resolve') {
      return await resolveHandler(req, res);
    }
    if (pathname === '/api/v1/agent/queue') {
      return await agentQueueHandler(req, res);
    }
    if (pathname === '/api/v1/agent/claim-ticket') {
      return await claimTicketHandler(req, res);
    }
    if (pathname === '/api/v1/agent/message') {
      return await agentMessageHandler(req, res);
    }

    return res.status(404).json({ error: `Endpoint ${req.method} ${pathname} Not Found` });

  } catch (err) {
    console.error('Vercel Serverless Handler Error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};
