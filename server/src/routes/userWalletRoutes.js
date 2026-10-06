const express = require('express');
const router = express.Router();
const { getMyWallet, getMyWalletTransactions } = require('../controllers/userWalletController');
const { protect, requireActiveUser } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect, requireActiveUser, authorize('user'));

router.get('/', getMyWallet);
router.get('/transactions', getMyWalletTransactions);

module.exports = router;
