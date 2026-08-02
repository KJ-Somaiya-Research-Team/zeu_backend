const allowCors = require('./v1/utils/cors');

const handler = (req, res) => {
  res.status(200).json({
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
};

module.exports = allowCors(handler);
