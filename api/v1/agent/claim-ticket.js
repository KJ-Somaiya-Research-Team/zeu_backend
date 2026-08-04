const allowCors = require('../_utils/cors');
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { ticketId, agentId } = req.body;

    if (!ticketId || !agentId) {
      return res.status(400).json({ success: false, error: 'ticketId and agentId are required' });
    }

    const ticket = store.tickets[ticketId];
    if (!ticket) {
      return res.status(404).json({ success: false, error: `Ticket ${ticketId} not found` });
    }

    if (ticket.status === 'HUMAN_CONNECTED' || ticket.status === 'CLOSED') {
      return res.status(409).json({ 
        success: false, 
        error: 'Ticket already claimed or closed',
        claimedBy: ticket.agentInfo ? ticket.agentInfo.agentId : 'unknown'
      });
    }

    const session = store.sessions[ticket.sessionId];
    if (!session) {
      return res.status(404).json({ success: false, error: `Session associated with ticket not found` });
    }

    // Update statuses
    ticket.status = 'HUMAN_CONNECTED';
    ticket.agentInfo = { agentId, claimedAt: new Date().toISOString() };
    
    session.status = 'HUMAN_CONNECTED';
    session.agentInfo = { agentId, agentName: `Agent ${agentId}`, connectedSince: ticket.agentInfo.claimedAt };

    // Inject system message into chat
    session.messages.push({
      id: `msg_sys_${Date.now()}`,
      role: 'agent', // We use 'agent' for human agent messages
      content: `A human agent (${session.agentInfo.agentName}) has joined the chat.`,
      timestamp: new Date().toISOString(),
      source: 'system'
    });

    // Log claim event for research
    logResearchEvent('AGENT_CLAIM', {
      ticketId,
      sessionId: ticket.sessionId,
      agentId,
      waitDurationMinutes: (new Date() - new Date(ticket.createdAt)) / 1000 / 60
    });

    return res.status(200).json({
      success: true,
      ticketId,
      sessionId: ticket.sessionId,
      status: 'HUMAN_CONNECTED',
      agentId,
      customerContext: {
        userId: session.userId,
        language: session.language,
        orderId: session.orderContext.orderId || null,
        issueType: ticket.reason,
        conversationSummary: ticket.customerSummary,
        messageCount: session.messages.length
      },
      message: 'Session assigned. You are now connected to the customer.'
    });

  } catch (error) {
    console.error('Claim ticket error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = allowCors(handler);
