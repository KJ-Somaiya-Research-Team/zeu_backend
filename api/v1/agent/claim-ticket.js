// api/v1/agent/claim-ticket.js — Agent claims a support ticket
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');

const handler = async (req, res) => {
  try {
    const { ticketId, agentId } = req.body;

    if (!ticketId || !agentId) {
      return res.status(400).json({ success: false, error: 'ticketId and agentId are required' });
    }

    const ticket = await store.getTicket(ticketId);
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

    const session = await store.getSession(ticket.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session associated with ticket not found' });
    }

    const claimedAt = new Date().toISOString();
    const agentInfo = { agentId, claimedAt };

    // Update ticket
    await store.updateTicket(ticketId, { status: 'HUMAN_CONNECTED', agentInfo });

    // Update session
    const sessionAgentInfo = { agentId, agentName: `Agent ${agentId}`, connectedSince: claimedAt };
    await store.updateSession(ticket.sessionId, { status: 'HUMAN_CONNECTED', agentInfo: sessionAgentInfo });

    // Inject system message into chat
    await store.addMessage(ticket.sessionId, {
      id: `msg_sys_${Date.now()}`,
      role: 'agent',
      content: `A human agent (Agent ${agentId}) has joined the chat.`,
      timestamp: claimedAt,
      source: 'system'
    });

    const messageCount = await store.getMessageCount(ticket.sessionId);

    // Log claim event for research
    await logResearchEvent('AGENT_CLAIM', {
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
        messageCount
      },
      message: 'Session assigned. You are now connected to the customer.'
    });

  } catch (error) {
    console.error('Claim ticket error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = handler;
