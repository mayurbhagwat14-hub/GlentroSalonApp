/**
 * kycUtils.js — Masking and sanitization utilities for sensitive vendor data.
 *
 * RULES:
 *   • Public/User APIs → sanitizeVendorForPublic()  → no KYC, no bank
 *   • Vendor's own API → sanitizeVendorForVendor()  → masked values
 *   • Admin APIs       → sanitizeVendorForAdmin()   → full data (after authorization)
 */

/**
 * Mask Aadhaar number: 1234 5678 9012 → XXXX XXXX 9012
 */
const maskAadhaar = (aadhaar) => {
  if (!aadhaar || aadhaar.length < 4) return '';
  const clean = aadhaar.replace(/\s/g, '');
  const last4 = clean.slice(-4);
  return `XXXX XXXX ${last4}`;
};

/**
 * Mask PAN number: ABCDE1234F → XXXXX1234X
 */
const maskPan = (pan) => {
  if (!pan || pan.length < 4) return '';
  const clean = pan.replace(/\s/g, '').toUpperCase();
  if (clean.length !== 10) return 'XXXXXXXXXX';
  return `XXXXX${clean.slice(5, 9)}${clean.slice(9)}`;
};

/**
 * Mask bank account number: 1234567890 → XXXXXX7890
 */
const maskBankAccount = (accountNumber) => {
  if (!accountNumber || accountNumber.length < 4) return '';
  const last4 = accountNumber.slice(-4);
  return `${'X'.repeat(Math.max(accountNumber.length - 4, 4))}${last4}`;
};

/**
 * Strip all sensitive fields — for public/user-facing APIs.
 * NEVER expose KYC or bank data to users.
 */
const sanitizeVendorForPublic = (vendorObj) => {
  if (!vendorObj) return vendorObj;
  const obj = typeof vendorObj.toObject === 'function' ? vendorObj.toObject() : { ...vendorObj };
  delete obj.password;
  delete obj.kyc;
  delete obj.kycStatus;
  delete obj.kycRejectReason;
  delete obj.bank;
  delete obj.accountStatus;
  delete obj.fcmToken;
  delete obj.fcmtoken;
  delete obj.fcmtokenmobile;
  delete obj.commissionRate;
  delete obj.subscriptionPlan;
  delete obj.__v;
  return obj;
};

/**
 * Mask sensitive values — for vendor viewing their own profile.
 * Shows masked KYC/bank so vendor knows they are on file.
 */
const sanitizeVendorForVendor = (vendorObj) => {
  if (!vendorObj) return vendorObj;
  const obj = typeof vendorObj.toObject === 'function' ? vendorObj.toObject() : { ...vendorObj };
  delete obj.password;
  delete obj.__v;

  // Mask KYC values
  if (obj.kyc) {
    obj.kyc = {
      aadhaarNumber: maskAadhaar(obj.kyc.aadhaarNumber),
      aadhaarFrontUploaded: !!obj.kyc.aadhaarFront,
      aadhaarBackUploaded: !!obj.kyc.aadhaarBack,
      panNumber: maskPan(obj.kyc.panNumber),
      panCardUploaded: !!obj.kyc.panCard,
    };
  }

  // Mask bank values
  if (obj.bank) {
    obj.bank = {
      accountHolderName: obj.bank.accountHolderName || '',
      accountNumber: maskBankAccount(obj.bank.accountNumber),
      ifscCode: obj.bank.ifscCode || '',
      bankName: obj.bank.bankName || '',
      bankBranch: obj.bank.bankBranch || '',
      upiId: obj.bank.upiId || '',
    };
  }

  return obj;
};

/**
 * Full data — for admin only (after admin authorization is verified).
 * KYC document paths are included so admin can view/download them.
 */
const sanitizeVendorForAdmin = (vendorObj) => {
  if (!vendorObj) return vendorObj;
  const obj = typeof vendorObj.toObject === 'function' ? vendorObj.toObject() : { ...vendorObj };
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = {
  maskAadhaar,
  maskPan,
  maskBankAccount,
  sanitizeVendorForPublic,
  sanitizeVendorForVendor,
  sanitizeVendorForAdmin,
};
