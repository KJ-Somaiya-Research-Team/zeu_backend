const allowCors = require('../../utils/cors');
const store = require('../../utils/store');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, reason, priorityLevel, customerSummary } = req.body;

    if (!sessionId || !reason) {
      return res.status(400).json({ success: false, error: 'sessionId and reason are required' });
    }

    const session = store.sessions[sessionId];
    if (!session) {
      return res.status(404).json({ success: false, error: `Session ${sessionId} not found` });
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
