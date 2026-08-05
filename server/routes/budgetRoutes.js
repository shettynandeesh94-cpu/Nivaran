const express = require('express');
const router = express.Router();
const {
    getDepartmentBudgets,
    createBudgetRequest,
    getBudgetRequests,
    actionBudgetRequest,
    updateDepartmentBudget,
} = require('../controllers/budgetController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/departments', protect, getDepartmentBudgets);
router.patch('/departments/:id', protect, restrictTo('admin'), updateDepartmentBudget);

router.get('/requests', protect, getBudgetRequests);
router.post('/requests', protect, restrictTo('corporator', 'admin'), createBudgetRequest);
router.patch('/requests/:id/action', protect, restrictTo('admin'), actionBudgetRequest);

module.exports = router;
