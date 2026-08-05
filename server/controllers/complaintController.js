const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const { detectCategory, detectPriority, calculateDeadline } = require('../utils/smartEngine');

// Map complaint categories to default department names
const CATEGORY_DEPT_MAP = {
    'Water Supply & Sewage': 'Water Supply',
    'Roads & Potholes': 'Roads & Infrastructure',
    'Garbage & Sanitation': 'Sanitation & Waste',
    'Electricity & Streetlights': 'Electricity & Lighting',
    'Public Health & Hygiene': 'Public Health',
};

// Helper: Find or assign department ID based on category
const findDepartmentForCategory = async (category) => {
    const deptName = CATEGORY_DEPT_MAP[category] || 'Roads & Infrastructure';
    let dept = await Department.findOne({ name: deptName });
    if (!dept) {
        dept = await Department.findOne(); // fallback to any existing department
    }
    return dept ? dept._id : null;
};

// Create a new complaint (with smart engine: auto-category, auto-priority, auto-department)
exports.createComplaint = async (req, res) => {
    try {
        const { title, description, ward, attachment } = req.body;

        const category = detectCategory(description);
        const priority = detectPriority(description);
        const deadline = calculateDeadline(priority);
        const departmentId = await findDepartmentForCategory(category);

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
            attachment: attachment || null,
            department: departmentId,
            createdBy: req.user.id,
        });

        await newComplaint.save();
        const populated = await Complaint.findById(newComplaint._id)
            .populate('department')
            .populate('createdBy', 'name email role');

        res.status(201).json({ message: 'Complaint submitted successfully', complaint: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Get all complaints (admin/corporator sees all; citizen sees only their own)
exports.getComplaints = async (req, res) => {
    try {
        let complaints;
        if (req.user.role === 'citizen') {
            complaints = await Complaint.find({ createdBy: req.user.id })
                .populate('department')
                .populate('createdBy', 'name email role')
                .sort({ createdAt: -1 });
        } else {
            complaints = await Complaint.find()
                .populate('department')
                .populate('createdBy', 'name email role')
                .sort({ createdAt: -1 });
        }
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Get a single complaint by ID
exports.getComplaintById = async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate('department')
            .populate('createdBy', 'name email role');

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
        const complaint = await Complaint.findById(req.params.id);

        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        complaint.status = status;
        await complaint.save();

        const populated = await Complaint.findById(complaint._id)
            .populate('department')
            .populate('createdBy', 'name email role');

        res.json({ message: 'Status updated', complaint: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Add resolution expense to a complaint (corporator/admin only)
exports.addResolutionExpense = async (req, res) => {
    try {
        const { item, cost, note } = req.body;
        const complaintId = req.params.id;

        if (!item || cost === undefined || Number(cost) <= 0) {
            return res.status(400).json({ message: 'Item name and positive cost amount are required' });
        }

        const complaint = await Complaint.findById(complaintId);
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        // Add expense item
        const expenseItemCost = Number(cost);
        complaint.resolutionExpenses.push({
            item,
            cost: expenseItemCost,
            note: note || '',
            addedAt: new Date()
        });

        // Recalculate total resolutionCost
        complaint.resolutionCost = complaint.resolutionExpenses.reduce((sum, exp) => sum + exp.cost, 0);

        // If complaint is linked to a department, increase department spentBudget
        let deptWarning = null;
        if (complaint.department) {
            const dept = await Department.findById(complaint.department);
            if (dept) {
                dept.spentBudget += expenseItemCost;
                await dept.save();

                const remaining = dept.budget - dept.spentBudget;
                if (remaining < 0) {
                    deptWarning = `Warning: Department "${dept.name}" budget exceeded by ₹${Math.abs(remaining)}. Please request additional budget from Admin.`;
                }
            }
        }

        await complaint.save();

        const updated = await Complaint.findById(complaintId)
            .populate('department')
            .populate('createdBy', 'name email role');

        res.status(201).json({
            message: 'Resolution expense added successfully',
            complaint: updated,
            warning: deptWarning
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error adding resolution expense', error: err.message });
    }
};

// Corporator / Department asks for time extension on an escalated complaint
exports.requestExtension = async (req, res) => {
    try {
        const { id } = req.params;
        const { daysRequested, reason } = req.body;

        if (!daysRequested || Number(daysRequested) <= 0 || !reason) {
            return res.status(400).json({ message: 'Valid days requested and justification reason are required' });
        }

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        complaint.extensionRequest = {
            requestedBy: req.user.id,
            daysRequested: Number(daysRequested),
            reason,
            status: 'PENDING',
            requestedAt: new Date()
        };

        await complaint.save();
        const populated = await Complaint.findById(id)
            .populate('department')
            .populate('createdBy', 'name email role')
            .populate('extensionRequest.requestedBy', 'name email role');

        res.json({ message: 'SLA extension request submitted to Admin for review', complaint: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error requesting SLA extension', error: err.message });
    }
};

// Admin sends delay clarification note to citizen and optionally grants SLA extension
exports.sendAdminClarification = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, extendedDays, approveExtension } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Clarification message to citizen is required' });
        }

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        const daysToAdd = Number(extendedDays) || (complaint.extensionRequest ? complaint.extensionRequest.daysRequested : 0) || 0;

        complaint.adminDelayNote = {
            message,
            extendedDays: daysToAdd,
            sentBy: req.user.id,
            sentAt: new Date()
        };

        if (approveExtension && daysToAdd > 0) {
            // Update deadline
            const currentDeadline = complaint.deadline ? new Date(complaint.deadline) : new Date();
            const baseDate = currentDeadline > new Date() ? currentDeadline : new Date();
            baseDate.setDate(baseDate.getDate() + daysToAdd);
            complaint.deadline = baseDate;

            // Reset status back to IN_PROGRESS from ESCALATED
            complaint.status = 'IN_PROGRESS';

            if (complaint.extensionRequest) {
                complaint.extensionRequest.status = 'APPROVED';
            }
        } else if (complaint.extensionRequest && complaint.extensionRequest.status === 'PENDING') {
            complaint.extensionRequest.status = 'REJECTED';
        }

        await complaint.save();

        const populated = await Complaint.findById(id)
            .populate('department')
            .populate('createdBy', 'name email role')
            .populate('adminDelayNote.sentBy', 'name email role');

        res.json({ message: 'Clarification note sent to citizen and complaint updated', complaint: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error sending admin clarification', error: err.message });
    }
};