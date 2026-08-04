const allowCors = require('../_utils/cors');
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, reason, priorityLevel, customerSummary } = req.body;

    if (!sessionId || !reason) {
      return res.status(400).json({ success: false, error: 'sessionId and reason are required' });
    }

    let session = store.sessions[sessionId];
    if (!session) {
      store.sessions[sessionId] = {
        userId: 'auto', platform: 'app', language: 'en', orderContext: {},
        status: 'AI_ACTIVE', createdAt: new Date().toISOString(), messages: [], agentInfo: null
      };
      session = store.sessions[sessionId];
    }

    if (session.status === 'PENDING_HUMAN' || session.status === 'HUMAN_CONNECTED') {
      return res.status(400).json({ success: false, error: `Session already escalated (Status: ${session.status})` });
    }

    session.status = 'PENDING_HUMAN';

    const ticketId = `TKT-${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    // Auto-assign priority based on reason if omitted
    let assignedPriority = priorityLevel || 'MEDIUM';
    if (!priorityLevel) {
      if (reason === 'safety_concern' || reason === 'fraud_report') assignedPriority = 'CRITICAL';
      else if (reason === 'non_delivery' || reason === 'dispute') assignedPriority = 'HIGH';
    }

    store.tickets[ticketId] = {
      ticketId,
      sessionId,
      userId: session.userId,
      reason,
      priorityLevel: assignedPriority,
      customerSummary: customerSummary || `Agent transfer requested for reason: ${reason}`,
      status: 'PENDING_HUMAN',
      createdAt
    };

    const tickets = Object.values(store.tickets)
      .filter(t => t.status === 'PENDING_HUMAN')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const queuePosition = tickets.findIndex(t => t.ticketId === ticketId) + 1;

    // Log transfer event for research data collection
    logResearchEvent('HUMAN_TRANSFER', {
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

module.exports = allowCors(handler);
