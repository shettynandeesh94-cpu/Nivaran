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
    attachment: { type: String }, // file path/URL (Initial/Before photo)
    reportCount: { type: Number, default: 1 },
    additionalEvidence: [{
        attachment: { type: String },
        description: { type: String },
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reportedAt: { type: Date, default: Date.now }
    }],
    resolutionAttachment: { type: String }, // file path/URL (After/Resolution photo)
    resolutionVerification: {
        isVerified: { type: Boolean, default: false },
        verifiedAt: { type: Date },
        verifiedBy: { type: String, default: 'AI_VISION_AUTO_ENGINE' },
        confidenceScore: { type: Number },
        summary: { type: String },
        beforeAfterComparison: { type: String },
        status: { type: String, enum: ['PENDING', 'VERIFIED_RESOLVED', 'REJECTED_UNRESOLVED'], default: 'PENDING' }
    },
    resolutionCost: { type: Number, default: 0 },
    resolutionExpenses: [{
        item: { type: String, required: true },
        cost: { type: Number, required: true },
        note: { type: String },
        addedAt: { type: Date, default: Date.now }
    }],
    budgetRequestRef: { type: mongoose.Schema.Types.ObjectId, ref: 'BudgetRequest' },
    extensionRequest: {
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String },
        daysRequested: { type: Number, default: 0 },
        status: { type: String, enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'], default: 'NONE' },
        requestedAt: { type: Date }
    },
    adminDelayNote: {
        message: { type: String },
        extendedDays: { type: Number, default: 0 },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sentAt: { type: Date }
    },
    aiAnalysis: {
        detectedTags: [{ type: String }],
        confidenceScore: { type: Number },
        estimatedCost: { type: Number },
        source: { type: String }
    },
    location: {
        latitude: { type: Number },
        longitude: { type: Number },
        address: { type: String }
    }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);