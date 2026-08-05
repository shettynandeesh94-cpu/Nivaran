const Department = require('../models/Department');
const BudgetRequest = require('../models/BudgetRequest');

// Default departments list to auto-seed if database empty
const DEFAULT_DEPARTMENTS = [
    { name: 'Water Supply', officerName: 'Rajesh Kumar', budget: 150000, spentBudget: 0 },
    { name: 'Roads & Infrastructure', officerName: 'Priya Sharma', budget: 200000, spentBudget: 0 },
    { name: 'Sanitation & Waste', officerName: 'Amit Patel', budget: 100000, spentBudget: 0 },
    { name: 'Electricity & Lighting', officerName: 'Suresh V', budget: 120000, spentBudget: 0 },
    { name: 'Public Health', officerName: 'Dr. Sunita Rao', budget: 100000, spentBudget: 0 },
];

// Helper: Ensure default departments exist
const ensureDefaultDepartments = async () => {
    const count = await Department.countDocuments();
    if (count === 0) {
        await Department.insertMany(DEFAULT_DEPARTMENTS);
    }
};

// Get all department budgets
exports.getDepartmentBudgets = async (req, res) => {
    try {
        await ensureDefaultDepartments();
        const departments = await Department.find().sort({ name: 1 });
        res.json(departments);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching department budgets', error: err.message });
    }
};

// Create a new Budget Request (Corporator / Department)
exports.createBudgetRequest = async (req, res) => {
    try {
        const { departmentId, amount, reason, complaintId } = req.body;

        if (!departmentId || !amount || !reason) {
            return res.status(400).json({ message: 'Department, amount, and reason are required' });
        }

        const dept = await Department.findById(departmentId);
        if (!dept) return res.status(404).json({ message: 'Department not found' });

        const newRequest = new BudgetRequest({
            department: departmentId,
            requestedBy: req.user.id,
            complaint: complaintId || null,
            amount: Number(amount),
            reason,
            status: 'PENDING',
        });

        await newRequest.save();
        const populated = await BudgetRequest.findById(newRequest._id)
            .populate('department')
            .populate('requestedBy', 'name email role')
            .populate('complaint', 'title ward category');

        res.status(201).json({ message: 'Budget request submitted to Admin', budgetRequest: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error creating budget request', error: err.message });
    }
};

// Get list of Budget Requests (Admin sees all; Corporator sees their own or department's)
exports.getBudgetRequests = async (req, res) => {
    try {
        let requests;
        if (req.user.role === 'admin') {
            requests = await BudgetRequest.find()
                .populate('department')
                .populate('requestedBy', 'name email role')
                .populate('complaint', 'title ward category status')
                .sort({ createdAt: -1 });
        } else {
            requests = await BudgetRequest.find({ requestedBy: req.user.id })
                .populate('department')
                .populate('requestedBy', 'name email role')
                .populate('complaint', 'title ward category status')
                .sort({ createdAt: -1 });
        }
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching budget requests', error: err.message });
    }
};

// Process Budget Request - Approve or Reject (Admin Only)
exports.actionBudgetRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminNote } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ message: 'Status must be APPROVED or REJECTED' });
        }

        const budgetReq = await BudgetRequest.findById(id);
        if (!budgetReq) return res.status(404).json({ message: 'Budget request not found' });

        if (budgetReq.status !== 'PENDING') {
            return res.status(400).json({ message: `Request has already been ${budgetReq.status.toLowerCase()}` });
        }

        budgetReq.status = status;
        if (adminNote) budgetReq.adminNote = adminNote;
        budgetReq.processedBy = req.user.id;
        budgetReq.processedAt = new Date();
        await budgetReq.save();

        // If approved, top up the department budget
        if (status === 'APPROVED') {
            await Department.findByIdAndUpdate(budgetReq.department, {
                $inc: { budget: budgetReq.amount }
            });
        }

        const updated = await BudgetRequest.findById(id)
            .populate('department')
            .populate('requestedBy', 'name email role');

        res.json({ message: `Budget request ${status.toLowerCase()} successfully`, budgetRequest: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error processing budget request', error: err.message });
    }
};

// Directly update department total budget (Admin Only)
exports.updateDepartmentBudget = async (req, res) => {
    try {
        const { id } = req.params;
        const { budget } = req.body;

        if (budget === undefined || Number(budget) < 0) {
            return res.status(400).json({ message: 'Valid budget amount is required' });
        }

        const department = await Department.findByIdAndUpdate(
            id,
            { budget: Number(budget) },
            { new: true }
        );

        if (!department) return res.status(404).json({ message: 'Department not found' });

        res.json({ message: 'Department budget updated successfully', department });
    } catch (err) {
        res.status(500).json({ message: 'Server error updating department budget', error: err.message });
    }
};
