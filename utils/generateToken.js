const jwt = require('jsonwebtoken');
require('dotenv').config(); 

const generateToken = (id, isAdmin) => {
  if (!process.env.JWT_SECRET_TOKEN) {
    throw new Error('JWT_SECRET_TOKEN is not defined in the environment variables');
  }

  return jwt.sign(
    { id, isAdmin }, 
    process.env.JWT_SECRET_TOKEN, 
    { expiresIn: '1h' } 
  );
};

module.exports = generateToken;
