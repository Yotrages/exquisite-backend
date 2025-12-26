const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const { createChatCompletion } = require('../utils/openai');
const { logChat, redactPII } = require('../utils/chatLogger');

// Chatbot with optional OpenAI fallback
router.post('/chat', require('../middleware/rateLimiters').chatbotLimiter, async (req, res) => {
  try {
    const { message, useAI, model, temperature, max_tokens } = req.body;
    const lowerMessage = (message || '').toLowerCase();
    let intent = 'general';

    // If client requested AI or message looks like an AI request, try OpenAI first
    const aiKeywords = ['explain', 'summarize', 'recommend', 'review', 'generate', 'write', 'describe'];
    const looksLikeAI = aiKeywords.some(k => lowerMessage.includes(k)) || (message && message.length > 120);
    const shouldCallAI = Boolean(useAI) || looksLikeAI;

    if (shouldCallAI) {
      try {
        // Construct a helpful system prompt tailored to the store
        const systemPrompt = `You are a helpful, concise assistant for Exquisite Wears e-commerce store. Answer user questions about products, orders, returns, shipping, payments, and make product recommendations when asked. Use Nigerian Naira (₦) when mentioning prices. Keep replies short and include suggested quick actions where relevant.`;

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ];

        const aiResult = await createChatCompletion({ messages, model: model || 'gpt-3.5-turbo', temperature: temperature ?? 0.6, max_tokens: max_tokens ?? 400 });
        const assistantMessage = aiResult?.choices?.[0]?.message?.content;

        if (assistantMessage) {
          // Log the interaction asynchronously (do not block response on logging)
          logChat({ userId: req.user?._id, ip: req.ip, message, response: assistantMessage, source: 'openai' });
          return res.json({ reply: assistantMessage, suggestions: [] , source: 'openai' });
        }
        // if AI failed to return a message, fall through to rule-based
      } catch (aiErr) {
        console.error('OpenAI call failed, falling back to rule-based chatbot:', aiErr.message || aiErr);
        // continue to rule-based fallback
      }
    }

    // Rule-based fallback (fast, deterministic responses)
    let reply = '';
    let suggestions = [];

    // Order tracking
    if (lowerMessage.includes('track') || lowerMessage.includes('order')) {
      intent = 'track-order';
      if (req.user) {
        const recentOrders = await Order.find({ user: req.user._id })
          .sort({ createdAt: -1 })
          .limit(3);
        
        if (recentOrders.length > 0) {
          reply = `You have ${recentOrders.length} recent order(s):\n\n`;
          recentOrders.forEach((order, idx) => {
            reply += `${idx + 1}. Order #${order._id.toString().slice(-8)} - ${order.status}\n`;
          });
          suggestions = ['View all orders', 'Track specific order'];
        } else {
          reply = "You don't have any orders yet. Would you like to browse our products?";
          suggestions = ['Browse products', 'View deals'];
        }
      } else {
        reply = "Please log in to track your orders.";
        suggestions = ['Log in', 'Create account'];
      }
    }
    
    // Product search
    else if (lowerMessage.includes('find') || lowerMessage.includes('search') || lowerMessage.includes('product')) {
      intent = 'product-search';
      // Extract potential product name
      const searchTerms = lowerMessage.replace(/(find|search|product|show me)/g, '').trim();
      
      if (searchTerms) {
        const products = await Product.find({
          name: { $regex: searchTerms, $options: 'i' }
        }).limit(5);

        if (products.length > 0) {
          reply = `I found ${products.length} product(s) matching "${searchTerms}":\n\n`;
          products.forEach((p, idx) => {
            reply += `${idx + 1}. ${p.name} - ₦${p.price.toLocaleString()}\n`;
          });
          suggestions = ['View these products', 'Search something else'];
        } else {
          reply = `No products found for "${searchTerms}". Try different keywords or browse our categories.`;
          suggestions = ['Browse all products', 'View categories'];
        }
      } else {
        reply = "What product are you looking for? Tell me the name or category.";
        suggestions = ['Electronics', 'Fashion', 'Home & Garden'];
      }
    }
    
    // Returns
    else if (lowerMessage.includes('return') || lowerMessage.includes('refund')) {
      intent = 'returns';
      reply = "Our return policy:\n\n" +
             "• 7-day return window\n" +
             "• Item must be unused\n" +
             "• Original packaging required\n" +
             "• Refund within 5-7 business days\n\n" +
             "Would you like to start a return?";
      suggestions = ['Start return', 'Contact support', 'Return exceptions'];
    }
    
    // Payment
    else if (lowerMessage.includes('payment') || lowerMessage.includes('pay')) {
      intent = 'payment';
      reply = "We accept:\n\n" +
             "• Credit/Debit Cards (Visa, Mastercard)\n" +
             "• Bank Transfer\n" +
             "• USSD Payment\n" +
             "• Paystack\n\n" +
             "All payments are 100% secure and encrypted.";
      suggestions = ['Payment failed?', 'Request invoice'];
    }
    
    // Shipping
    else if (lowerMessage.includes('shipping') || lowerMessage.includes('delivery')) {
      intent = 'shipping';
      reply = "Delivery Information:\n\n" +
             "• Standard: 3-7 business days\n" +
             "• Express: 1-2 business days (extra cost)\n" +
             "• FREE shipping on orders above ₦50,000!\n\n" +
             "We deliver nationwide.";
      suggestions = ['Track delivery', 'Delivery locations', 'Shipping costs'];
    }
    
    // Price inquiry
    else if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      intent = 'price-query';
      reply = "To check prices:\n\n" +
             "• Search for specific products\n" +
             "• Browse by category\n" +
             "• Check our deals section\n\n" +
             "Tell me what product you're interested in!";
      suggestions = ['View deals', 'Browse products'];
    }
    
    // Discount/Coupon
    else if (lowerMessage.includes('discount') || lowerMessage.includes('coupon') || lowerMessage.includes('promo')) {
      intent = 'discount';
      reply = "Current offers:\n\n" +
             "• Use code SAVE10 for 10% off\n" +
             "• Free shipping on orders above ₦50,000\n" +
             "• Check our Flash Deals section\n\n" +
             "Deals update daily!";
      suggestions = ['View flash deals', 'Apply coupon'];
    }
    
    // Account issues
    else if (lowerMessage.includes('account') || lowerMessage.includes('login') || lowerMessage.includes('password')) {
      intent = 'account-help';
      reply = "Account Help:\n\n" +
             "• Forgot password? Use the 'Forgot Password' link\n" +
             "• Can't login? Check your email/password\n" +
             "• Need to update info? Go to Settings\n\n" +
             "Still having issues?";
      suggestions = ['Reset password', 'Contact support'];
    }
    
    // Contact support
    else if (lowerMessage.includes('contact') || lowerMessage.includes('support') || lowerMessage.includes('help')) {
      intent = 'support-contact';
      reply = "Contact Support:\n\n" +
             "• Email: support@exquisitewears.com\n" +
             "• Phone: +234 814 553 4450\n" +
             "• WhatsApp: Available 9AM-6PM\n\n" +
             "We respond within 24 hours!";
      suggestions = ['Email support', 'Call now'];
    }
    
    // Greeting
    else if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
      intent = 'greeting';
      reply = "Hello! 👋 Welcome to Exquisite Wears!\n\n" +
             "I'm your shopping assistant. I can help you with:\n" +
             "• Finding products\n" +
             "• Tracking orders\n" +
             "• Returns & refunds\n" +
             "• Payment info\n\n" +
             "What can I help you with today?";
      suggestions = ['Track my order', 'Find products', 'View deals'];
    }
    
    // Thanks
    else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
      intent = 'thanks';
      reply = "You're welcome! 😊\n\nIs there anything else I can help you with?";
      suggestions = ['Browse products', 'Track order', 'Contact support'];
    }
    
    // Default
    else {
      intent = 'default';
      reply = "I'm here to help! I can assist you with:\n\n" +
             "• Tracking orders\n" +
             "• Finding products\n" +
             "• Returns & refunds\n" +
             "• Payment options\n" +
             "• Shipping info\n" +
             "• Account issues\n\n" +
             "What would you like to know?";
      suggestions = ['Track my order', 'Find products', 'Contact support'];
    }

    // Log the interaction asynchronously (do not block response on logging)
    logChat({ userId: req.user?._id, ip: req.ip, message, response: reply, source: 'rule-based', metadata: { intent } });

    res.status(200).json({ reply, suggestions });
  } catch (error) {
    console.error('Chatbot error:', error);
    // Attempt to log error/fallback interaction
    logChat({ userId: req.user?._id, ip: req.ip, message: message || '', response: error.message || 'internal error', source: 'error' });
    res.status(500).json({
      reply: "I'm having trouble processing your request. Please try again or contact support.",
      suggestions: ['Try again', 'Contact support']
    });
  }
});

// Get chatbot suggestions
router.get('/suggestions', (req, res) => {
  const suggestions = [
    'Track my order',
    'Find products',
    'Return policy',
    'Payment options',
    'Shipping info',
    'Contact support',
    'View deals',
    'Apply coupon'
  ];
  res.status(200).json({ suggestions });
});

module.exports = router;
