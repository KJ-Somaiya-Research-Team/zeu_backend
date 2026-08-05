try {
  require('dotenv').config();
} catch (e) {
  try { process.loadEnvFile(); } catch (_) { /* .env missing or old Node */ }
}

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Import handlers ──
const indexHandler = require('./api/index');
const generateHandler = require('./api/generate');
const feedbackHandler = require('./api/feedback');
const startSessionHandler = require('./api/v1/chat/session/start');
const chatMessageHandler = require('./api/v1/chat/message');
const chatHistoryHandler = require('./api/v1/chat/history');
const chatStatusHandler = require('./api/v1/chat/status');
const transferHandler = require('./api/v1/chat/transfer-to-human');
const resolveHandler = require('./api/v1/chat/resolve');
const agentQueueHandler = require('./api/v1/agent/queue');
const claimTicketHandler = require('./api/v1/agent/claim-ticket');
const agentMessageHandler = require('./api/v1/agent/message');
const updateStatusHandler = require('./api/v1/agent/update-status');

// ── Routes ──
app.get('/api', indexHandler);
app.get('/', indexHandler);

app.all('/api/generate', (req, res, next) => req.method === 'POST' ? generateHandler(req, res, next) : res.status(405).json({error: 'Method Not Allowed'}));
app.post('/api/feedback', feedbackHandler);

app.post('/api/v1/chat/session/start', startSessionHandler);
app.post('/api/v1/chat/message', chatMessageHandler);
app.get('/api/v1/chat/history/:sessionId', chatHistoryHandler);
app.get('/api/v1/chat/status/:sessionId', chatStatusHandler);
app.post('/api/v1/chat/transfer-to-human', transferHandler);
app.post('/api/v1/chat/resolve', resolveHandler);

app.get('/api/v1/agent/queue', agentQueueHandler);
app.post('/api/v1/agent/claim-ticket', claimTicketHandler);
app.post('/api/v1/agent/message', agentMessageHandler);
app.patch('/api/v1/agent/update-status', updateStatusHandler);

// ── 404 catch-all ──
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint Not Found' });
});

// ── Start server ──
const start = async () => {
  const db = await connectDB();
  if (!db) {
    console.warn('⚠️  Running with in-memory store (no MONGO_URI)');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Zeu Backend running at http://localhost:${PORT}`);
    console.log(`📍 Health: GET http://localhost:${PORT}/api`);
  });
};

start();
