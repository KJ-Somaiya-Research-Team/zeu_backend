// api/index.js — Health check endpoint

const handler = (req, res) => {
  return res.status(200).json({
    status: 'online',
    version: '3.0.0',
    message: 'Zeu Chatbot API Backend is running!',
    runtime: 'Render (persistent)',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/generate',
      'POST /api/feedback',
      'POST /api/v1/chat/session/start',
      'POST /api/v1/chat/message',
      'GET  /api/v1/chat/history/:sessionId',
      'GET  /api/v1/chat/status/:sessionId',
      'POST /api/v1/chat/transfer-to-human',
      'GET  /api/v1/agent/queue',
      'POST /api/v1/agent/claim-ticket',
      'POST /api/v1/agent/message',
      'POST /api/v1/chat/resolve',
      'PATCH /api/v1/agent/update-status'
    ]
  });
};

module.exports = handler;
