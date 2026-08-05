// api/v1/chat/resolve.js — Close/resolve a session
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');

const handler = async (req, res) => {
  try {
    const { sessionId, agentId, resolution, agentNotes } = req.body;

    if (!sessionId || !agentId || !resolution) {
      return res.status(400).json({ success: false, error: 'sessionId, agentId, and resolution are required' });
    }

    let session = await store.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: `Session ${sessionId} not found` });
    }

    await store.updateSession(sessionId, { status: 'CLOSED' });

    // Find and close ticket
    let resolvedTicketId = null;
    const ticket = await store.findTicketBySession(sessionId, 'HUMAN_CONNECTED');
    if (ticket) {
      await store.updateTicket(ticket.ticketId, {
        status: 'CLOSED',
        resolvedAt: new Date().toISOString(),
        resolvedBy: agentId,
        resolution,
        agentNotes: agentNotes || ''
      });
      resolvedTicketId = ticket.ticketId;
    }

    // Log session resolve event for research
    await logResearchEvent('SESSION_RESOLVE', {
      sessionId,
      agentId,
      resolution,
      resolvedTicketId
    });

    return res.status(200).json({
      success: true,
      sessionId,
      ticketId: resolvedTicketId,
      status: 'CLOSED',
      resolution,
      resolvedAt: new Date().toISOString(),
      resolvedBy: agentId
    });

  } catch (error) {
    console.error('Resolve session error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = handler;
