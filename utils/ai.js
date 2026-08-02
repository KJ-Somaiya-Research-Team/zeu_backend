// api/v1/utils/ai.js
// Centralized AI client with model fallback
// Lazy-loaded to prevent Vercel cold-start crashes

let _client = null;

const getAiClient = () => {
  if (!_client) {
    const { GoogleGenAI } = require('@google/genai');
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _client;
};

const PRIMARY_MODEL = 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash';

// Generate content with automatic fallback on rate limit / timeout / error
const generateWithFallback = async (prompt, options = {}) => {
  const { systemInstruction, temperature = 0.7 } = options;
  const ai = getAiClient();
  
  const config = {};
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (temperature !== undefined) config.temperature = temperature;

  // Try primary model first
  try {
    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config
    });
    return { text: response.text || '', model: PRIMARY_MODEL };
  } catch (primaryError) {
    const code = primaryError?.status || primaryError?.code || '';
    const msg = (primaryError?.message || '').toLowerCase();
    const isRetryable = code === 429 || code === 503 || code === 'RESOURCE_EXHAUSTED' || msg.includes('rate') || msg.includes('timeout') || msg.includes('overloaded') || msg.includes('unavailable');
    
    if (!isRetryable) throw primaryError; // non-retryable: propagate
    
    console.warn(`Primary model ${PRIMARY_MODEL} failed (${code}), falling back to ${FALLBACK_MODEL}`);
    
    // Fallback model
    const response = await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: prompt,
      config
    });
    return { text: response.text || '', model: FALLBACK_MODEL };
  }
};

module.exports = { getAiClient, generateWithFallback, PRIMARY_MODEL, FALLBACK_MODEL };
