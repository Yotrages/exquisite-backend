require('dotenv').config();
const { createChatCompletion } = require('./utils/gemini');

async function testGemini() {
  try {
    console.log('Testing Gemini API...');
    const result = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, can you explain how AI works?' }
      ],
      model: 'gemini-1.5-flash',
      temperature: 0.7,
      max_tokens: 100
    });
    console.log('Success:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testGemini();