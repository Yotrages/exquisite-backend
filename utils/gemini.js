const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('Warning: GEMINI_API_KEY is not set in environment variables. Gemini requests will fail.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Configurable timeout (ms): default 30s for AI responses to avoid hanging
const DEFAULT_GEMINI_TIMEOUT = process.env.GEMINI_TIMEOUT_MS ? parseInt(process.env.GEMINI_TIMEOUT_MS, 10) : 30000;

async function createChatCompletion({ messages, model = 'gemini-1.5-flash', temperature = 0.7, max_tokens = 1024 }) {
  if (!genAI) throw new Error('GEMINI_API_KEY is not configured');
  if (!Array.isArray(messages)) throw new Error('messages must be an array of {role, content}');

  try {
    // Convert OpenAI format to Gemini format
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');

    // Map common model names to valid Gemini model names (from AI Studio)
    const modelMap = {
      'gemini-3.8-flash': 'gemini-3.8-flash',
      'gemini-3.5-flash': 'gemini-3.5-flash',
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-1.5-flash': 'gemini-3.8-flash',  // fallback to stable model
      'gemini-1.5-pro': 'gemini-2.5-pro',      // fallback to stable model
      'gemini-2.0-flash': 'gemini-3.8-flash',  // fallback to stable model
      'gpt-3.5-turbo': 'gemini-3.8-flash',
      'gpt-4': 'gemini-2.5-pro',
    };

    const actualModel = modelMap[model] || 'gemini-3.8-flash';

    const geminiModel = genAI.getGenerativeModel({
      model: actualModel,
      systemInstruction: systemInstruction || undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: max_tokens,
      },
    });

    // Build conversation history for Gemini
    const history = userMessages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const lastMessage = userMessages[userMessages.length - 1];

    // Helper to run a promise with timeout
    const withTimeout = (promise, ms, timeoutError = new Error('Request timeout')) => {
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(timeoutError), ms);
      });
      return Promise.race([
        promise.finally(() => clearTimeout(timeoutId)),
        timeoutPromise
      ]);
    };

    let result;
    const apiCall = history.length > 0
      ? (() => { const chat = geminiModel.startChat({ history }); return chat.sendMessage(lastMessage.content); })()
      : geminiModel.generateContent(lastMessage.content);

    result = await withTimeout(apiCall, DEFAULT_GEMINI_TIMEOUT);

    const response = await result.response;
    const text = response.text();

    // Return in OpenAI-compatible format
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: text,
        },
        finish_reason: 'stop',
        index: 0,
      }],
      usage: {
        prompt_tokens: 0, // Gemini doesn't provide token counts in the same way
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini error: ${error.message || error}`);
  }
}

module.exports = {
  createChatCompletion,
};