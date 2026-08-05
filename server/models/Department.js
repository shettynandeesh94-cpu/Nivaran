const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // e.g. "Water Supply"
    officerName: { type: String },
    budget: { type: Number, default: 100000 },
    spentBudget: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);