const express = require('express');
const router = express.Router();
const {
    createComplaint,
    getComplaints,
    getComplaintById,
    updateComplaintStatus,
    addResolutionExpense,
    requestExtension,
    sendAdminClarification,
    aiAnalyzeImage,
    autoVerifyAndResolveComplaint,
} = require('../controllers/complaintController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/ai-analyze-image', protect, aiAnalyzeImage);
router.post('/:id/auto-verify-resolve', protect, restrictTo('corporator', 'admin', 'technician'), autoVerifyAndResolveComplaint);
router.post('/', protect, createComplaint);
router.get('/', protect, getComplaints);
router.get('/:id', protect, getComplaintById);
router.patch('/:id/status', protect, restrictTo('corporator', 'admin'), updateComplaintStatus);
router.post('/:id/expenses', protect, restrictTo('corporator', 'admin'), addResolutionExpense);
router.post('/:id/extension-request', protect, restrictTo('corporator', 'admin'), requestExtension);
router.post('/:id/admin-clarification', protect, restrictTo('admin'), sendAdminClarification);

module.exports = router;