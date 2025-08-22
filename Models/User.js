const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    isAdmin: { type: Boolean, default: false },

    // For OAuth users
  provider: { type: String }, // 'google' or 'github'
  providerId: { type: String }, // The unique ID from Google or GitHub
});

const User = mongoose.model('User', userSchema);
module.exports = User;
