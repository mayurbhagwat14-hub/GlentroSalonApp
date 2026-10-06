const mongoose = require('mongoose');

const userWalletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserWallet',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    amountPaise: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    source: {
      type: String,
      enum: ['ONLINE_CASHBACK', 'WALLET_REDEMPTION', 'ADMIN_ADJUSTMENT', 'REFUND'],
      default: 'ONLINE_CASHBACK',
    },
    description: {
      type: String,
      default: '',
    },
    balanceAfterPaise: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

userWalletTransactionSchema.virtual('amount').get(function () {
  return (this.amountPaise || 0) / 100;
});

userWalletTransactionSchema.virtual('balanceAfter').get(function () {
  return (this.balanceAfterPaise || 0) / 100;
});

userWalletTransactionSchema.set('toJSON', { virtuals: true });
userWalletTransactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('UserWalletTransaction', userWalletTransactionSchema);
