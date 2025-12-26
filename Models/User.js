const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true,
    },
    password: {
        type: String,
    },
    phone: {
        type: String,
    },
    address: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
    },
    isAdmin: {
        type: Boolean,
        default: false,
        index: true,
    },
    provider: {
        type: String,
    },
    providerId: {
        type: String,
    },
    profilePicture: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastLogin: {
        type: Date,
    },
});

// Create text index for search
userSchema.index({ name: 'text', email: 'text' });

const User = mongoose.model('User', userSchema);
module.exports = User;
