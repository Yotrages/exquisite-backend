const jwt = require('jsonwebtoken');
require('dotenv').config(); // Ensure dotenv is configured here too

const generateToken = (id, isAdmin) => {
  if (!process.env.JWT_SECRET_TOKEN) {
    throw new Error('JWT_SECRET_TOKEN is not defined in the environment variables');
  }

  return jwt.sign(
    { id, isAdmin }, // includes the user ID and isAdmin flag
    process.env.JWT_SECRET_TOKEN, // secret key
    { expiresIn: '1h' } // Token expiration time
  );
};

module.exports = generateToken;
