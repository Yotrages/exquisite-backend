const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createChatCompletion } = require('../utils/openai');
const { logChat } = require('../utils/chatLogger');
const { chatbotLimiter } = require('../middleware/rateLimiters');

// POST /api/ai/chat
// Body: { messages: [{ role: 'user'|'system'|'assistant', content: '...' }], model, temperature, max_tokens }
router.post('/chat', protect, chatbotLimiter, async (req, res) => {
  try {
    const { messages, model, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Field "messages" is required and must be an array of {role, content} objects.' });
    }

    const result = await createChatCompletion({ messages, model, temperature, max_tokens });

    // Attempt to log the user-visible portion (last user message and assistant reply)
    try {
      const lastUser = messages.slice().reverse().find(m => m.role === 'user');
      const assistantText = result?.choices?.[0]?.message?.content || '';
      logChat({ userId: req.user?._id, ip: req.ip, message: lastUser?.content || '', response: assistantText, source: 'openai' });
    } catch (logErr) {
      console.error('AI log failed:', logErr);
    }

    // Return the raw OpenAI response to the client (caller can decide what to use)
    res.json(result);
  } catch (error) {
    console.error('AI route error:', error.message || error);
    // Log the error interaction attempt
    try {
      const lastUser = (req.body.messages || []).slice().reverse().find(m => m.role === 'user');
      logChat({ userId: req.user?._id, ip: req.ip, message: lastUser?.content || '', response: error.message || 'error', source: 'openai-error' });
    } catch (logErr) {
      console.error('AI error log failed:', logErr);
    }

    const status = error.status || 500;
    res.status(status).json({ error: error.message || 'OpenAI request failed' });
  }
});

module.exports = router;