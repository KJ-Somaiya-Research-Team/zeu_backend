const { GoogleGenAI } = require('@google/genai');

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

// Enable CORS helper for Vercel Serverless
const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

// Base system prompt extracted from legacy NexKirana research, rebranded to Zeu
const buildSystemPrompt = (classification = 'STANDARD') => {
  const base = `You are Zeu's AI Assistant (formerly NexKirana). Zeu is a platform where customers can order groceries from local Kirana stores for home delivery or pre-book/pickup.
RULES: 
- 7-min window is strictly for PICKUP orders, not delivery. 
- NEVER connect a customer directly to a Kirana shopkeeper.
- If the user explicitly asks for "insaan", "human", "agent", or says their order was NEVER received → immediately hand off. Reply EXACTLY with: "I am transferring you to a human agent immediately. [TRANSFER]".
- Always respond in the user's preferred language (English/Hindi/Marathi).
- Empathy without resolution causes churn. Offer hard resolutions (e.g. refunds for poor quality).
- Do NOT use markdown bold/italics. Keep it clean with emojis.`;

  if (classification === 'CRITICAL' || classification === 'DISPUTE') {
    return `${base}\nMODE: DEEP REASONING for high-priority issue.
For disputes (missing items, damaged goods): verify order details, apologize deeply, and ask the user to upload a product photo + receipt photo.
Treat as URGENT. Provide concrete resolution with timeline.`;
  }
  
  return `${base}\nMODE: FAST RESPONSE. Be concise. Provide structured, step-by-step solutions.`;
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, history = [], classification = 'STANDARD' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'GEMINI_API_KEY environment variable is not set. Please set it in your .env file.'
      });
    }

    // Format history for the new SDK
    const formattedContents = history.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
    
    formattedContents.push({ role: 'user', parts: [{ text: prompt }] });

    const systemPrompt = buildSystemPrompt(classification);
    
    // Choose model based on environment variable or classification
    const defaultModel = process.env.GEMINI_API_MODEL || 'gemini-3.6-flash';
    const targetModel = classification === 'CRITICAL' ? (process.env.GEMINI_CRITICAL_MODEL || defaultModel) : defaultModel;

    const aiClient = getAiClient();
    const response = await aiClient.models.generateContent({
      model: targetModel,
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: classification === 'CRITICAL' ? 0.4 : 0.7, // Lower temp for reasoning
      }
    });

    const replyText = response.text || '';
    
    // Fallback escalation check
    const isTransfer = replyText.includes('[TRANSFER]');
    const cleanReply = replyText.replace('[TRANSFER]', '').trim();

    return res.status(200).json({
      success: true,
      reply: cleanReply,
      is_transfer: isTransfer,
      model_used: targetModel
    });

  } catch (error) {
    console.error('Zeu AI Engine Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process AI request',
      details: error.message 
    });
  }
};

module.exports = allowCors(handler);
