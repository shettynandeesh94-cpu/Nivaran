const User = require('../models/User');
const Complaint = require('../models/Complaint');
const bcrypt = require('bcryptjs');

// Get all field technicians with workload stats
exports.getTechnicians = async (req, res) => {
    try {
        const query = { role: 'technician' };

        // If corporator, optionally filter by district/taluk or return all
        const technicians = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });

        // Enrich technicians with active and resolved tasks count
        const enriched = await Promise.all(
            technicians.map(async (tech) => {
                const [activeCount, resolvedCount] = await Promise.all([
                    Complaint.countDocuments({ assignedTo: tech._id, status: { $ne: 'RESOLVED' } }),
                    Complaint.countDocuments({ assignedTo: tech._id, status: 'RESOLVED' })
                ]);
                return {
                    ...tech.toObject(),
                    activeTasks: activeCount,
                    resolvedTasks: resolvedCount,
                };
            })
        );

        res.json({
            success: true,
            count: enriched.length,
            technicians: enriched
        });
    } catch (err) {
        console.error('Error in getTechnicians:', err);
        res.status(500).json({ message: 'Error retrieving field technicians', error: err.message });
    }
};

// Add a new technician (Corporator / Admin only)
exports.addTechnician = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            specialization,
            ward,
            district,
            taluk,
            panchayat,
            password
        } = req.body || {};

        const nameStr = String(name || '').trim();
        const emailStr = String(email || '').trim().toLowerCase();
        const phoneStr = String(phone || '').trim();
        const specStr = String(specialization || '').trim();
        const passStr = password && String(password).trim() ? String(password).trim() : 'password123';

        if (!nameStr) {
            return res.status(400).json({ message: 'Technician name is required.' });
        }

        if (!emailStr || !emailStr.includes('@')) {
            return res.status(400).json({ message: 'A valid official email address is required.' });
        }

        if (!specStr) {
            return res.status(400).json({ message: 'Department specialization is required.' });
        }

        // Case-insensitive check to prevent duplicate emails
        const existing = await User.findOne({
            email: { $regex: new RegExp(`^${emailStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
        if (existing) {
            return res.status(400).json({ message: `A user or technician with email "${emailStr}" already exists.` });
        }

        const hashedPassword = await bcrypt.hash(passStr, 10);

        // Auto-assign ward from corporator context if not explicitly provided
        const effectiveWard = (ward && String(ward).trim()) || 
                              (panchayat && String(panchayat).trim()) || 
                              req.user?.ward || 
                              req.user?.panchayat || 
                              'General Ward';
        const effectiveDistrict = (district && String(district).trim()) || req.user?.district || '';
        const effectiveTaluk = (taluk && String(taluk).trim()) || req.user?.taluk || '';
        const effectivePanchayat = (panchayat && String(panchayat).trim()) || req.user?.panchayat || '';

        const newTech = new User({
            name: nameStr,
            email: emailStr,
            phone: phoneStr,
            password: hashedPassword,
            role: 'technician',
            specialization: specStr,
            ward: effectiveWard,
            district: effectiveDistrict,
            taluk: effectiveTaluk,
            panchayat: effectivePanchayat,
            isAvailable: true
        });

        await newTech.save();

        const creatorName = req.user?.name || req.user?.email || 'Municipal Authority';
        console.log(`[TechnicianEngine] 👷 Added New Field Technician: "${newTech.name}" (${newTech.specialization}) for ward "${newTech.ward}" by ${creatorName}`);

        const responseTech = newTech.toObject();
        delete responseTech.password;

        res.status(201).json({
            success: true,
            message: `Technician ${newTech.name} successfully registered and added to roster!`,
            technician: {
                ...responseTech,
                activeTasks: 0,
                resolvedTasks: 0
            }
        });
    } catch (err) {
        console.error('Error in addTechnician:', err);
        // Duplicate key error in MongoDB
        if (err.code === 11000) {
            return res.status(400).json({
                message: 'A user or technician with this email address already exists.',
                error: err.message
            });
        }
        // Mongoose Schema Validation error
        if (err.name === 'ValidationError') {
            const validationMsg = Object.values(err.errors || {}).map(e => e.message).join(', ') || 'Validation error';
            return res.status(400).json({
                message: validationMsg,
                error: err.message
            });
        }
        res.status(500).json({ 
            message: 'Failed to create field technician due to server error. Please try again.', 
            error: err.message 
        });
    }
};

// Delete / Remove technician
exports.deleteTechnician = async (req, res) => {
    try {
        const { id } = req.params;
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid technician ID.' });
        }

        let tech = await User.findOne({ _id: id, role: 'technician' });
        if (!tech) {
            tech = await User.findById(id);
        }
        if (!tech) {
            return res.status(404).json({ message: 'Field technician not found or already removed.' });
        }

        // Reassign or unassign pending complaints
        await Complaint.updateMany(
            { assignedTo: tech._id, status: { $ne: 'RESOLVED' } },
            { $unset: { assignedTo: '' } }
        );

        await User.findByIdAndDelete(id);

        console.log(`[TechnicianEngine] 🗑️ Removed Field Technician: ${tech.name} (${id})`);
        res.json({ success: true, message: `Technician ${tech.name} removed from roster.` });
    } catch (err) {
        console.error('Error in deleteTechnician:', err);
        res.status(500).json({ message: 'Error removing technician', error: err.message });
    }
};

// Re-assign complaint to a technician
exports.assignComplaintTechnician = async (req, res) => {
    try {
        const { complaintId } = req.params;
        const { technicianId } = req.body;

        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found.' });
        }

        if (!technicianId) {
            complaint.assignedTo = null;
            await complaint.save();
            return res.json({ success: true, message: 'Technician assignment cleared.', complaint });
        }

        const technician = await User.findOne({ _id: technicianId, role: 'technician' });
        if (!technician) {
            return res.status(404).json({ message: 'Technician not found.' });
        }

        complaint.assignedTo = technician._id;
        if (complaint.status === 'PENDING') {
            complaint.status = 'IN_PROGRESS';
        }
        await complaint.save();

        const populated = await Complaint.findById(complaintId)
            .populate('assignedTo', 'name email role specialization phone');

        console.log(`[TechnicianEngine] 🔄 Grievance "${complaint.title}" reassigned to ${technician.name}`);

        res.json({
            success: true,
            message: `Grievance successfully assigned to ${technician.name}!`,
            complaint: populated
        });
    } catch (err) {
        console.error('Error in assignComplaintTechnician:', err);
        res.status(500).json({ message: 'Failed to assign technician', error: err.message });
    }
};
