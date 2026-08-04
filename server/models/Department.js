const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // e.g. "Water Supply"
    officerName: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);