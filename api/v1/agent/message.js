const allowCors = require('../_utils/cors');
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, agentId, message, actionType = 'text', refundAmount } = req.body;

    if (!sessionId || !agentId || !message) {
      return res.status(400).json({ success: false, error: 'sessionId, agentId, and message are required' });
    }

    let session = store.sessions[sessionId];
    if (!session) {
      store.sessions[sessionId] = {
        userId: 'auto', platform: 'app', language: 'en', orderContext: {},
        status: 'AI_ACTIVE', createdAt: new Date().toISOString(), messages: [], agentInfo: null
      };
      session = store.sessions[sessionId];
    }

    if (session.status !== 'HUMAN_CONNECTED') {
      return res.status(403).json({ success: false, error: `Session status is ${session.status}, expecting HUMAN_CONNECTED` });
    }

    const timestamp = new Date().toISOString();
    const messageId = `msg_agt_${Date.now()}`;

    const newMsg = {
      id: messageId,
      role: 'agent',
      content: message,
      timestamp,
      source: 'human_agent',
      actionType,
      refundAmount: refundAmount || null
    };

    session.messages.push(newMsg);

    // Log agent message for research
    logResearchEvent('AGENT_MESSAGE', {
      sessionId,
      agentId,
      message,
      actionType,
      refundAmount
    });

    return res.status(200).json({
      success: true,
      sessionId,
      messageId,
      deliveredAt: timestamp
    });

  } catch (error) {
    console.error('Agent message error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = allowCors(handler);
