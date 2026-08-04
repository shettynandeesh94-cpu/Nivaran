const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String }, // auto-filled by keyword matching
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED'], default: 'OPEN' },
    ward: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    deadline: { type: Date },
    attachment: { type: String }, // file path/URL
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);