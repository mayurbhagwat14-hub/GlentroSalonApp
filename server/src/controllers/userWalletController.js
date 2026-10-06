const userWalletService = require('../services/userWalletService');

const getMyWallet = async (req, res, next) => {
  try {
    const wallet = await userWalletService.getWallet(req.user.id);
    const { page, limit } = req.query;
    const history = await userWalletService.getWalletTransactions(req.user.id, { page, limit });

    res.json({
      success: true,
      data: {
        wallet,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMyWalletTransactions = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const history = await userWalletService.getWalletTransactions(req.user.id, { page, limit });

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyWallet,
  getMyWalletTransactions,
};
