const allowCors = require('../../../utils/cors');
const store = require('../../../utils/store');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId is required' });
    }

    const session = store.sessions[sessionId];
    if (!session) {
      return res.status(404).json({ success: false, error: `Session ${sessionId} not found` });
    }

    let queuePosition = null;
    let estimatedWaitMinutes = null;

    if (session.status === 'PENDING_HUMAN') {
      const tickets = Object.values(store.tickets)
        .filter(t => t.status === 'PENDING_HUMAN')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      const pos = tickets.findIndex(t => t.sessionId === sessionId);
      if (pos !== -1) {
        queuePosition = pos + 1;
        estimatedWaitMinutes = queuePosition * 2; // dummy estimation
      }
    }

    return res.status(200).json({
      success: true,
      sessionId,
      status: session.status,
      agentInfo: session.agentInfo || null,
      queuePosition,
      estimatedWaitMinutes
    });

  } catch (error) {
    console.error('Status fetch error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = allowCors(handler);
