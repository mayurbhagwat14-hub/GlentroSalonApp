const mongoose = require('mongoose');

/**
 * UserWallet — Customer wallet for storing cashback and balance.
 *
 * Rules:
 *  - balancePaise stored in integer paise (₹1 = 100 paise).
 *  - Modifying balance must be atomic with $inc or within a session transaction.
 *  - One wallet per user.
 */
const userWalletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balancePaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCashbackEarnedPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSpentPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 0,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for INR balance
userWalletSchema.virtual('balance').get(function () {
  return (this.balancePaise || 0) / 100;
});

userWalletSchema.virtual('totalCashbackEarned').get(function () {
  return (this.totalCashbackEarnedPaise || 0) / 100;
});

userWalletSchema.set('toJSON', { virtuals: true });
userWalletSchema.set('toObject', { virtuals: true });

userWalletSchema.statics.getOrCreate = async function (userId, session = null) {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  if (session) options.session = session;

  return await this.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, balancePaise: 0, totalCashbackEarnedPaise: 0, totalSpentPaise: 0 } },
    options
  );
};

module.exports = mongoose.model('UserWallet', userWalletSchema);
