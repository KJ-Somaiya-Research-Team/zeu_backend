// api/generate.js — Stateless AI chat endpoint
const { generateWithFallback } = require('./v1/_utils/ai');
const { logResearchEvent } = require('./v1/_utils/logger');

// Base system prompt extracted from nexkirana_ai_modules research
const buildSystemPrompt = (classification = 'STANDARD') => {
  const base = `You are Zeu's AI Assistant (formerly NexKirana). Zeu is a click-and-collect grocery platform with local Kirana stores (supporting pickup and home delivery).

STRICT OPERATIONAL RULES:
1. LATE ORDERS & DELAYS: Do NOT transfer to human. Reassure the customer, explain delivery status, and provide clear step-by-step guidance. (Late order queries are handled directly by AI!).
2. NON-DELIVERY & HUMAN REQUESTS: Only trigger human transfer if the order was NEVER received ("never received", "not received") or if the customer explicitly asks for a human ("insaan", "agent", "person"). Reply EXACTLY with: "I am transferring you to a human agent immediately. [TRANSFER]".
3. PICKUP RULE: The 7-minute window applies STRICTLY to Click-and-Collect PICKUP orders, NOT home deliveries.
4. SHOPKEEPER ISOLATION: NEVER connect a customer directly to a Kirana shopkeeper.
5. MULTILINGUAL: Respond in the user's preferred language (English / Hindi / Marathi).
6. EMPATHY WITH HARD RESOLUTION: Politeness without resolution causes churn. Offer hard financial/operational resolutions (instant refunds for damaged/wrong items).
7. NO MARKDOWN: Do NOT use markdown bold/italics (like ** or ##). Keep responses clean with line breaks and emojis.`;

  if (classification === 'CRITICAL' || classification === 'DISPUTE') {
    return `${base}\n\nMODE: DEEP REASONING (Crisis & Dispute Engine).
For disputes (Damaged Product, Expired Item, Wrong Item, Veg/Non-Veg Mixup, Food Safety):
- Apologize sincerely and acknowledge the issue's severity.
- Ask the user to upload clear evidence: (1) Photo of damaged/expired product and (2) Photo of shop receipt.
- Confirm that Priority Case ID is created and hard resolution (refund/replacement) will be processed upon photo verification.`;
  }
  
  return `${base}\n\nMODE: FAST RESPONSE. Be concise, warm, and structured.`;
};

const handler = async (req, res) => {
  try {
    const { prompt, classification = 'STANDARD' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (prompt.length > 2000) {
      return res.status(400).json({ error: 'Prompt too long' });
    }

    const lowerPrompt = prompt.toLowerCase();

    // LATE ORDER CHECK: Late orders / delays MUST NOT trigger human transfer!
    const isLateOrderQuery = /\b(late|delay|delayed|deri|kab|when|where.*order|kitna time|status)\b/i.test(prompt) && 
                             !/\b(never received|not received|nahi mila|gaya hi nahi)\b/i.test(prompt);

    // EXPLICIT HUMAN TRANSFER GUARDRAIL: Only for non-delivery or explicit human requests
    const escalationKeywords = ['insaan', 'human', 'agent', 'person', 'talk to human', 'connect to human', 'never received', 'not received', 'insan'];
    const isDirectEscalation = !isLateOrderQuery && escalationKeywords.some(keyword => lowerPrompt.includes(keyword));

    if (isDirectEscalation) {
      logResearchEvent('AI_MESSAGE', {
        endpoint: '/api/generate',
        userMessage: prompt,
        aiReply: 'Transfer to human triggered',
        classification,
        modelUsed: 'deterministic-guardrail',
        isTransfer: true
      });

      return res.status(200).json({
        success: true,
        reply: "This issue cannot be handled by the chatbot. I am transferring you to a human agent immediately.",
        is_transfer: true,
        model_used: "deterministic-guardrail"
      });
    }

    const systemPrompt = buildSystemPrompt(classification);
    
    const aiResult = await generateWithFallback(prompt, {
      systemInstruction: systemPrompt,
      temperature: classification === 'CRITICAL' ? 0.4 : 0.7,
    });
    let replyText = aiResult.text;
    const targetModel = aiResult.model;

    // Check if AI output triggered transfer (unless it was a late order query)
    const isTransfer = !isLateOrderQuery && replyText.includes('[TRANSFER]');
    const cleanReply = replyText.replace('[TRANSFER]', '').trim();

    // Log interaction for research data collection
    logResearchEvent('AI_MESSAGE', {
      endpoint: '/api/generate',
      userMessage: prompt,
      aiReply: cleanReply,
      classification,
      modelUsed: targetModel,
      isTransfer,
      isLateOrderQuery
    });

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
      error: 'Failed to process AI request'
    });
  }
};

module.exports = handler;
