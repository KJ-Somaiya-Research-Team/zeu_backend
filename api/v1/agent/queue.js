const allowCors = require('../utils/cors');
const store = require('../utils/store');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const statusFilter = req.query.status || 'PENDING_HUMAN';
    const limit = parseInt(req.query.limit) || 20;

    let tickets = Object.values(store.tickets)
      .filter(t => t.status === statusFilter);

    // Sort: CRITICAL > HIGH > MEDIUM > LOW, then by oldest wait time
    const priorityWeight = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    
    tickets.sort((a, b) => {
      const pA = priorityWeight[a.priorityLevel] || 0;
      const pB = priorityWeight[b.priorityLevel] || 0;
      
      if (pA !== pB) return pB - pA; // Higher priority first
      return new Date(a.createdAt) - new Date(b.createdAt); // Oldest first
    });

    // Add estimated wait time for UI rendering
    tickets = tickets.map(t => {
      const waitTimeMs = Date.now() - new Date(t.createdAt).getTime();
      return {
        ...t,
        waitingSinceMinutes: Math.floor(waitTimeMs / 60000)
      };
    });

    const paginatedTickets = tickets.slice(0, limit);

    return res.status(200).json({
      success: true,
      queueLength: tickets.length,
      tickets: paginatedTickets
    });

  } catch (error) {
    console.error('Queue fetch error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = allowCors(handler);
