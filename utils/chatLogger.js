const ChatMessage = require('../Models/ChatMessage');

// Basic PII redaction: emails, phone numbers, long digit sequences
function redactPII(text = '') {
  if (!text) return text;
  let out = String(text);

  // redact email addresses
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

  // redact phone numbers (simple patterns +234, 0xxx, 234xxx, with separators)
  out = out.replace(/(\+?234|0)?[ -]?\d{3,4}[ -]?\d{3,4}[ -]?\d{2,4}/g, (m) => {
    // avoid redacting short numbers that might be words; only redact when digits long enough
    const digits = m.replace(/\D/g, '');
    return digits.length >= 6 ? '[REDACTED_PHONE]' : m;
  });

  // redact possible credit card-like sequences (13-19 digits)
  out = out.replace(/\b\d{13,19}\b/g, '[REDACTED_NUM]');

  // redact account numbers (6+ digits sequences)
  out = out.replace(/\b\d{6,}\b/g, '[REDACTED_NUM]');

  return out;
}

async function logChat({ userId, ip, message, response, source = 'rule-based', metadata = {} }) {
  try {
    const redactedMessage = redactPII(message);
    const redactedResponse = redactPII(response);
    const doc = await ChatMessage.create({
      user: userId || undefined,
      ip,
      message: redactedMessage,
      response: redactedResponse,
      source,
      metadata,
      redacted: true,
    });

    // Do not return sensitive content
    return { id: doc._id };
  } catch (error) {
    console.error('Failed to log chat:', error);
    return null;
  }
}

module.exports = { redactPII, logChat };