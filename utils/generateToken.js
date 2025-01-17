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

// Example of generating an admin token
const userId = 'adminUserId';  // Use a real admin user ID here
const isAdmin = true; // Admin flag is true for the admin user

const token = generateToken(userId, isAdmin);
console.log('Generated JWT Token for Admin:', token);

module.exports = generateToken;
