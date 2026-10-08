import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getImageUrl } from '../../../utils/imageUtils';
import { sendTestNotification } from '../services/vendorApi';
import VendorPageLayout from '../../../components/vendor/layout/VendorPageLayout';
import VendorPageHeader from '../../../components/vendor/layout/VendorPageHeader';
import BasicInfoTab from './ProfileTabs/BasicInfoTab';
import KycTab from './ProfileTabs/KycTab';
import BankTab from './ProfileTabs/BankTab';

const ProfilePage = () => {
  const { vendor: user, setVendor: updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('basic');
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    setTestStatus(null);
    try {
      const res = await sendTestNotification();
      setTestStatus({
        type: 'success',
        message: res.data?.message || 'Test notification sent to your device!',
      });
    } catch (err) {
      setTestStatus({
        type: 'error',
        message: err.response?.data?.message || 'Failed to send test notification. Please allow notifications first.',
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Business Profile', icon: 'storefront' },
    { id: 'kyc', label: 'KYC & Verification', icon: 'verified_user' },
    { id: 'bank', label: 'Bank Details', icon: 'account_balance' },
  ];

  return (
    <VendorPageLayout>
      <VendorPageHeader 
        title="Vendor Profile" 
        description="Manage your business information, KYC documents, and payout details."
      />

      {/* Top Banner / Header */}
      <div className="bg-surface rounded-2xl p-6 lg:p-8 border border-border shadow-sm flex flex-col md:flex-row items-center md:items-start justify-between gap-6 mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full">
          <div className="relative">
            <div className="w-24 h-24 bg-soft-primary rounded-full flex items-center justify-center text-primary text-3xl font-bold overflow-hidden border-4 border-surface shadow-sm">
              {user?.avatar ? (
                <img src={user.avatar.startsWith('data:') ? user.avatar : getImageUrl(user.avatar)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0).toUpperCase()
              )}
            </div>
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-on-surface">{user?.businessName || user?.name}</h1>
                <p className="text-muted-text mt-1">{user?.email} • {user?.phone}</p>
              </div>

              {/* Test Notification Button */}
              <div className="flex items-center gap-2">
                {typeof window !== 'undefined' && 'Notification' in window && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    Notification.permission === 'granted'
                      ? 'bg-green-100 text-green-800'
                      : Notification.permission === 'denied'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {Notification.permission.toUpperCase()}
                  </span>
                )}
                <button
                  type="button"
                  disabled={isTestingNotification}
                  onClick={handleTestNotification}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isTestingNotification ? 'animate-spin' : ''}`}>
                    {isTestingNotification ? 'sync' : 'notifications_active'}
                  </span>
                  {isTestingNotification ? 'Sending...' : 'Test Push Notification'}
                </button>
              </div>
            </div>

            {testStatus && (
              <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 ${testStatus.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                <span className="material-symbols-outlined text-[16px]">{testStatus.type === 'success' ? 'check_circle' : 'error'}</span>
                <span>{testStatus.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wide flex items-center gap-1.5 ${user?.isApproved ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                <span className="material-symbols-outlined text-[16px]">{user?.isApproved ? 'check_circle' : 'pending'}</span>
                {user?.isApproved ? 'Verified Vendor' : 'Pending Verification'}
              </span>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wide flex items-center gap-1.5 ${user?.kycStatus === 'verified' ? 'bg-green-50 text-green-700 border border-green-200' : user?.kycStatus === 'submitted' ? 'bg-blue-50 text-blue-700 border border-blue-200' : user?.kycStatus === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                KYC: {user?.kycStatus || 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Tabs Header */}
        <div className="flex overflow-x-auto hide-scrollbar border-b border-border bg-background-alt/30">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap border-b-2 ${activeTab === tab.id ? 'border-primary text-primary bg-surface' : 'border-transparent text-muted-text hover:text-on-surface hover:bg-surface/50'}`}
            >
              <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 lg:p-8">
          {activeTab === 'basic' && <BasicInfoTab onProfileUpdate={updateUser} />}
          {activeTab === 'kyc' && <KycTab onProfileUpdate={updateUser} />}
          {activeTab === 'bank' && <BankTab onProfileUpdate={updateUser} />}
        </div>
      </div>
    </VendorPageLayout>
  );
};

export default ProfilePage;
