// logger.js
// Research Data Collection Logger — MongoDB backed with console fallback

const logResearchEvent = async (eventType, data) => {
  const entry = {
    timestamp: new Date().toISOString(),
    eventType,
    ...data
  };

  try {
    const { getDB } = require('../../../db');
    const db = getDB();
    if (db) {
      await db.collection('research_events').insertOne(entry);
      return;
    }
  } catch (err) {
    // DB not available — fall through to console
  }

  // Fallback: log to console (visible in Render logs)
  console.log(`[RESEARCH] ${eventType}:`, JSON.stringify(entry));
};

const getResearchData = async ({ eventType, limit = 100 } = {}) => {
  try {
    const { getDB } = require('../../../db');
    const db = getDB();
    if (db) {
      const query = eventType ? { eventType } : {};
      const results = await db.collection('research_events')
        .find(query)
        .sort({ _id: -1 })
        .limit(limit)
        .toArray();
      return results;
    }
  } catch (err) {
    // DB not available
  }
  return [];
};

module.exports = { logResearchEvent, getResearchData };
