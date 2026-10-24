require('dotenv').config();
const { createChatCompletion } = require('./utils/gemini');

async function testGemini(message) {
  try {
    console.log(`\n--- Testing: "${message}" ---`);
    const result = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You are a helpful, concise assistant for Exquisite Wears e-commerce store. Answer user questions about products, orders, returns, shipping, payments, and make product recommendations when asked. Use Nigerian Naira (₦) when mentioning prices. Keep replies short and include suggested quick actions where relevant.' },
        { role: 'user', content: message }
      ],
      model: 'gemini-1.5-flash',
      temperature: 0.6,
      max_tokens: 400
    });
    console.log('Success:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runTests() {
  await testGemini("What is AI?");
  await testGemini("Explain AI");
  await testGemini("Can you recommend some summer products?");
  await testGemini("Explain how AI helps e-commerce");
}

runTests();