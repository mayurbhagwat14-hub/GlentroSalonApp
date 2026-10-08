import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { useNotifications } from '../../../../context/NotificationContext';
import { useLocationContext } from '../../../../context/LocationContext';
import { updateProfile, sendTestNotification } from '../../../../services/api/authApi';
import { initiateChat, deleteUserAccount, getMyWallet } from '../../services/userApi';
import Button from '../../../../components/common/Button';
import Input from '../../../../components/common/Input';
import PageHeader from '../../../../components/common/PageHeader';
import ImageUpload from '../../../../components/common/ImageUpload';
import LocationSelectionModal from '../../../../components/common/LocationSelectionModal';
import { getImageUrl } from '../../../../utils/imageUtils';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { selectedLocation } = useLocationContext();

  // Modals & Edit States
  const [editing, setEditing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [walletData, setWalletData] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const res = await getMyWallet();
      setWalletData(res.data.data);
    } catch (e) {
      console.error('Failed to load wallet', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('phone', formData.phone);
      data.append('email', formData.email);

      if (avatarFile) {
        data.append('avatar', avatarFile);
      } else if (avatarFile === null && formData.avatarRemoved) {
        data.append('avatar', '');
      }

      const res = await updateProfile(data);
      setUser(res.data.data);
      sessionStorage.setItem('user', JSON.stringify(res.data.data));
      setMessage({ text: 'Profile updated successfully', type: 'success' });
      setEditing(false);
      setAvatarFile(null);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (e) {
      setMessage({
        text: e.response?.data?.message || 'Unable to update profile. Please try again.',
        type: 'error'
      });
    }
    setSaving(false);
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    try {
      const res = await sendTestNotification();
      setMessage({
        text: res.data?.message || 'Test notification sent to your device!',
        type: 'success'
      });
    } catch (err) {
      setMessage({
        text: err.response?.data?.message || 'Failed to send test notification. Please allow notifications first.',
        type: 'error'
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout('user');
    navigate('/');
  };

  const handleContactAdmin = async () => {
    try {
      const res = await initiateChat({
        recipientRole: 'admin',
        chatType: 'user-admin',
      });
      navigate(`/chat/${res.data.data._id}`);
    } catch (e) {
      setMessage({ text: 'Unable to connect with Admin. Please try again.', type: 'error' });
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount({ reason: deleteReason });
      setShowDeleteConfirm(false);
      logout('user');
      navigate('/login', { state: { deleted: true } });
    } catch (e) {
      setMessage({
        text: e.response?.data?.message || 'Failed to delete account. Please try again.',
        type: 'error'
      });
      setShowDeleteConfirm(false);
    }
    setIsDeleting(false);
  };

  const handleEditCancel = () => {
    setEditing(false);
    setFormData({
      name: user?.name || '',
      phone: user?.phone || '',
      email: user?.email || ''
    });
    setAvatarFile(null);
    setMessage({ text: '', type: '' });
  };

  // Helper for List Item
  const ListItem = ({ icon, label, description, onClick, count }) => (
    <div
      onClick={onClick}
      className="flex items-center p-4 bg-surface rounded-2xl border border-border hover:border-primary/30 hover:bg-surface-variant/50 transition-colors cursor-pointer group shadow-sm"
    >
      <div className="w-12 h-12 bg-soft-primary rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="ml-4 flex-1">
        <h3 className="font-headline-sm text-[16px] text-on-surface font-semibold">{label}</h3>
        {description && <p className="font-body-sm text-[13px] text-muted-text mt-0.5 line-clamp-1">{description}</p>}
      </div>
      {count > 0 && (
        <div className="mr-3 w-6 h-6 bg-error rounded-full flex items-center justify-center text-white font-bold text-[12px]">
          {count > 9 ? '9+' : count}
        </div>
      )}
      <span className="material-symbols-outlined text-muted-text">chevron_right</span>
    </div>
  );

  return (
    <div className="w-full max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto animate-fade-in relative flex flex-col pb-4">
      <div className="md:hidden"><PageHeader title="Profile" fallbackPath="/" /></div>

      {message.text && !editing && (
        <div className={`mt-4 px-4 py-3 rounded-xl border text-sm font-medium ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* --- PROFILE VIEW MODE --- */}
      {!editing && (
        <>
          {/* Header Card */}
          <div className="bg-surface rounded-[32px] p-6 border border-border shadow-sm mt-4 md:mt-8 flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6">
            <div className="w-28 h-28 md:w-32 md:h-32 bg-gradient-to-br from-primary-400 to-accent-400 rounded-[28px] flex items-center justify-center text-white text-4xl font-bold shadow-md overflow-hidden border-[6px] border-surface shrink-0">
              {user?.avatar ? (
                <img src={getImageUrl(user.avatar)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className="flex-1 pt-2">
              <h1 className="font-headline-md text-[24px] font-bold text-on-surface">{user?.name}</h1>
              <p className="font-body-md text-muted-text mt-1">{user?.email || 'Email not added'}</p>
              <p className="font-body-md text-muted-text mt-1">{user?.phone || 'Phone number not added'}</p>
            </div>
            <div className="w-full md:w-auto pt-2">
              <Button
                variant="outline"
                className="w-full md:w-auto rounded-full font-medium"
                onClick={() => setEditing(true)}
              >
                Edit Profile
              </Button>
            </div>
          </div>

          {/* Glentro Wallet Card */}
          <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/5 rounded-[28px] p-5 sm:p-6 border border-primary/20 shadow-sm mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md shrink-0">
                <span className="material-symbols-outlined text-[26px] sm:text-[30px]">account_balance_wallet</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-sm text-[17px] font-bold text-on-surface">Glentro Wallet</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Online Cashback
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                    ₹{(walletData?.wallet?.balance || 0).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-text">
                    Available Balance
                  </span>
                </div>
                {walletData?.wallet?.totalCashbackEarned > 0 && (
                  <p className="text-xs text-muted-text mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-emerald-600">savings</span>
                    Total Cashback: ₹{(walletData.wallet.totalCashbackEarned || 0).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              className="rounded-full text-xs font-semibold px-4 py-2 flex items-center gap-1.5 self-end sm:self-center"
              onClick={() => setShowWalletModal(true)}
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              Cashback History
            </Button>
          </div>

          <div className="space-y-8 mt-6">
            {/* My Activity Section */}
            <section>
              <h2 className="font-headline-sm text-lg text-on-surface font-semibold mb-4 px-1">My Activity</h2>
              <div className="flex flex-col gap-3">
                <ListItem
                  icon="calendar_today"
                  label="My Bookings"
                  description="View your upcoming and previous appointments"
                  onClick={() => navigate('/bookings', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="phone_in_talk"
                  label="Call History"
                  description="View your past and missed calls"
                  onClick={() => navigate('/call-history', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="favorite"
                  label="My Favourites"
                  description="View salons you have liked and saved"
                  onClick={() => navigate('/favorites', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="local_offer"
                  label="Offers"
                  description="View exclusive offers and packages"
                  onClick={() => navigate('/offers', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="chat"
                  label="Messages"
                  description="Chat with salons and Admin"
                  onClick={() => navigate('/chat', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="notifications"
                  label="Notifications"
                  description="Booking updates, offers and other alerts"
                  count={unreadCount}
                  onClick={() => navigate('/notifications', { state: { fromProfile: true } })}
                />
              </div>
            </section>

            {/* Preferences Section */}
            <section>
              <h2 className="font-headline-sm text-lg text-on-surface font-semibold mb-4 px-1">Preferences</h2>
              <div className="flex flex-col gap-3">
                <ListItem
                  icon="location_on"
                  label="Location"
                  description={selectedLocation?.city ? (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span> {selectedLocation.city}
                    </span>
                  ) : 'Select your city'}
                  onClick={() => setIsLocationModalOpen(true)}
                />
              </div>
            </section>

            {/* Help & Information Section */}
            <section>
              <h2 className="font-headline-sm text-lg text-on-surface font-semibold mb-4 px-1">Help & Information</h2>
              <div className="flex flex-col gap-3">
                <ListItem
                  icon="headset_mic"
                  label="Help & Support"
                  description="Get assistance and contact our team"
                  onClick={() => navigate('/support', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="report_problem"
                  label="Booking Issues"
                  description="Report problems with specific bookings"
                  onClick={() => navigate('/booking-issues', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="policy"
                  label="Privacy Policy"
                  description="Read how we handle your data"
                  onClick={() => navigate('/privacy-policy', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="gavel"
                  label="Terms & Conditions"
                  description="View our service agreement"
                  onClick={() => navigate('/terms-and-conditions', { state: { fromProfile: true } })}
                />
                <ListItem
                  icon="support_agent"
                  label="Contact Admin (Live Chat)"
                  description="Message us directly for support"
                  onClick={handleContactAdmin}
                />
              </div>
            </section>

            {/* Notifications Test Section */}
            <section>
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="font-headline-sm text-lg text-on-surface font-semibold">Notifications</h2>
                {typeof window !== 'undefined' && 'Notification' in window && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    Notification.permission === 'granted'
                      ? 'bg-green-100 text-green-800'
                      : Notification.permission === 'denied'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    Browser: {Notification.permission.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <ListItem
                  icon="notifications_active"
                  label={isTestingNotification ? 'Sending Push Notification...' : 'Test Push Notification'}
                  description="Send a test notification to your device using the token saved in the database"
                  onClick={handleTestNotification}
                />
              </div>
            </section>

            {/* Account Section */}
            <section>
              <h2 className="font-headline-sm text-lg text-error font-semibold mb-4 px-1">Account</h2>
              <div className="flex flex-col gap-3">
                <ListItem
                  icon="delete_forever"
                  label="Delete Account"
                  description="Permanently deactivate your account"
                  onClick={() => setShowDeleteConfirm(true)}
                />
              </div>
            </section>

            {/* Logout Section */}
            <section className="pt-4">
              <Button
                variant="ghost"
                className="w-full text-on-surface-variant hover:bg-surface-variant rounded-2xl py-4 font-semibold"
                onClick={() => setShowLogoutConfirm(true)}
              >
                Log Out
              </Button>
            </section>
          </div>
        </>
      )}

      {/* --- EDIT PROFILE MODE --- */}
      {editing && (
        <div className="bg-surface rounded-[32px] p-6 border border-border shadow-sm mt-4 md:mt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-headline-md text-[20px] font-bold text-on-surface">Edit Profile</h2>
            <button onClick={handleEditCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant text-muted-text">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {message.text && (
            <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-center mb-8">
            <ImageUpload
              currentImage={user?.avatar}
              onFileSelect={(file) => {
                if (file === null) {
                  setFormData({ ...formData, avatarRemoved: true });
                  setAvatarFile(null);
                } else {
                  setAvatarFile(file);
                  setFormData({ ...formData, avatarRemoved: false });
                }
              }}
              label=""
              isAvatar={true}
            />
          </div>

          <div className="space-y-5">
            <Input
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Mobile Number"
              name="phone"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="mt-8 flex flex-col md:flex-row gap-4">
            <Button
              onClick={handleEditCancel}
              variant="outline"
              className="w-full rounded-xl"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              className="w-full rounded-xl"
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* --- LOGOUT CONFIRMATION DIALOG --- */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-3xl w-full max-w-sm p-6 shadow-xl animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error mx-auto mb-4">
              <span className="material-symbols-outlined text-[28px]">logout</span>
            </div>
            <h3 className="text-center font-headline-sm text-xl font-bold text-on-surface mb-2">Log Out</h3>
            <p className="text-center font-body-sm text-muted-text mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1 rounded-xl"
                onClick={handleLogout}
              >
                Log Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE ACCOUNT CONFIRMATION DIALOG --- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-3xl w-full max-w-md p-6 shadow-xl animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error mx-auto mb-4">
              <span className="material-symbols-outlined text-[28px]">warning</span>
            </div>
            <h3 className="text-center font-headline-sm text-xl font-bold text-on-surface mb-2">Delete Account?</h3>
            <p className="text-center font-body-sm text-muted-text mb-6">
              Your account will be deactivated and you will be logged out. Your account data and booking history will remain securely stored. If you deleted your account by mistake, you can request account recovery.
            </p>

            <div className="mb-6 text-left">
              <label className="block text-sm font-medium text-on-surface mb-2">Reason for deletion (Optional)</label>
              <select 
                className="w-full p-3 rounded-xl border border-border bg-surface-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              >
                <option value="">Select a reason</option>
                <option value="I no longer use GlentroSalon">I no longer use GlentroSalon</option>
                <option value="Privacy concerns">Privacy concerns</option>
                <option value="I created another account">I created another account</option>
                <option value="Other">Other</option>
              </select>
              
              {deleteReason === 'Other' && (
                <textarea
                  className="w-full mt-3 p-3 rounded-xl border border-border bg-surface-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none h-24"
                  placeholder="Please specify your reason (max 500 characters)"
                  maxLength={500}
                  onChange={(e) => setDeleteReason(`Other: ${e.target.value}`)}
                />
              )}
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteReason('');
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1 rounded-xl"
                onClick={handleDeleteAccount}
                loading={isDeleting}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Glentro Wallet Transactions Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface rounded-3xl border border-border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">Glentro Wallet History</h3>
                  <p className="text-xs text-muted-text">Balance: ₹{(walletData?.wallet?.balance || 0).toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-variant flex items-center justify-center text-muted-text"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {walletData?.history?.transactions?.length > 0 ? (
                walletData.history.transactions.map((txn) => (
                  <div key={txn._id} className="p-3.5 rounded-2xl bg-surface-variant/40 border border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        txn.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                      }`}>
                        <span className="material-symbols-outlined text-[20px]">
                          {txn.type === 'CREDIT' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-on-surface">{txn.description || 'Wallet transaction'}</p>
                        <p className="text-[11px] text-muted-text">{new Date(txn.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${txn.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {txn.type === 'CREDIT' ? '+' : '-'}₹{(txn.amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-muted-text">
                  <span className="material-symbols-outlined text-4xl mb-2 text-muted-text/50">receipt_long</span>
                  <p className="text-sm">No wallet transactions yet.</p>
                  <p className="text-xs mt-1">Book online with Razorpay to earn cashback!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Location Modal */}
      <LocationSelectionModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />
    </div>
  );
};

export default ProfilePage;
