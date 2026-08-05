// api/v1/agent/queue.js — Fetch support ticket queue
const store = require('../_utils/store');

const handler = async (req, res) => {
  try {
    const statusFilter = req.query.status || 'PENDING_HUMAN';
    const limit = parseInt(req.query.limit || '20');

    const tickets = await store.listTickets({ status: statusFilter, limit });

    return res.status(200).json({
      success: true,
      queueLength: tickets.length,
      tickets
    });

  } catch (error) {
    console.error('Queue fetch error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = handler;
