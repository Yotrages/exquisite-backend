const axios = require('axios');

const OPENAI_BASE = 'https://api.openai.com/v1';
const apiKey = process.env.OPENAI_API_KEY;

// Configurable timeout (ms): use small timeout in local dev for quick failures during tests
const DEFAULT_OPENAI_TIMEOUT = process.env.OPENAI_TIMEOUT_MS ? parseInt(process.env.OPENAI_TIMEOUT_MS, 10) : (process.env.NODE_ENV === 'production' ? 60_000 : 5_000);

if (!apiKey) {
  console.warn('Warning: OPENAI_API_KEY is not set in environment variables. OpenAI requests will fail.');
}

async function createChatCompletion({ messages, model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 1024 }) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  if (!Array.isArray(messages)) throw new Error('messages must be an array of {role, content}');

  try {
    const response = await axios.post(
      `${OPENAI_BASE}/chat/completions`,
      {
        model,
        messages,
        temperature,
        max_tokens,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: DEFAULT_OPENAI_TIMEOUT,
      }
    );

    return response.data;
  } catch (error) {
    // Normalize error for logging and upstream handling
    if (error.response) {
      const { status, data } = error.response;
      const msg = data?.error?.message || data || 'OpenAI API returned an error';
      const err = new Error(`OpenAI error: ${msg}`);
      err.status = status;
      throw err;
    }
    throw error;
  }
}

module.exports = {
  createChatCompletion,
};