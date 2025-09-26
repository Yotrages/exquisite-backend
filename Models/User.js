const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    isAdmin: { type: Boolean, default: false },

  provider: { type: String }, 
  providerId: { type: String }, 
});

const User = mongoose.model('User', userSchema);
module.exports = User;
