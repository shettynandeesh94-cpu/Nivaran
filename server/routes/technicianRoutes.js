const express = require('express');
const router = express.Router();
const {
    getTechnicians,
    addTechnician,
    deleteTechnician,
    assignComplaintTechnician
} = require('../controllers/technicianController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Get all technicians (all authenticated users, especially corporators & admins)
router.get('/', protect, getTechnicians);

// Corporator & Admin can onboard new technicians
router.post('/', protect, restrictTo('corporator', 'admin'), addTechnician);

// Corporator & Admin can delete/deboard a technician
router.delete('/:id', protect, restrictTo('corporator', 'admin'), deleteTechnician);

// Corporator & Admin can manually assign a technician to a complaint
router.patch('/assign/:complaintId', protect, restrictTo('corporator', 'admin'), assignComplaintTechnician);

module.exports = router;
