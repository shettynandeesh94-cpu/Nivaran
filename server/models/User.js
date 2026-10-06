const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['citizen', 'corporator', 'admin', 'technician'], default: 'citizen' },
    ward: { type: String }, // for citizens, corporators, technicians
    specialization: { type: String }, // e.g. 'Streetlights', 'Roads', 'Water Supply', 'Sanitation', 'Health'
    phone: { type: String },
    isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);