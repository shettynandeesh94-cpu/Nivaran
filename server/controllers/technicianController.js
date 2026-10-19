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
        } = req.body;

        if (!name || !email || !specialization) {
            return res.status(400).json({ message: 'Name, email, and specialization are required fields.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(400).json({ message: 'A user or technician with this email already exists.' });
        }

        const defaultPass = password && password.trim() ? password.trim() : 'password123';
        const hashedPassword = await bcrypt.hash(defaultPass, 10);

        // Auto-assign ward from corporator context if not explicitly provided
        const effectiveWard = ward || panchayat || req.user.ward || req.user.panchayat || 'General Ward';
        const effectiveDistrict = district || req.user.district || '';
        const effectiveTaluk = taluk || req.user.taluk || '';
        const effectivePanchayat = panchayat || req.user.panchayat || '';

        const newTech = new User({
            name: name.trim(),
            email: normalizedEmail,
            phone: phone ? phone.trim() : '',
            password: hashedPassword,
            role: 'technician',
            specialization: specialization.trim(),
            ward: effectiveWard,
            district: effectiveDistrict,
            taluk: effectiveTaluk,
            panchayat: effectivePanchayat,
            isAvailable: true
        });

        await newTech.save();

        console.log(`[TechnicianEngine] 👷 Added New Field Technician: "${newTech.name}" (${newTech.specialization}) for ward "${newTech.ward}" by ${req.user.name}`);

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
        res.status(500).json({ message: 'Failed to create field technician', error: err.message });
    }
};

// Delete / Remove technician
exports.deleteTechnician = async (req, res) => {
    try {
        const { id } = req.params;
        const tech = await User.findOne({ _id: id, role: 'technician' });
        if (!tech) {
            return res.status(404).json({ message: 'Field technician not found.' });
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
