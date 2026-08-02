// logger.js
// Research Data Collection Logger
// Safe for local development and Vercel Serverless read-only environments.

const fs = require('fs');
const path = require('path');

// Determine log path safely without top-level filesystem mutation
const getLogFilePath = () => {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return path.join('/tmp', 'zeu_interactions.jsonl');
  }
  try {
    const logDir = path.join(process.cwd(), 'research_data');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return path.join(logDir, 'interactions.jsonl');
  } catch (err) {
    return path.join('/tmp', 'zeu_interactions.jsonl');
  }
};

const logResearchEvent = (eventType, data) => {
  const entry = {
    timestamp: new Date().toISOString(),
    eventType,
    ...data
  };

  try {
    const filePath = getLogFilePath();
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('Research logger write failed:', err.message);
  }
};

const getResearchData = () => {
  try {
    const filePath = getLogFilePath();
    if (!fs.existsSync(filePath)) return [];
    
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return [];
    
    return raw.split('\n').map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch (err) {
    console.error('Research data read failed:', err.message);
    return [];
  }
};

module.exports = { logResearchEvent, getResearchData };
