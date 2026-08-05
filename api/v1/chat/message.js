// api/v1/chat/message.js — Send message in existing session
const store = require('../_utils/store');
const { logResearchEvent } = require('../_utils/logger');
const { generateWithFallback } = require('../_utils/ai');

const buildSystemPrompt = (classification = 'STANDARD') => {
  const base = `You are Zeu's AI Assistant. Zeu is a local Kirana grocery ordering platform.
RULES:
1. LATE ORDERS: Do NOT transfer to human. Reassure the customer.
2. NON-DELIVERY / HUMAN REQUESTS: Only trigger human transfer if order NEVER received, or if customer asks for a human. Reply EXACTLY with: "I am transferring you to a human agent immediately. [TRANSFER]".
3. Keep responses clean. No markdown bold/italics.
4. MULTILINGUAL: Respond in the user's preferred language (English / Hindi / Marathi).
5. EMPATHY WITH HARD RESOLUTION: Offer practical resolutions (instant refunds for damaged/wrong items).`;

  if (classification === 'CRITICAL') {
    return `${base}\nMODE: DEEP REASONING (Crisis & Dispute Engine). Empathize and ask for photo evidence.`;
  }
  return `${base}\nMODE: FAST RESPONSE. Be concise and warm.`;
};

const handler = async (req, res) => {
  try {
    const { sessionId, message, classification = 'STANDARD', stream = false } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ success: false, error: 'sessionId and message are required' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ success: false, error: 'Message exceeds maximum length of 2000 characters' });
    }

    let session = await store.getSession(sessionId);
    if (!session) {
      // Auto-create session if not found (backward compat)
      await store.createSession({
        sessionId, userId: 'auto', platform: 'app', language: 'en',
        orderContext: {}, status: 'AI_ACTIVE', messages: [], agentInfo: null
      });
      session = await store.getSession(sessionId);
    }

    if (session.status !== 'AI_ACTIVE') {
      return res.status(403).json({ success: false, error: `Cannot send message. Session status is ${session.status}` });
    }

    const timestampUser = new Date().toISOString();
    const userMsg = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: timestampUser,
      source: 'customer'
    };
    await store.addMessage(sessionId, userMsg);

    const lowerPrompt = message.toLowerCase();
    const isLateOrderQuery = /\b(late|delay|delayed|deri|kab|when|where.*order|kitna time|status)\b/i.test(message) && 
                             !/\b(never received|not received|nahi mila|gaya hi nahi)\b/i.test(message);
    const escalationKeywords = ['insaan', 'human', 'agent', 'person', 'talk to human', 'connect to human', 'never received', 'not received', 'insan'];
    const isDirectEscalation = !isLateOrderQuery && escalationKeywords.some(kw => lowerPrompt.includes(kw));

    let replyText = '';
    let isTransfer = false;
    let transferReason = null;
    let targetModel = 'gemini-3.6-flash';

    if (isDirectEscalation) {
      replyText = "This issue cannot be handled by the chatbot. I am transferring you to a human agent immediately.";
      isTransfer = true;
      targetModel = "deterministic-guardrail";

      // Detect specific reason from keywords
      if (/\b(never received|not received|nahi mila|gaya hi nahi)\b/i.test(message)) {
        transferReason = 'non_delivery';
      } else if (/\b(insaan|human|agent|person|talk to human|connect to human|insan)\b/i.test(lowerPrompt)) {
        transferReason = 'explicit_human_request';
      } else {
        transferReason = 'customer_escalation';
      }
    } else {
      const systemPrompt = buildSystemPrompt(classification);
      
      try {
        const result = await generateWithFallback(message, { 
          systemInstruction: systemPrompt, 
          temperature: classification === 'CRITICAL' ? 0.4 : 0.7 
        });
        replyText = result.text || '';
        targetModel = result.model || targetModel;
      } catch (err) {
        console.warn('AI generation error:', err.message);
      }

      isTransfer = !isLateOrderQuery && replyText.includes('[TRANSFER]');
      replyText = replyText.replace('[TRANSFER]', '').trim();

      if (isTransfer) {
        transferReason = 'ai_triggered';
      }
    }

    const timestampBot = new Date().toISOString();
    const botMsg = {
      id: `msg_b_${Date.now()}`,
      role: 'model',
      content: replyText,
      timestamp: timestampBot,
      source: 'ai'
    };
    await store.addMessage(sessionId, botMsg);

    const messageCount = await store.getMessageCount(sessionId);

    // Log interaction for research data collection
    await logResearchEvent('AI_MESSAGE', {
      sessionId,
      userId: session.userId,
      platform: session.platform,
      language: session.language,
      userMessage: message,
      aiReply: replyText,
      classification,
      modelUsed: targetModel,
      isTransfer,
      isLateOrderQuery,
      isDirectEscalation,
      responseTimestamp: timestampBot,
      messageCount
    });

    // SSE Streaming
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      res.write(`data: ${JSON.stringify({ type: "chunk", text: replyText })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", is_transfer: isTransfer, model_used: targetModel })}\n\n`);
      res.end();
      return;
    }

    return res.status(200).json({
      success: true,
      sessionId,
      reply: replyText,
      is_transfer: isTransfer,
      model_used: targetModel,
      classification_detected: classification,
      transferReason,
      timestamp: timestampBot
    });

  } catch (error) {
    console.error('Chat message error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = handler;
