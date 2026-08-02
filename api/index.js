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

const router = express.Router();

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
  Promise.resolve(handler(req, res)).catch(next);
};

// Health Check handler
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

router.get('/', healthCheck);
router.get('/health', healthCheck);

// Legacy routes
router.post('/generate', wrapHandler(generateHandler));
router.post('/feedback', wrapHandler(feedbackHandler));

// V1 Chat routes
router.post('/v1/chat/session/start', wrapHandler(startSessionHandler));
router.post('/v1/chat/message', wrapHandler(chatMessageHandler));
router.post('/v1/chat/transfer-to-human', wrapHandler(transferHandler));
router.post('/v1/chat/resolve', wrapHandler(resolveHandler));

// V1 Agent routes
router.get('/v1/agent/queue', wrapHandler(agentQueueHandler));
router.post('/v1/agent/claim-ticket', wrapHandler(claimTicketHandler));
router.post('/v1/agent/message', wrapHandler(agentMessageHandler));

// V1 Dynamic routes
router.get('/v1/chat/history/:sessionId', (req, res, next) => {
  req.query = req.query || {};
  req.query.sessionId = req.params.sessionId;
  wrapHandler(chatHistoryHandler)(req, res, next);
});

router.get('/v1/chat/status/:sessionId', (req, res, next) => {
  req.query = req.query || {};
  req.query.sessionId = req.params.sessionId;
  wrapHandler(chatStatusHandler)(req, res, next);
});

// Mount router on both /api and / so it works regardless of Vercel rewrite prefixing
app.use('/api', router);
app.use('/', router);

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} Not Found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Express Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Export for Vercel Serverless
module.exports = app;
