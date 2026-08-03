const allowCors = require('../_utils/cors');
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, agentId, resolution, agentNotes } = req.body;

    if (!sessionId || !agentId || !resolution) {
      return res.status(400).json({ success: false, error: 'sessionId, agentId, and resolution are required' });
    }

    const session = store.sessions[sessionId];
    if (!session) {
      return res.status(404).json({ success: false, error: `Session ${sessionId} not found` });
    }

    session.status = 'CLOSED';

    // Find and close ticket
    let resolvedTicketId = null;
    const ticket = Object.values(store.tickets).find(t => t.sessionId === sessionId && t.status === 'HUMAN_CONNECTED');
    if (ticket) {
      ticket.status = 'CLOSED';
      ticket.resolvedAt = new Date().toISOString();
      ticket.resolvedBy = agentId;
      ticket.resolution = resolution;
      ticket.agentNotes = agentNotes || '';
      resolvedTicketId = ticket.ticketId;
    }

    // Log session resolve event for research
    logResearchEvent('SESSION_RESOLVE', {
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

module.exports = allowCors(handler);
