// api/v1/chat/transfer-to-human.js — Escalate session to human agent
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');

const handler = async (req, res) => {
  try {
    const { sessionId, reason, priorityLevel, customerSummary } = req.body;

    if (!sessionId || !reason) {
      return res.status(400).json({ success: false, error: 'sessionId and reason are required' });
    }

    let session = await store.getSession(sessionId);
    if (!session) {
      await store.createSession({
        sessionId, userId: 'auto', platform: 'app', language: 'en',
        orderContext: {}, status: 'AI_ACTIVE', messages: [], agentInfo: null
      });
      session = await store.getSession(sessionId);
    }

    if (session.status === 'PENDING_HUMAN' || session.status === 'HUMAN_CONNECTED') {
      return res.status(400).json({ success: false, error: `Session already escalated (Status: ${session.status})` });
    }

    await store.updateSession(sessionId, { status: 'PENDING_HUMAN' });

    const ticketId = `TKT-${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    // Auto-assign priority based on reason if omitted
    let assignedPriority = priorityLevel || 'MEDIUM';
    if (!priorityLevel) {
      if (reason === 'safety_concern' || reason === 'fraud_report') assignedPriority = 'CRITICAL';
      else if (reason === 'non_delivery' || reason === 'dispute') assignedPriority = 'HIGH';
    }

    await store.createTicket({
      ticketId,
      sessionId,
      userId: session.userId,
      reason,
      priorityLevel: assignedPriority,
      customerSummary: customerSummary || `Agent transfer requested for reason: ${reason}`,
      status: 'PENDING_HUMAN',
      createdAt
    });

    const queuePosition = await store.getQueuePosition(ticketId);

    // Log transfer event for research data collection
    await logResearchEvent('HUMAN_TRANSFER', {
      sessionId,
      userId: session.userId,
      ticketId,
      reason,
      priorityLevel: assignedPriority,
      queuePosition
    });

    return res.status(200).json({
      success: true,
      sessionId,
      status: 'PENDING_HUMAN',
      ticketId,
      queuePosition,
      estimatedWaitMinutes: queuePosition * 2,
      message: 'You have been added to the support queue. An agent will be with you shortly.'
    });

  } catch (error) {
    console.error('Transfer to human error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = handler;
