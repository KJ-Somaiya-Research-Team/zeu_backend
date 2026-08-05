// api/v1/chat/session/start.js — Create new chat session
const store = require('../../_utils/store');
const { logResearchEvent } = require('../../_utils/logger');

const handler = async (req, res) => {
  try {
    const { userId, platform = 'web', language = 'en', orderContext = {} } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const sessionId = `ses_${Math.random().toString(36).substr(2, 9)}`;
    
    let welcomeMessage = "Hello! I am Zeu's AI Assistant. How can I help you today?";
    if (language === 'hi') {
      welcomeMessage = "Namaste! Main Zeu AI Assistant hoon. Aapki kya madad kar sakta hoon? 🙏";
    } else if (language === 'mr') {
      welcomeMessage = "Namaskar! Me Zeu AI Assistant aahe. Me tumchi kay madat karu shakto? 🙏";
    }

    const createdAt = new Date().toISOString();

    await store.createSession({
      sessionId,
      userId,
      platform,
      language,
      orderContext,
      status: 'AI_ACTIVE',
      messages: [
        {
          id: 'msg_welcome',
          role: 'model',
          content: welcomeMessage,
          timestamp: createdAt,
          source: 'ai'
        }
      ],
      agentInfo: null
    });

    // Log session start for research data collection
    await logResearchEvent('SESSION_START', {
      sessionId,
      userId,
      platform,
      language,
      orderContext,
      createdAt
    });

    return res.status(201).json({
      success: true,
      sessionId,
      status: 'AI_ACTIVE',
      createdAt,
      welcomeMessage,
      contextLoaded: orderContext
    });

  } catch (error) {
    console.error('Session start error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = handler;
