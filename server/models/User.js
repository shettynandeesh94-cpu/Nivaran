const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['citizen', 'corporator', 'admin'], default: 'citizen' },
    ward: { type: String }, // for citizens and corporators
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);