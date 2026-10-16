import { useState, useEffect } from 'react';
import { getCommissions, setCommission, getPlatformFee, updatePlatformFee, getVendors, deleteCommission } from '../services/adminApi';
import Pagination from '../../../components/common/Pagination';
import AdminPageLayout from '../components/layout/AdminPageLayout';
import AdminPageHeader from '../components/layout/AdminPageHeader';
import DataTable from '../components/DataTable';
const CommissionsPage = () => {
  const [commissions, setCommissions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feeType, setFeeType] = useState('PERCENTAGE'); // 'PERCENTAGE' or 'FIXED'
  const [feeForm, setFeeForm] = useState('5');
  const [feeAmountForm, setFeeAmountForm] = useState('30');
  const [adminCommForm, setAdminCommForm] = useState('');
  const [commForm, setCommForm] = useState({ vendor: '', percentage: '' });
  const [saving, setSaving] = useState(false);

  // Online Payment Cashback state
  const [cashbackPolicy, setCashbackPolicy] = useState({
    enabled: false,
    type: 'FIXED', // 'FIXED' or 'PERCENTAGE'
    percentage: 5,
    amount: 20,
  });

  // GST Settings state
  const [gstPolicy, setGstPolicy] = useState({
    enabled: false,
    type: 'PERCENTAGE',
    percentage: 18,
    amount: 0,
  });

  // Call Policy state
  const [callPolicy, setCallPolicy] = useState({
    callEnabled: true,
    callWindowMinutes: 60,
  });

  // Cancellation Policy state
  const [cancelPolicy, setCancelPolicy] = useState({
    cancellationChargeEnabled: true,
    freeCancellationWindowMinutes: 60,
    cancellationChargeType: 'PERCENTAGE',
    cancellationFeePercentage: 25,
    cancellationFixedAmount: 0,
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 5
  });

  useEffect(() => { load(1); }, []);

  const load = async (page = 1) => {
    try {
      const [c, p, v] = await Promise.all([
        getCommissions({ page, limit: pagination.limit }),
        getPlatformFee(),
        getVendors({ limit: 1000 })
      ]);
      
      const commData = c.data?.data;
      const list = commData?.commissions || commData || [];
      setCommissions(Array.isArray(list) ? list : []);

      if (commData && commData.commissions) {
        setPagination({
          currentPage: commData.page || page,
          totalPages: commData.totalPages || 1,
          total: commData.total || list.length,
          limit: pagination.limit
        });
      } else {
        setPagination({
          currentPage: 1,
          totalPages: 1,
          total: Array.isArray(list) ? list.length : 0,
          limit: pagination.limit
        });
      }

      if (p.data.data) { 
        const fee = p.data.data;
        setFeeType(fee.feeType || 'PERCENTAGE');
        setFeeForm(fee.feePercentage !== undefined ? fee.feePercentage : (fee.percentage || 5)); 
        setFeeAmountForm(fee.feeAmount !== undefined ? fee.feeAmount : 30);
        setAdminCommForm(fee.adminCommissionPercentage || 0);

        // Load Cashback policy
        setCashbackPolicy({
          enabled: Boolean(fee.onlineCashbackEnabled),
          type: fee.cashbackType || 'FIXED',
          percentage: fee.cashbackPercentage !== undefined ? fee.cashbackPercentage : 5,
          amount: fee.cashbackAmount !== undefined ? fee.cashbackAmount : 20,
        });

        // Load GST policy
        setGstPolicy({
          enabled: Boolean(fee.gstEnabled),
          type: fee.gstType || 'PERCENTAGE',
          percentage: fee.gstPercentage !== undefined ? fee.gstPercentage : 18,
          amount: fee.gstAmount !== undefined ? fee.gstAmount : 0,
        });

        // Load call policy
        setCallPolicy({
          callEnabled: fee.callEnabled !== undefined ? fee.callEnabled : true,
          callWindowMinutes: fee.callWindowMinutes || 60,
        });
        // Load cancellation policy
        setCancelPolicy({
          cancellationChargeEnabled: fee.cancellationChargeEnabled !== undefined ? fee.cancellationChargeEnabled : true,
          freeCancellationWindowMinutes: fee.freeCancellationWindowMinutes || 60,
          cancellationChargeType: fee.cancellationChargeType || 'PERCENTAGE',
          cancellationFeePercentage: fee.cancellationFeePercentage || 25,
          cancellationFixedAmount: fee.cancellationFixedAmount || 0,
        });
      }
      
      const vendorData = v.data?.data;
      setVendors(Array.isArray(vendorData?.vendors) ? vendorData.vendors : (Array.isArray(vendorData) ? vendorData : []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFeeSubmit = async (e) => {
    e.preventDefault(); 
    setSaving(true);
    try { 
      await updatePlatformFee({
        feeType,
        feePercentage: Number(feeForm),
        feeAmount: Number(feeAmountForm),
        gstEnabled: gstPolicy.enabled,
        gstType: gstPolicy.type,
        gstPercentage: Number(gstPolicy.percentage),
        gstAmount: Number(gstPolicy.amount),
        onlineCashbackEnabled: cashbackPolicy.enabled,
        cashbackType: cashbackPolicy.type,
        cashbackPercentage: Number(cashbackPolicy.percentage),
        cashbackAmount: Number(cashbackPolicy.amount),
        adminCommissionPercentage: Number(adminCommForm),
        // Call policy
        callEnabled: callPolicy.callEnabled,
        callWindowMinutes: Number(callPolicy.callWindowMinutes),
        // Cancellation policy
        cancellationChargeEnabled: cancelPolicy.cancellationChargeEnabled,
        freeCancellationWindowMinutes: Number(cancelPolicy.freeCancellationWindowMinutes),
        cancellationChargeType: cancelPolicy.cancellationChargeType,
        cancellationFeePercentage: Number(cancelPolicy.cancellationFeePercentage),
        cancellationFixedAmount: Number(cancelPolicy.cancellationFixedAmount),
      }); 
      load(pagination.currentPage); 
      alert('Updated successfully'); 
    } catch (e) { 
      alert('Failed to save settings'); 
    } 
    setSaving(false);
  };

  const handleCommSubmit = async (e) => {
    e.preventDefault(); 
    setSaving(true);
    try { 
      await setCommission({ vendor: commForm.vendor, percentage: Number(commForm.percentage) }); 
      setCommForm({ vendor: '', percentage: '' }); 
      load(1); 
    } catch (e) { 
      alert('Failed'); 
    } 
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this custom rate?')) return;
    setSaving(true);
    try { 
      await deleteCommission(id); 
      const nextPage = (commissions.length === 1 && pagination.currentPage > 1)
        ? pagination.currentPage - 1
        : pagination.currentPage;
      load(nextPage); 
    } catch (e) { 
      alert('Failed to delete'); 
    } 
    setSaving(false);
  };


  const columns = [
    {
      header: 'Vendor',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-on-surface">{row.vendor?.name}</span>
          <span className="text-[12px] text-muted-text">{row.vendor?.businessName}</span>
        </div>
      )
    },
    {
      header: 'Custom Rate',
      render: (row) => <span className="font-bold text-primary">{row.percentage}%</span>
    },
    {
      header: 'Date Set',
      render: (row) => <span className="text-muted-text text-sm">{new Date(row.updatedAt).toLocaleDateString()}</span>
    },
    {
      header: 'Action',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button 
            onClick={() => {
              setCommForm({ vendor: row.vendor?._id || '', percentage: row.percentage });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }} 
            disabled={saving} 
            className="p-2 text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            <span className="text-sm font-medium">Edit</span>
          </button>
          <button 
            onClick={() => handleDelete(row._id)} 
            disabled={saving} 
            className="p-2 text-error hover:bg-error/10 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            <span className="text-sm font-medium">Remove</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <AdminPageLayout>
      <AdminPageHeader 
        title="Financial Settings"
        description="Manage global platform fees and custom vendor commissions."
      />

      <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-6">
        {/* Global Financial Settings */}
        <div className="bg-surface rounded-2xl p-6 border border-border flex flex-col gap-6 shadow-sm">
          <h3 className="font-semibold text-on-surface border-b border-border pb-3">Global Settings</h3>
          <form onSubmit={handleFeeSubmit} className="flex flex-col gap-6">
            {/* ── Global Platform Fee (Direct Money vs Percentage Toggle) ──────── */}
            <div className="p-4 rounded-xl bg-surface-elevated/50 border border-border flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <h4 className="font-semibold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
                    Customer Platform Fee
                  </h4>
                  <p className="text-sm text-muted-text mt-0.5">
                    Extra fee added on customer checkout ({feeType === 'FIXED' ? 'Direct Rupee Amount' : 'Percentage of Services'})
                  </p>
                </div>

                {/* Toggle: Direct Money (₹) vs Percentage (%) */}
                <div className="flex items-center bg-surface-variant p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setFeeType('FIXED')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      feeType === 'FIXED'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-text hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">currency_rupee</span>
                    Direct Money (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeType('PERCENTAGE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      feeType === 'PERCENTAGE'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-text hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">percent</span>
                    Percentage (%)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-sm font-medium text-on-surface">
                  {feeType === 'FIXED' ? 'Fixed Fee per Booking' : 'Platform Fee Percentage'}
                </span>

                {feeType === 'FIXED' ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">₹</span>
                    <input 
                      type="number" 
                      min="0"
                      value={feeAmountForm} 
                      onChange={e => setFeeAmountForm(e.target.value)} 
                      required 
                      className="w-28 pl-7 pr-3 py-2 rounded-xl bg-surface border border-border text-on-surface text-center font-bold text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      value={feeForm} 
                      onChange={e => setFeeForm(e.target.value)} 
                      required 
                      className="w-28 pl-3 pr-8 py-2 rounded-xl bg-surface border border-border text-on-surface text-center font-bold text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">%</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
              <div>
                <h4 className="font-medium text-on-surface">Global Admin Commission</h4>
                <p className="text-sm text-muted-text mt-1">Default commission deducted if vendor is on Commission plan</p>
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  value={adminCommForm} 
                  onChange={e => setAdminCommForm(e.target.value)} 
                  required 
                  className="w-24 pl-3 pr-8 py-2.5 rounded-xl bg-surface-elevated border border-border text-on-surface text-center font-bold text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">%</span>
              </div>
            </div>

            {/* ── Online Payment Cashback Settings ────────────────────────── */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">account_balance_wallet</span>
                    Online Payment Cashback (Glentro Wallet)
                  </h4>
                  <p className="text-xs text-muted-text mt-0.5">
                    Credit cashback to user wallet when they book using Online Payment (Razorpay)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCashbackPolicy(p => ({ ...p, enabled: !p.enabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    cashbackPolicy.enabled ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    cashbackPolicy.enabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              {cashbackPolicy.enabled && (
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2 border-t border-primary/10">
                  <div className="flex items-center bg-surface-variant p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setCashbackPolicy(p => ({ ...p, type: 'FIXED' }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        cashbackPolicy.type === 'FIXED'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-text hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">currency_rupee</span>
                      Fixed Rupee (₹)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashbackPolicy(p => ({ ...p, type: 'PERCENTAGE' }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        cashbackPolicy.type === 'PERCENTAGE'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-text hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">percent</span>
                      Percentage (%)
                    </button>
                  </div>

                  {cashbackPolicy.type === 'FIXED' ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={cashbackPolicy.amount}
                        onChange={e => setCashbackPolicy(p => ({ ...p, amount: e.target.value }))}
                        className="w-28 pl-7 pr-3 py-2 rounded-xl bg-surface border border-border text-on-surface text-center font-bold text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={cashbackPolicy.percentage}
                        onChange={e => setCashbackPolicy(p => ({ ...p, percentage: e.target.value }))}
                        className="w-28 pl-3 pr-8 py-2 rounded-xl bg-surface border border-border text-on-surface text-center font-bold text-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">%</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Service GST Settings ────────────────────────────────────────── */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600">account_balance</span>
                    Service GST (Taxes)
                  </h4>
                  <p className="text-xs text-muted-text mt-0.5">
                    GST percentage/amount adjusted by admin and displayed to customer as "Service GST"
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGstPolicy(p => ({ ...p, enabled: !p.enabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    gstPolicy.enabled ? 'bg-emerald-600' : 'bg-border'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    gstPolicy.enabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>

              {gstPolicy.enabled && (
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2 border-t border-emerald-500/10">
                  <div className="flex items-center bg-surface-variant p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setGstPolicy(p => ({ ...p, type: 'PERCENTAGE' }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        gstPolicy.type === 'PERCENTAGE'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-muted-text hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">percent</span>
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGstPolicy(p => ({ ...p, type: 'FIXED' }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        gstPolicy.type === 'FIXED'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-muted-text hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">currency_rupee</span>
                      Fixed Rupee (₹)
                    </button>
                  </div>

                  {gstPolicy.type === 'PERCENTAGE' ? (
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={gstPolicy.percentage}
                        onChange={e => setGstPolicy(p => ({ ...p, percentage: e.target.value }))}
                        className="w-24 pl-3 pr-8 py-2 rounded-xl bg-surface border border-border text-on-surface text-center font-bold text-lg focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">%</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={gstPolicy.amount}
                        onChange={e => setGstPolicy(p => ({ ...p, amount: e.target.value }))}
                        className="w-28 pl-7 pr-3 py-2 rounded-xl bg-surface border border-border text-on-surface text-center font-bold text-lg focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Call Policy ──────────────────────────────────────────────── */}
            <div className="pt-4 border-t border-border">
              <h4 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">call</span>
                In-App Call Policy
              </h4>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-on-surface text-sm">Enable In-App Calling</p>
                    <p className="text-xs text-muted-text mt-0.5">Allow Users and Vendors to call each other</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCallPolicy(p => ({ ...p, callEnabled: !p.callEnabled }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      callPolicy.callEnabled ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      callPolicy.callEnabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                {callPolicy.callEnabled && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-on-surface text-sm">Call Window (minutes before appointment)</p>
                      <p className="text-xs text-muted-text mt-0.5">Call is disabled this many minutes before appointment. 0 = no restriction.</p>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={callPolicy.callWindowMinutes}
                        onChange={e => setCallPolicy(p => ({ ...p, callWindowMinutes: e.target.value }))}
                        className="w-24 pl-3 pr-10 py-2 rounded-xl bg-surface-elevated border border-border text-on-surface text-center font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-text text-xs font-semibold">min</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Cancellation Policy ─────────────────────────────────────── */}
            <div className="pt-4 border-t border-border">
              <h4 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-error">cancel</span>
                Cancellation Policy
              </h4>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-on-surface text-sm">Enable Cancellation Charge</p>
                    <p className="text-xs text-muted-text mt-0.5">Charge users for late cancellations</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCancelPolicy(p => ({ ...p, cancellationChargeEnabled: !p.cancellationChargeEnabled }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      cancelPolicy.cancellationChargeEnabled ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      cancelPolicy.cancellationChargeEnabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                {cancelPolicy.cancellationChargeEnabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-on-surface text-sm">Free Cancellation Window (minutes)</p>
                        <p className="text-xs text-muted-text mt-0.5">Cancel before this many minutes = no charge. 0 = always charged.</p>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          value={cancelPolicy.freeCancellationWindowMinutes}
                          onChange={e => setCancelPolicy(p => ({ ...p, freeCancellationWindowMinutes: e.target.value }))}
                          className="w-24 pl-3 pr-10 py-2 rounded-xl bg-surface-elevated border border-border text-on-surface text-center font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-text text-xs font-semibold">min</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-on-surface text-sm">Charge Type</p>
                        <p className="text-xs text-muted-text mt-0.5">How to calculate the cancellation charge</p>
                      </div>
                      <select
                        value={cancelPolicy.cancellationChargeType}
                        onChange={e => setCancelPolicy(p => ({ ...p, cancellationChargeType: e.target.value }))}
                        className="px-3 py-2 rounded-xl bg-surface-elevated border border-border text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      >
                        <option value="PERCENTAGE">Percentage of booking amount</option>
                        <option value="FIXED">Fixed Amount (₹)</option>
                      </select>
                    </div>

                    {cancelPolicy.cancellationChargeType === 'PERCENTAGE' ? (
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-on-surface text-sm">Cancellation Fee (%)</p>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={cancelPolicy.cancellationFeePercentage}
                            onChange={e => setCancelPolicy(p => ({ ...p, cancellationFeePercentage: e.target.value }))}
                            className="w-24 pl-3 pr-8 py-2 rounded-xl bg-surface-elevated border border-border text-on-surface text-center font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-on-surface text-sm">Fixed Cancellation Amount (₹)</p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={cancelPolicy.cancellationFixedAmount}
                            onChange={e => setCancelPolicy(p => ({ ...p, cancellationFixedAmount: e.target.value }))}
                            className="w-28 pl-7 pr-3 py-2 rounded-xl bg-surface-elevated border border-border text-on-surface font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button 
                type="submit" 
                disabled={saving} 
                className="px-6 py-2.5 bg-primary text-white rounded-xl text-[14px] font-bold shadow-sm hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>

        {/* Custom Vendor Commissions */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-border">
            <h3 className="font-semibold text-on-surface mb-4">Custom Vendor Rates</h3>
            <form onSubmit={handleCommSubmit} className="flex flex-col sm:flex-row gap-4">
              <select 
                value={commForm.vendor} 
                onChange={e => setCommForm({...commForm, vendor: e.target.value})} 
                required 
                className="flex-1 px-3 py-2.5 rounded-xl bg-surface-elevated border border-border text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              >
                <option value="">Select Vendor</option>
                {vendors.map(v => (
                  <option key={v._id} value={v._id}>{v.name} - {v.businessName}</option>
                ))}
              </select>
              
              <div className="relative">
                <input 
                  type="number" 
                  value={commForm.percentage} 
                  onChange={e => setCommForm({...commForm, percentage: e.target.value})} 
                  placeholder="Custom rate" 
                  required 
                  className="w-32 pl-3 pr-8 py-2.5 rounded-xl bg-surface-elevated border border-border text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text font-bold">%</span>
              </div>
              
              <button 
                type="submit" 
                disabled={saving} 
                className="px-6 py-2.5 bg-success text-white rounded-xl text-[14px] font-bold shadow-sm hover:bg-success/90 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                Set Custom Rate
              </button>
            </form>
          </div>

          <DataTable 
            columns={columns}
            data={commissions}
            loading={loading}
            pagination={pagination}
            onPageChange={load}
            emptyMessage="No custom rates configured"
          />
        </div>
      </div>
    </AdminPageLayout>
  );
};

export default CommissionsPage;
