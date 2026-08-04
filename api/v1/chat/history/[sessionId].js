const allowCors = require('../../_utils/cors');
const store = require('../../_utils/store');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }

    let session = store.sessions[sessionId];
    if (!session) {
      store.sessions[sessionId] = {
        userId: 'auto', platform: 'app', language: 'en', orderContext: {},
        status: 'AI_ACTIVE', createdAt: new Date().toISOString(), messages: [], agentInfo: null
      };
      session = store.sessions[sessionId];
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const messages = session.messages.slice(offset, offset + limit);

    return res.status(200).json({
      success: true,
      sessionId,
      status: session.status,
      messageCount: session.messages.length,
      messages
    });

  } catch (error) {
    console.error('Fetch history error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = allowCors(handler);
