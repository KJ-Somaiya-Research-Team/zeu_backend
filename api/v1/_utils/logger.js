// logger.js
// Research Data Collection Logger
// Safe for local development and Vercel Serverless read-only environments.

const fs = require('fs');
const path = require('path');

// Determine log path safely — always use /tmp unless confirmed local dev
const getLogFilePath = () => {
  // Always use /tmp on serverless / production / unknown environments
  const tmpPath = path.join('/tmp', 'zeu_interactions.jsonl');
  
  // Only use local directory if explicitly running locally
  if (process.env.NODE_ENV === 'development' || process.env.LOCAL_DEV === 'true') {
    try {
      const logDir = path.join(process.cwd(), 'research_data');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      return path.join(logDir, 'interactions.jsonl');
    } catch (err) {
      // Fall through to /tmp
    }
  }
  
  return tmpPath;
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
