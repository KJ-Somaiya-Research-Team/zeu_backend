// store.js
// In-memory global store for local testing.
// WARNING: On Vercel production, this state will reset frequently.
// Use Vercel KV, Redis, or PostgreSQL for production deployments.

global.zeuStore = global.zeuStore || {
  sessions: {}, 
  // sessions shape: { [sessionId]: { userId, platform, language, orderContext, status, messages: [], createdAt, agentInfo } }
  tickets: {}   
  // tickets shape: { [ticketId]: { sessionId, userId, reason, priorityLevel, customerSummary, status, waitingSinceMinutes, createdAt, queuePosition } }
};

module.exports = global.zeuStore;
