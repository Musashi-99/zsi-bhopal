const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth');

// Government Officer API. Officers use the existing `inspector` role; admins can also use it.
// Every sub-route sits behind this server-side guard. Hiding buttons in the UI is not access control.
const router = express.Router();
router.use(requireAuth, requireRole('inspector', 'admin'));

router.use(require('./overview'));
router.use(require('./verification'));
router.use(require('./quality'));
router.use(require('./centres'));
router.use(require('./people'));
router.use(require('./market'));
router.use(require('./schemes'));
router.use(require('./reports'));
router.use(require('./admin'));

module.exports = router;
