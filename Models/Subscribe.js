const mongoose = require('mongoose');

const SubscribeSchema = new mongoose.Schema({
    email: {type: String, required: true, unique: true}
})

const Subscribe = mongoose.model('Subscribe', SubscribeSchema);
module.exports = Subscribe;
