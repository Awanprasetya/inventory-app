const router = require('express').Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/dashboard/summary', dashboardController.summary);
router.get('/dashboard/due-dates', dashboardController.dueDates);
router.get('/dashboard/chart', dashboardController.chart);

module.exports = router;
