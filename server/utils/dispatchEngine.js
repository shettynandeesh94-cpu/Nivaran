const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Standard roster of municipal field technicians across departments
const DEFAULT_TECHNICIANS = [
    {
        name: 'Suresh Kumar',
        email: 'suresh.electrician@nivaran.gov',
        password: 'password123',
        role: 'technician',
        specialization: 'Streetlights',
        phone: '+91 98450 11223',
        ward: 'Ward 1',
    },
    {
        name: 'Ramesh Gowda',
        email: 'ramesh.roads@nivaran.gov',
        password: 'password123',
        role: 'technician',
        specialization: 'Roads',
        phone: '+91 98450 22334',
        ward: 'Ward 2',
    },
    {
        name: 'Manjunath Swamy',
        email: 'manjunath.water@nivaran.gov',
        password: 'password123',
        role: 'technician',
        specialization: 'Water Supply',
        phone: '+91 98450 33445',
        ward: 'Ward 3',
    },
    {
        name: 'Pooja Hegde',
        email: 'pooja.sanitation@nivaran.gov',
        password: 'password123',
        role: 'technician',
        specialization: 'Sanitation',
        phone: '+91 98450 44556',
        ward: 'Ward 4',
    },
    {
        name: 'Dr. Anand Rao',
        email: 'anand.health@nivaran.gov',
        password: 'password123',
        role: 'technician',
        specialization: 'Health',
        phone: '+91 98450 55667',
        ward: 'Ward 5',
    },
];

// Mapping complaint categories to technician specialization
const CATEGORY_SPECIALIZATION_MAP = {
    'Streetlights': 'Streetlights',
    'Electricity & Streetlights': 'Streetlights',
    'Electricity & Lighting': 'Streetlights',
    'Roads': 'Roads',
    'Roads & Potholes': 'Roads',
    'Roads & Infrastructure': 'Roads',
    'Water Supply': 'Water Supply',
    'Water Supply & Sewage': 'Water Supply',
    'Sanitation': 'Sanitation',
    'Garbage & Sanitation': 'Sanitation',
    'Sanitation & Waste': 'Sanitation',
    'Health': 'Health',
    'Public Health': 'Health',
    'Public Health & Hygiene': 'Health',
    'Agriculture': 'Roads',
    'NREGA/MGNREGA': 'Roads',
    'General': 'Roads'
};

/**
 * Ensures baseline technicians exist in the database for auto-dispatching.
 */
async function ensureTechniciansSeeded() {
    try {
        for (const tech of DEFAULT_TECHNICIANS) {
            const exists = await User.findOne({ email: tech.email });
            if (!exists) {
                const hashedPassword = await bcrypt.hash(tech.password, 10);
                await User.create({
                    ...tech,
                    password: hashedPassword,
                });
                console.log(`[DispatchEngine] 👷 Seeded Field Technician: ${tech.name} (${tech.specialization})`);
            } else if (!exists.specialization || !exists.phone) {
                exists.specialization = tech.specialization;
                exists.phone = tech.phone;
                exists.role = 'technician';
                await exists.save();
            }
        }
    } catch (err) {
        console.warn('[DispatchEngine] Technician seed warning:', err.message);
    }
}

/**
 * Autonomous Zero-Touch Dispatch Engine
 * Automatically matches a new grievance with the on-duty field technician based on category and ward.
 */
async function autoDispatchComplaint(complaint) {
    try {
        await ensureTechniciansSeeded();

        const cat = complaint.category || 'General';
        const specialization = CATEGORY_SPECIALIZATION_MAP[cat] || 'Roads';

        // 1. Try finding a technician matching exact ward + specialization
        let technician = await User.findOne({
            role: 'technician',
            specialization: specialization,
            ward: complaint.ward
        });

        // 2. Fallback to any technician with matching specialization
        if (!technician) {
            technician = await User.findOne({
                role: 'technician',
                specialization: specialization
            });
        }

        // 3. Fallback to any available technician
        if (!technician) {
            technician = await User.findOne({ role: 'technician' });
        }

        // 4. Ultimate fallback to corporator or admin
        if (!technician) {
            technician = await User.findOne({ role: { $in: ['corporator', 'admin'] } });
        }

        if (technician) {
            complaint.assignedTo = technician._id;
            complaint.assignedAt = new Date();
            complaint.autoDispatched = true;
            // Transition status to IN_PROGRESS directly upon dispatch
            if (complaint.status === 'OPEN') {
                complaint.status = 'IN_PROGRESS';
            }

            console.log(`[DispatchEngine] ⚡ Zero-Touch Auto-Dispatched: Ticket "${complaint.title}" -> ${technician.name} (${technician.specialization || technician.role}, ${technician.phone || ''})`);
            return technician;
        }

        return null;
    } catch (err) {
        console.error('[DispatchEngine] Auto-dispatch error:', err.message);
        return null;
    }
}

module.exports = { autoDispatchComplaint, ensureTechniciansSeeded };
