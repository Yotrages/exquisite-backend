const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;

if (!SECRET_KEY) {
  throw new Error('PAYSTACK_SECRET_KEY environment variable is required');
}

// Create axios instance for Paystack API calls
const paystackClient = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Initialize payment transaction
const initializeTransaction = async (payload) => {
  try {
    const response = await paystackClient.post('/transaction/initialize', payload);
    return response.data;
  } catch (error) {
    console.error('Paystack initialize error:', error.response?.data || error.message);
    throw error;
  }
};

// Verify payment transaction
const verifyTransaction = async (reference) => {
  try {
    const response = await paystackClient.get(`/transaction/verify/${reference}`);
    return response.data;
  } catch (error) {
    console.error('Paystack verify error:', error.response?.data || error.message);
    throw error;
  }
};

// Get transaction details
const getTransaction = async (transactionId) => {
  try {
    const response = await paystackClient.get(`/transaction/${transactionId}`);
    return response.data;
  } catch (error) {
    console.error('Paystack get transaction error:', error.response?.data || error.message);
    throw error;
  }
};

// List transactions
const listTransactions = async () => {
  try {
    const response = await paystackClient.get('/transaction');
    return response.data;
  } catch (error) {
    console.error('Paystack list transactions error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
  getTransaction,
  listTransactions,
  PAYSTACK_BASE_URL,
  PUBLIC_KEY,
  paystackClient,
};
