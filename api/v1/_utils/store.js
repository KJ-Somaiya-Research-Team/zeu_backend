// store.js
// Persistent MongoDB store for sessions, tickets, and messages.
// Falls back to in-memory store if MONGO_URI is not set (local dev).

const memStore = { sessions: {}, tickets: {} };

const getDB = () => {
  try {
    return require('../../../db').getDB();
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════
// SESSION OPERATIONS
// ═══════════════════════════════════════════

const createSession = async (sessionData) => {
  const db = getDB();
  const session = {
    ...sessionData,
    createdAt: sessionData.createdAt || new Date().toISOString(),
    messages: sessionData.messages || [],
    agentInfo: sessionData.agentInfo || null
  };

  if (!db) {
    memStore.sessions[session.sessionId] = session;
    return session;
  }

  // Insert session, embedding messages as a sub-array
  await db.collection('sessions').updateOne(
    { sessionId: session.sessionId },
    { $setOnInsert: session },
    { upsert: true }
  );
  return session;
};

const getSession = async (sessionId) => {
  const db = getDB();
  if (!db) return memStore.sessions[sessionId] || null;
  
  return await db.collection('sessions').findOne({ sessionId });
};

const updateSession = async (sessionId, updates) => {
  const db = getDB();
  if (!db) {
    if (memStore.sessions[sessionId]) {
      Object.assign(memStore.sessions[sessionId], updates);
    }
    return;
  }
  
  if (Object.keys(updates).length > 0) {
    await db.collection('sessions').updateOne(
      { sessionId },
      { $set: updates }
    );
  }
};

// ═══════════════════════════════════════════
// MESSAGE OPERATIONS
// ═══════════════════════════════════════════

const addMessage = async (sessionId, msg) => {
  const db = getDB();
  if (!db) {
    if (memStore.sessions[sessionId]) {
      memStore.sessions[sessionId].messages.push(msg);
    }
    return;
  }
  
  // Push message to the embedded array
  await db.collection('sessions').updateOne(
    { sessionId },
    { $push: { messages: msg } }
  );
};

const getMessages = async (sessionId, { limit = 50, offset = 0 } = {}) => {
  const session = await getSession(sessionId);
  if (!session || !session.messages) return [];
  return session.messages.slice(offset, offset + limit);
};

const getMessageCount = async (sessionId) => {
  const session = await getSession(sessionId);
  return session && session.messages ? session.messages.length : 0;
};

// ═══════════════════════════════════════════
// TICKET OPERATIONS
// ═══════════════════════════════════════════

const createTicket = async (ticket) => {
  const db = getDB();
  if (!db) {
    memStore.tickets[ticket.ticketId] = ticket;
    return ticket;
  }
  
  await db.collection('tickets').insertOne(ticket);
  return ticket;
};

const getTicket = async (ticketId) => {
  const db = getDB();
  if (!db) return memStore.tickets[ticketId] || null;
  
  return await db.collection('tickets').findOne({ ticketId });
};

const updateTicket = async (ticketId, updates) => {
  const db = getDB();
  if (!db) {
    if (memStore.tickets[ticketId]) {
      Object.assign(memStore.tickets[ticketId], updates);
    }
    return;
  }
  
  if (Object.keys(updates).length > 0) {
    await db.collection('tickets').updateOne(
      { ticketId },
      { $set: updates }
    );
  }
};

const listTickets = async ({ status = 'PENDING_HUMAN', limit = 20 } = {}) => {
  const db = getDB();
  const priorityWeight = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
  
  let tickets = [];
  if (!db) {
    tickets = Object.values(memStore.tickets).filter(t => t.status === status);
  } else {
    tickets = await db.collection('tickets').find({ status }).toArray();
  }

  // Sort by priority first (highest to lowest), then by createdAt (oldest first)
  tickets.sort((a, b) => {
    const pA = priorityWeight[a.priorityLevel] || 0;
    const pB = priorityWeight[b.priorityLevel] || 0;
    if (pA !== pB) return pB - pA;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  return tickets.slice(0, limit).map(t => ({
    ...t,
    _id: undefined, // remove mongo internal ID for clean response
    waitingSinceMinutes: Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 60000)
  }));
};

const findTicketBySession = async (sessionId, status) => {
  const db = getDB();
  if (!db) {
    return Object.values(memStore.tickets).find(t => t.sessionId === sessionId && t.status === status) || null;
  }
  
  return await db.collection('tickets').findOne({ sessionId, status });
};

const countTickets = async (status = 'PENDING_HUMAN') => {
  const db = getDB();
  if (!db) {
    return Object.values(memStore.tickets).filter(t => t.status === status).length;
  }
  
  return await db.collection('tickets').countDocuments({ status });
};

const getQueuePosition = async (ticketId) => {
  const db = getDB();
  let tickets = [];
  
  if (!db) {
    tickets = Object.values(memStore.tickets).filter(t => t.status === 'PENDING_HUMAN');
  } else {
    tickets = await db.collection('tickets').find({ status: 'PENDING_HUMAN' }).toArray();
  }
  
  tickets.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const pos = tickets.findIndex(t => t.ticketId === ticketId);
  return pos === -1 ? null : pos + 1;
};

// ═══════════════════════════════════════════
// FEEDBACK OPERATIONS
// ═══════════════════════════════════════════

const saveFeedback = async (feedbackData) => {
  const db = getDB();
  const entry = {
    ...feedbackData,
    createdAt: new Date().toISOString()
  };
  
  if (!db) {
    console.log('Feedback (in-memory):', entry);
    return;
  }
  
  await db.collection('feedback').insertOne(entry);
};

module.exports = {
  // Sessions
  createSession, getSession, updateSession,
  // Messages
  addMessage, getMessages, getMessageCount,
  // Tickets
  createTicket, getTicket, updateTicket, listTickets, findTicketBySession, countTickets, getQueuePosition,
  // Feedback
  saveFeedback
};
