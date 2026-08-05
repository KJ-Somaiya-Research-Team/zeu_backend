// api/v1/chat/status.js — Get session status and queue position
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

    let queuePosition = null;
    let estimatedWaitMinutes = null;

    if (session.status === 'PENDING_HUMAN') {
      // Find the ticket for this session to get queue position
      const ticket = await store.findTicketBySession(sessionId, 'PENDING_HUMAN');
      if (ticket) {
        queuePosition = await store.getQueuePosition(ticket.ticketId);
        if (queuePosition) {
          estimatedWaitMinutes = queuePosition * 2;
        }
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

module.exports = handler;
