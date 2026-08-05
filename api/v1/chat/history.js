// api/v1/chat/history.js — Fetch chat message history
const store = require('../_utils/store');

const handler = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }

    const session = await store.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: `Session ${sessionId} not found` });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const messages = await store.getMessages(sessionId, { limit, offset });
    const messageCount = await store.getMessageCount(sessionId);

    return res.status(200).json({
      success: true,
      sessionId,
      status: session.status,
      messageCount,
      messages
    });

  } catch (error) {
    console.error('Fetch history error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = handler;
