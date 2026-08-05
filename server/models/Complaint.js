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
    resolutionCost: { type: Number, default: 0 },
    resolutionExpenses: [{
        item: { type: String, required: true },
        cost: { type: Number, required: true },
        note: { type: String },
        addedAt: { type: Date, default: Date.now }
    }],
    budgetRequestRef: { type: mongoose.Schema.Types.ObjectId, ref: 'BudgetRequest' },
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);