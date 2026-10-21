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

const Setting = require('../models/Setting');

/**
 * Ensures baseline technicians exist in the database for auto-dispatching.
 * Runs once on initial deployment only. Never resurrects technicians deleted by an admin or corporator.
 */
async function ensureTechniciansSeeded() {
    try {
        // 1. If technician seeding was already performed and recorded, do not seed again
        const alreadySeeded = await Setting.findOne({ key: 'technicians_initial_seed_done' });
        if (alreadySeeded) {
            return;
        }

        // 2. If technicians already exist in the database, mark seeding as completed to prevent overriding removals
        const existingTechsCount = await User.countDocuments({ role: 'technician' });
        if (existingTechsCount > 0) {
            await Setting.findOneAndUpdate(
                { key: 'technicians_initial_seed_done' },
                { key: 'technicians_initial_seed_done', value: true },
                { upsert: true, returnDocument: 'after' }
            );
            return;
        }

        // 3. For an empty database on fresh installation, seed the initial roster once
        for (const tech of DEFAULT_TECHNICIANS) {
            const exists = await User.findOne({ 
                email: { $regex: new RegExp(`^${tech.email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } 
            });
            if (!exists) {
                const hashedPassword = await bcrypt.hash(tech.password, 10);
                await User.create({
                    ...tech,
                    password: hashedPassword,
                });
                console.log(`[DispatchEngine] 👷 Seeded Initial Field Technician: ${tech.name} (${tech.specialization})`);
            }
        }

        await Setting.findOneAndUpdate(
            { key: 'technicians_initial_seed_done' },
            { key: 'technicians_initial_seed_done', value: true },
            { upsert: true, returnDocument: 'after' }
        );
        console.log('[DispatchEngine] ✅ Initial baseline technicians roster seeded and locked.');
    } catch (err) {
        console.warn('[DispatchEngine] Technician seed warning:', err.message);
    }
}

/**
 * Autonomous Zero-Touch Dispatch Engine
 * Automatically matches a new grievance with an on-duty field technician based on category and ward.
 * Dispatches only to active, existing technicians in the database without re-seeding deleted ones.
 */
async function autoDispatchComplaint(complaint) {
    try {
        const cat = complaint.category || 'General';
        const specialization = CATEGORY_SPECIALIZATION_MAP[cat] || cat || 'General';
        const specRegex = new RegExp(specialization.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');

        // 1. Try finding a technician matching exact ward + specialization
        let technician = null;
        if (complaint.ward) {
            technician = await User.findOne({
                role: 'technician',
                specialization: { $regex: specRegex },
                ward: complaint.ward
            });
        }

        // 2. Fallback to any technician matching ward
        if (!technician && complaint.ward) {
            technician = await User.findOne({
                role: 'technician',
                ward: complaint.ward
            });
        }

        // 3. Fallback to any technician with matching specialization
        if (!technician) {
            technician = await User.findOne({
                role: 'technician',
                specialization: { $regex: specRegex }
            });
        }

        // 4. Fallback to any available active technician in the system
        if (!technician) {
            technician = await User.findOne({ role: 'technician' });
        }

        // 5. Ultimate fallback to corporator or admin if no field technicians exist
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
