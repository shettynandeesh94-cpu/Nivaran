/**
 * Municipal On-Duty Technician Roster Helper
 * Extracts the real assigned technician from a populated complaint object.
 * Returns null if the complaint is unassigned, preserving the true state.
 */
export const getAssignedTechnician = (complaint) => {
    if (!complaint) return null;

    if (complaint.assignedTo && typeof complaint.assignedTo === 'object' && complaint.assignedTo.name) {
        return {
            _id: complaint.assignedTo._id,
            name: complaint.assignedTo.name,
            email: complaint.assignedTo.email || '',
            specialization: complaint.assignedTo.specialization || complaint.category || 'Field Technician',
            phone: complaint.assignedTo.phone || '',
            ward: complaint.assignedTo.ward || '',
            autoDispatched: Boolean(complaint.autoDispatched || true)
        };
    }

    return null;
};
