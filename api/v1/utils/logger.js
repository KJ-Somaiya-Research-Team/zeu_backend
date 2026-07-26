// logger.js
// Research Data Collection Logger
// Logs every AI interaction, human handoff, and feedback to a persistent JSON log file.
// This data is used for the academic research study on AI chatbot effectiveness in Kirana marketing.

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'research_data');
const LOG_FILE = path.join(LOG_DIR, 'interactions.jsonl');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch (err) {
    console.warn('Could not create research_data directory:', err.message);
  }
}

/**
 * Appends a structured research data entry to the JSONL log file.
 * Each line is a self-contained JSON object for easy parsing.
 * 
 * @param {string} eventType - One of: SESSION_START, AI_MESSAGE, HUMAN_TRANSFER, AGENT_CLAIM, AGENT_MESSAGE, SESSION_RESOLVE, FEEDBACK
 * @param {object} data - The payload to log (varies by event type)
 */
const logResearchEvent = (eventType, data) => {
  const entry = {
    timestamp: new Date().toISOString(),
    eventType,
    ...data
  };

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    // On Vercel serverless, /tmp is the only writable path.
    // Fallback to /tmp if the main log dir is read-only.
    try {
      const tmpLog = path.join('/tmp', 'zeu_interactions.jsonl');
      fs.appendFileSync(tmpLog, JSON.stringify(entry) + '\n', 'utf8');
    } catch (fallbackErr) {
      console.error('Research logger write failed:', fallbackErr.message);
    }
  }
};

/**
 * Retrieves all logged research data entries.
 * Returns an array of parsed JSON objects.
 */
const getResearchData = () => {
  try {
    const filePath = fs.existsSync(LOG_FILE) ? LOG_FILE : path.join('/tmp', 'zeu_interactions.jsonl');
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
