const Complaint = require('../models/Complaint');
const { detectCategory, detectPriority, calculateDeadline } = require('../utils/smartEngine');

// Create a new complaint (with smart engine: auto-category, auto-priority, duplicate detection)
exports.createComplaint = async (req, res) => {
    try {
        const { title, description, ward } = req.body;

        const category = detectCategory(description);
        const priority = detectPriority(description);
        const deadline = calculateDeadline(priority);

        // Duplicate detection: same category + ward + still open
        const existingDuplicate = await Complaint.findOne({
            category,
            ward,
            status: { $in: ['OPEN', 'IN_PROGRESS'] },
        });

        if (existingDuplicate) {
            const priorityRank = { LOW: 1, MEDIUM: 2, HIGH: 3 };
            if (priorityRank[priority] > priorityRank[existingDuplicate.priority]) {
                existingDuplicate.priority = priority;
                existingDuplicate.deadline = calculateDeadline(priority);
                await existingDuplicate.save();
            }
            return res.status(200).json({
                message: 'Similar open complaint already exists in this ward — merged and priority updated if needed',
                complaint: existingDuplicate,
            });
        }

        const newComplaint = new Complaint({
            title,
            description,
            ward,
            category,
            priority,
            deadline,
            createdBy: req.user.id,
        });

        await newComplaint.save();
        res.status(201).json({ message: 'Complaint submitted successfully', complaint: newComplaint });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Get all complaints (admin/corporator sees all; citizen sees only their own)
exports.getComplaints = async (req, res) => {
    try {
        let complaints;
        if (req.user.role === 'citizen') {
            complaints = await Complaint.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
        } else {
            complaints = await Complaint.find().sort({ createdAt: -1 });
        }
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Get a single complaint by ID
exports.getComplaintById = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
        res.json(complaint);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Update complaint status (corporator/admin only)
exports.updateComplaintStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const complaint = await Complaint.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
        res.json({ message: 'Status updated', complaint });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};