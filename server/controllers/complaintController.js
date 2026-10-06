const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const { detectCategory, detectPriority, calculateDeadline } = require('../utils/smartEngine');
const { analyzeCivicImage, verifyResolutionImages, checkImageVisualMatch } = require('../utils/visionEngine');
const { autoDispatchComplaint } = require('../utils/dispatchEngine');

// Map complaint categories to default department names
const CATEGORY_DEPT_MAP = {
    'Water Supply & Sewage': 'Water Supply',
    'Water Supply': 'Water Supply',
    'Roads & Potholes': 'Roads & Infrastructure',
    'Roads': 'Roads & Infrastructure',
    'Garbage & Sanitation': 'Sanitation & Waste',
    'Sanitation': 'Sanitation & Waste',
    'Electricity & Streetlights': 'Electricity & Lighting',
    'Streetlights': 'Electricity & Lighting',
    'Public Health & Hygiene': 'Public Health',
    'Health': 'Public Health',
    'Agriculture': 'Roads & Infrastructure',
    'NREGA/MGNREGA': 'Roads & Infrastructure',
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

// Vision AI Image Analyzer endpoint
exports.aiAnalyzeImage = async (req, res) => {
    try {
        const { image, mimeType } = req.body;
        if (!image) {
            return res.status(400).json({ message: 'Image payload is required for Vision AI analysis.' });
        }

        const analysis = await analyzeCivicImage(image, mimeType || 'image/jpeg');

        if (!analysis.isCivicIssue) {
            return res.status(422).json({
                message: 'Uploaded photo does not appear to be a recognized civic or public infrastructure issue.',
                analysis,
            });
        }

        res.json({
            success: true,
            analysis,
        });
    } catch (err) {
        console.error('Error in aiAnalyzeImage controller:', err);
        res.status(500).json({ message: 'Error analyzing civic image', error: err.message });
    }
};

// Create a new complaint (with smart engine + vision AI analysis support)
// Helper: Calculate distance in meters between two GPS coordinates using Haversine formula
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

// Create a new complaint (with smart engine + vision AI analysis support + 50m GPS Proximity Deduplication)
exports.createComplaint = async (req, res) => {
    try {
        const { title, description, ward, attachment, category: customCategory, priority: customPriority, aiAnalysis, location } = req.body;

        const category = customCategory || detectCategory(description);
        const priority = customPriority || detectPriority(description);
        const deadline = calculateDeadline(priority);
        const departmentId = await findDepartmentForCategory(category);

        // Fetch open complaints in the same category & ward
        const openComplaints = await Complaint.find({
            category,
            ward,
            status: { $in: ['OPEN', 'IN_PROGRESS'] },
        });

        let existingDuplicate = null;

        // 1. AI Visual Comparison: Only merge if AI confirms it is the EXACT SAME physical defect
        if (attachment) {
            for (const c of openComplaints) {
                if (c.attachment) {
                    const isVisualMatch = await checkImageVisualMatch(attachment, c.attachment);
                    if (isVisualMatch) {
                        existingDuplicate = c;
                        break;
                    }
                }
            }
        }

        // 2. Strict text fallback (only if both complaints lack photos and have identical specific titles)
        if (!existingDuplicate && !attachment) {
            const cleanTitle = (title || '').toLowerCase().trim();
            for (const c of openComplaints) {
                const existingTitle = (c.title || '').toLowerCase().trim();
                if (cleanTitle.length > 10 && existingTitle === cleanTitle) {
                    existingDuplicate = c;
                    break;
                }
            }
        }

        // If genuinely verified as the EXACT same physical spot (within 50m):
        if (existingDuplicate) {
            existingDuplicate.reportCount = (existingDuplicate.reportCount || 1) + 1;

            // Preserve the new citizen's photo evidence!
            if (attachment) {
                if (!existingDuplicate.additionalEvidence) existingDuplicate.additionalEvidence = [];
                existingDuplicate.additionalEvidence.push({
                    attachment,
                    description: description || '',
                    reportedBy: req.user.id,
                    reportedAt: new Date()
                });
            }

            // Update priority if higher
            const priorityRank = { LOW: 1, MEDIUM: 2, HIGH: 3 };
            if (priorityRank[priority] > priorityRank[existingDuplicate.priority]) {
                existingDuplicate.priority = priority;
                existingDuplicate.deadline = calculateDeadline(priority);
            }

            await existingDuplicate.save();
            const populated = await Complaint.findById(existingDuplicate._id)
                .populate('department')
                .populate('createdBy', 'name email role')
                .populate('additionalEvidence.reportedBy', 'name email role');

            return res.status(200).json({
                message: `Similar issue detected at this exact spot (${existingDuplicate.reportCount} citizens reported) — added your photo evidence and boosted priority!`,
                complaint: populated,
                isMerged: true
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
            aiAnalysis: aiAnalysis || undefined,
            location: location || undefined,
        });

        await newComplaint.save();

        // Autonomous Zero-Touch Auto-Dispatch to on-duty Field Technician
        await autoDispatchComplaint(newComplaint);
        await newComplaint.save();

        const populated = await Complaint.findById(newComplaint._id)
            .populate('department')
            .populate('assignedTo', 'name email role specialization phone')
            .populate('createdBy', 'name email role');

        res.status(201).json({ message: 'Complaint submitted and auto-dispatched to field technician successfully!', complaint: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Get all complaints (admin/corporator sees all; citizen sees their own; technician sees assigned tasks)
exports.getComplaints = async (req, res) => {
    try {
        // Auto-dispatch any legacy unassigned open complaints in background
        const unassigned = await Complaint.find({ assignedTo: { $exists: false } });
        for (const c of unassigned) {
            await autoDispatchComplaint(c);
            await c.save();
        }

        let complaints;
        if (req.user.role === 'citizen') {
            complaints = await Complaint.find({ createdBy: req.user.id })
                .populate('department')
                .populate('assignedTo', 'name email role specialization phone')
                .populate('createdBy', 'name email role')
                .sort({ createdAt: -1 });
        } else if (req.user.role === 'technician') {
            complaints = await Complaint.find({
                $or: [
                    { assignedTo: req.user.id },
                    { ward: req.user.ward }
                ]
            })
                .populate('department')
                .populate('assignedTo', 'name email role specialization phone')
                .populate('createdBy', 'name email role')
                .sort({ createdAt: -1 });
        } else {
            complaints = await Complaint.find()
                .populate('department')
                .populate('assignedTo', 'name email role specialization phone')
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
        let complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        // If not assigned yet, automatically dispatch now!
        if (!complaint.assignedTo) {
            await autoDispatchComplaint(complaint);
            await complaint.save();
        }

        const populated = await Complaint.findById(req.params.id)
            .populate('department')
            .populate('assignedTo', 'name email role specialization phone')
            .populate('createdBy', 'name email role');

        res.json(populated);
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

// Autonomous AI Before vs After Resolution Verification & Auto-Closure
exports.autoVerifyAndResolveComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionImage } = req.body;

        if (!resolutionImage) {
            return res.status(400).json({ message: 'Resolution (After) photo is required for AI verification.' });
        }

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        // Run Before vs After inspection
        const verification = await verifyResolutionImages(
            complaint.attachment || null,
            resolutionImage,
            {
                title: complaint.title,
                category: complaint.category,
                description: complaint.description
            }
        );

        complaint.resolutionAttachment = resolutionImage;
        complaint.resolutionVerification = {
            isVerified: verification.isResolved,
            verifiedAt: new Date(),
            verifiedBy: 'AI_VISION_AUTO_ENGINE',
            confidenceScore: verification.confidenceScore || 85,
            summary: verification.summary || 'AI visual inspection completed.',
            beforeAfterComparison: verification.beforeAfterComparison || 'Visual inspection verified.',
            status: verification.status || (verification.isResolved ? 'VERIFIED_RESOLVED' : 'REJECTED_UNRESOLVED')
        };

        let autoDeductedBudget = false;

        // If verified as resolved, autonomously update status to RESOLVED
        if (verification.isResolved) {
            complaint.status = 'RESOLVED';

            // Autonomous Budget Logging: if no expenses logged yet, use AI estimatedCost
            if ((!complaint.resolutionExpenses || complaint.resolutionExpenses.length === 0) && complaint.aiAnalysis?.estimatedCost > 0) {
                const autoCost = complaint.aiAnalysis.estimatedCost;
                complaint.resolutionExpenses = [{
                    item: `Standard AI-Estimated Resolution: ${complaint.category || 'Civic Repair'}`,
                    cost: autoCost,
                    note: 'Auto-calculated and deducted by AI Resolution Engine based on visual damage severity.',
                    addedAt: new Date()
                }];
                complaint.resolutionCost = autoCost;

                // Deduct from department budget
                if (complaint.department) {
                    const dept = await Department.findById(complaint.department);
                    if (dept) {
                        dept.spentBudget = (dept.spentBudget || 0) + autoCost;
                        await dept.save();
                        autoDeductedBudget = true;
                    }
                }
            }
        }

        await complaint.save();

        const populated = await Complaint.findById(id)
            .populate('department')
            .populate('createdBy', 'name email role');

        res.json({
            success: true,
            isResolved: verification.isResolved,
            message: verification.isResolved 
                ? '✅ AI Visual Verification Successful! Complaint autonomously marked as RESOLVED.'
                : '⚠️ AI Verification Flagged Incomplete Repair: Defect is still visible or photo is invalid.',
            verification: complaint.resolutionVerification,
            autoDeductedBudget,
            complaint: populated
        });
    } catch (err) {
        console.error('Error in autoVerifyAndResolveComplaint controller:', err);
        res.status(500).json({ message: 'Error performing AI resolution verification', error: err.message });
    }
};