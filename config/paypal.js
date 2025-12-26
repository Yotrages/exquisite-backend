const { Client } = require("@paypal/paypal-server-sdk");

function createClient() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables are required');
  }

  return new Client({
    clientId: clientId,
    clientSecret: clientSecret,
    environment: mode === 'production' ? 'production' : 'sandbox',
  });
}

module.exports = {
  client: createClient(),
};
