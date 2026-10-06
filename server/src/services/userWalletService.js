const mongoose = require('mongoose');
const UserWallet = require('../models/UserWallet');
const UserWalletTransaction = require('../models/UserWalletTransaction');

/**
 * Get user wallet and create if doesn't exist
 */
const getWallet = async (userId) => {
  return await UserWallet.getOrCreate(userId);
};

/**
 * Credit cashback to user's wallet
 */
const creditCashback = async ({ userId, bookingId, amountPaise, description = 'Online payment cashback', session = null }) => {
  if (!amountPaise || amountPaise <= 0) return null;

  const wallet = await UserWallet.getOrCreate(userId, session);

  const updatedWallet = await UserWallet.findOneAndUpdate(
    { _id: wallet._id },
    {
      $inc: {
        balancePaise: amountPaise,
        totalCashbackEarnedPaise: amountPaise,
        version: 1,
      },
      $set: { lastUpdatedAt: new Date() },
    },
    { new: true, ...(session && { session }) }
  );

  const [transaction] = await UserWalletTransaction.create(
    [
      {
        user: userId,
        wallet: wallet._id,
        booking: bookingId || null,
        amountPaise,
        type: 'CREDIT',
        source: 'ONLINE_CASHBACK',
        description,
        balanceAfterPaise: updatedWallet.balancePaise,
      },
    ],
    { ...(session && { session }) }
  );

  return { wallet: updatedWallet, transaction };
};

/**
 * Debit user wallet (e.g. For redeeming on booking)
 */
const debitWallet = async ({ userId, bookingId, amountPaise, description = 'Used for booking payment', session = null }) => {
  if (!amountPaise || amountPaise <= 0) return null;

  const wallet = await UserWallet.getOrCreate(userId, session);

  if (wallet.balancePaise < amountPaise) {
    throw new Error('Insufficient wallet balance');
  }

  const updatedWallet = await UserWallet.findOneAndUpdate(
    { _id: wallet._id, balancePaise: { $gte: amountPaise } },
    {
      $inc: {
        balancePaise: -amountPaise,
        totalSpentPaise: amountPaise,
        version: 1,
      },
      $set: { lastUpdatedAt: new Date() },
    },
    { new: true, ...(session && { session }) }
  );

  if (!updatedWallet) {
    throw new Error('Failed to deduct wallet balance due to concurrent update or insufficient funds');
  }

  const [transaction] = await UserWalletTransaction.create(
    [
      {
        user: userId,
        wallet: wallet._id,
        booking: bookingId || null,
        amountPaise,
        type: 'DEBIT',
        source: 'WALLET_REDEMPTION',
        description,
        balanceAfterPaise: updatedWallet.balancePaise,
      },
    ],
    { ...(session && { session }) }
  );

  return { wallet: updatedWallet, transaction };
};

/**
 * Get user wallet transactions history
 */
const getWalletTransactions = async (userId, { page = 1, limit = 10 } = {}) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await UserWalletTransaction.countDocuments({ user: userId });
  const transactions = await UserWalletTransaction.find({ user: userId })
    .populate('booking', 'bookingDate startTime status')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  return {
    transactions,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  getWallet,
  creditCashback,
  debitWallet,
  getWalletTransactions,
};
