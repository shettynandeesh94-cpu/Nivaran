const express = require('express');
const router = express.Router();
const {
    createComplaint,
    getComplaints,
    getComplaintById,
    updateComplaintStatus,
    addResolutionExpense,
} = require('../controllers/complaintController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/', protect, createComplaint);
router.get('/', protect, getComplaints);
router.get('/:id', protect, getComplaintById);
router.patch('/:id/status', protect, restrictTo('corporator', 'admin'), updateComplaintStatus);
router.post('/:id/expenses', protect, restrictTo('corporator', 'admin'), addResolutionExpense);

module.exports = router;