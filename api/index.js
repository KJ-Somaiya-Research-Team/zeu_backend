const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS
app.use(cors({
  origin: '*',
  methods: 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  allowedHeaders: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
}));

// Parse JSON bodies
app.use(express.json());

// Import handlers from src/
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

// Helper to adapt Vercel Serverless Function signature (req, res) to Express route
const wrapHandler = (handler) => (req, res, next) => {
  // Mock Vercel query parsing for dynamic routes if needed
  Promise.resolve(handler(req, res)).catch(next);
};

// V0 / Legacy Routes
app.post('/api/generate', wrapHandler(generateHandler));
app.post('/api/feedback', wrapHandler(feedbackHandler));

// V1 Chat Routes
app.post('/api/v1/chat/session/start', wrapHandler(startSessionHandler));
app.post('/api/v1/chat/message', wrapHandler(chatMessageHandler));
app.post('/api/v1/chat/transfer-to-human', wrapHandler(transferHandler));
app.post('/api/v1/chat/resolve', wrapHandler(resolveHandler));

// V1 Agent Routes
app.get('/api/v1/agent/queue', wrapHandler(agentQueueHandler));
app.post('/api/v1/agent/claim-ticket', wrapHandler(claimTicketHandler));
app.post('/api/v1/agent/message', wrapHandler(agentMessageHandler));

// V1 Dynamic Routes
app.get('/api/v1/chat/history/:sessionId', (req, res, next) => {
  // Pass Express params to req.query for Vercel handler compatibility
  req.query.sessionId = req.params.sessionId;
  wrapHandler(chatHistoryHandler)(req, res, next);
});

app.get('/api/v1/chat/status/:sessionId', (req, res, next) => {
  req.query.sessionId = req.params.sessionId;
  wrapHandler(chatStatusHandler)(req, res, next);
});

// Root / Health check
const healthCheck = (req, res) => {
  res.status(200).json({
    status: 'online',
    architecture: 'Monolithic Express',
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
};

app.get('/', healthCheck);
app.get('/api', healthCheck);

// Export for Vercel Serverless
module.exports = app;
