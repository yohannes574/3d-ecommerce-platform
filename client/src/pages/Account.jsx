import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi, errMsg } from '../api/client';
import { toast } from '../utils/toast';

const ADDRESS_FIELDS = [
  ['fullName', 'Full name'],
  ['phone', 'Phone number'],
  ['line1', 'Address line'],
  ['city', 'City'],
  ['country', 'Country'],
];

export default function Account() {
  const { user, setUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [shopName, setShopName] = useState(user?.shopName || '');
  const [address, setAddress] = useState({
    fullName: user?.address?.fullName || user?.name || '',
    phone: user?.address?.phone || '',
    line1: user?.address?.line1 || '',
    city: user?.address?.city || '',
    country: user?.address?.country || '',
  });

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name, address };
      if (user.role === 'seller') payload.shopName = shopName;
      const d = await authApi.updateMe(payload);
      setUser(d.user);
      toast(d.message || 'Profile updated');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast('New passwords do not match.', 'error');
    setBusy(true);
    try {
      await authApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast('Password changed.');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold">👤 My account</h1>
      <p className="mt-1 text-sm text-slate-400">
        {user?.email} · <span className="capitalize">{user?.role}</span>
      </p>

      <div className="mt-8 space-y-6">
        {/* profile + address */}
        <form onSubmit={saveProfile} className="card p-6">
          <h2 className="mb-4 font-bold">Profile & default address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Your name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {user.role === 'seller' && (
              <div>
                <label className="label">Store name</label>
                <input className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} />
              </div>
            )}
            {ADDRESS_FIELDS.map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  value={address[key]}
                  onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
                  placeholder="Used to prefill checkout"
                />
              </div>
            ))}
          </div>
          <button className="btn-primary mt-5" disabled={busy}>Save profile</button>
        </form>

        {/* password */}
        <form onSubmit={savePassword} className="card p-6">
          <h2 className="mb-4 font-bold">Change password</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Current</label>
              <input type="password" required className="input" value={pw.currentPassword}
                onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} />
            </div>
            <div>
              <label className="label">New (min 6)</label>
              <input type="password" required minLength={6} className="input" value={pw.newPassword}
                onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} />
            </div>
            <div>
              <label className="label">Confirm new</label>
              <input type="password" required className="input" value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary mt-5" disabled={busy}>Change password</button>
        </form>
      </div>
    </div>
  );
}
