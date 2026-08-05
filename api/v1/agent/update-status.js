// api/v1/agent/update-status.js — Directly update ticket/session status
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');

// Valid status transitions
const VALID_STATUSES = ['PENDING_HUMAN', 'HUMAN_CONNECTED', 'CLOSED'];

const handler = async (req, res) => {
  try {
    const { ticketId, sessionId, status, agentId } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    // Update by ticketId
    if (ticketId) {
      const ticket = await store.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ success: false, error: `Ticket ${ticketId} not found` });
      }

      const previousStatus = ticket.status;
      await store.updateTicket(ticketId, {
        status,
        ...(status === 'HUMAN_CONNECTED' && agentId ? { agentInfo: { agentId, claimedAt: new Date().toISOString() } } : {}),
        ...(status === 'CLOSED' ? { resolvedAt: new Date().toISOString(), resolvedBy: agentId || 'system' } : {})
      });

      // Also update the linked session status
      if (ticket.sessionId) {
        await store.updateSession(ticket.sessionId, {
          status,
          ...(status === 'HUMAN_CONNECTED' && agentId ? { agentInfo: { agentId, agentName: `Agent ${agentId}`, connectedSince: new Date().toISOString() } } : {})
        });
      }

      await logResearchEvent('STATUS_UPDATE', {
        ticketId,
        sessionId: ticket.sessionId,
        previousStatus,
        newStatus: status,
        agentId: agentId || null
      });

      return res.status(200).json({
        success: true,
        ticketId,
        sessionId: ticket.sessionId,
        previousStatus,
        status,
        updatedAt: new Date().toISOString()
      });
    }

    // Update by sessionId
    if (sessionId) {
      const session = await store.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, error: `Session ${sessionId} not found` });
      }

      const previousStatus = session.status;
      await store.updateSession(sessionId, {
        status,
        ...(status === 'HUMAN_CONNECTED' && agentId ? { agentInfo: { agentId, agentName: `Agent ${agentId}`, connectedSince: new Date().toISOString() } } : {})
      });

      // Also update the linked ticket if exists
      const ticket = await store.findTicketBySession(sessionId, previousStatus);
      if (ticket) {
        await store.updateTicket(ticket.ticketId, {
          status,
          ...(status === 'HUMAN_CONNECTED' && agentId ? { agentInfo: { agentId, claimedAt: new Date().toISOString() } } : {}),
          ...(status === 'CLOSED' ? { resolvedAt: new Date().toISOString(), resolvedBy: agentId || 'system' } : {})
        });
      }

      await logResearchEvent('STATUS_UPDATE', {
        ticketId: ticket ? ticket.ticketId : null,
        sessionId,
        previousStatus,
        newStatus: status,
        agentId: agentId || null
      });

      return res.status(200).json({
        success: true,
        sessionId,
        ticketId: ticket ? ticket.ticketId : null,
        previousStatus,
        status,
        updatedAt: new Date().toISOString()
      });
    }

    return res.status(400).json({ success: false, error: 'Either ticketId or sessionId is required' });

  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = handler;
