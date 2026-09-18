import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, uploadLicense, errMsg } from '../api/client';

const LICENSE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_LICENSE_MB = 10;

export default function Register() {
  const { register, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [role, setRole] = useState(params.get('role') === 'seller' ? 'seller' : 'customer');
  const [form, setForm] = useState({ name: '', email: '', password: '', storeName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /* Step 1 = account details. Step 2 = license upload (sellers only) — runs
     AFTER the account exists, so the authenticated upload endpoint accepts it. */
  const [step, setStep] = useState(1);
  const [license, setLicense] = useState(null);
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ------------------------------------------------ step 1: create account */
  async function handleCreateAccount(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await register({ ...form, role });
      setVerificationCode(res?.devCode || '');
      /* token is stored now — the license upload in step 2 will authenticate */
      if (role === 'seller') {
        setStep(2);
      } else {
        navigate('/verify-email', { state: { justRegistered: true, email: form.email, devCode: res?.devCode } });
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------- step 2: license upload/pick */
  function pickLicense(e) {
    setLicenseError('');
    const f = e.target.files?.[0];
    if (!f) return;
    if (!LICENSE_TYPES.includes(f.type)) {
      e.target.value = '';
      return setLicenseError('License must be a PDF or an image (JPG, PNG, WebP).');
    }
    if (f.size > MAX_LICENSE_MB * 1024 * 1024) {
      e.target.value = '';
      return setLicenseError(`License must be under ${MAX_LICENSE_MB} MB.`);
    }
    setLicense(f);
    setLicenseInfo(null);
  }

  async function handleUploadLicense() {
    if (!license) return;
    setLicenseError('');
    setUploading(true);
    try {
      /* 1) store the file, 2) attach it to the account (enters the approval queue) */
      const up = await uploadLicense(license);
      const res = await authApi.submitLicense({ licenseUrl: up.url, licenseOriginalName: license.name });
      setLicenseInfo({ url: res.user?.licenseUrl || up.url, originalName: license.name });
      await refreshUser(); /* header user now carries licenseUrl */
    } catch (err) {
      setLicenseError(errMsg(err));
    } finally {
      setUploading(false);
    }
  }

  function finish() {
    navigate('/verify-email', { state: { justRegistered: true, email: form.email, devCode: verificationCode } });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Create your account</h1>

      {step === 1 ? (
        <>
          {/* role toggle */}
          <div className="mt-4 flex rounded-lg border border-slate-200 p-1 text-sm">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`flex-1 rounded-md px-3 py-2 ${role === 'customer' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              I'm a customer
            </button>
            <button
              type="button"
              onClick={() => setRole('seller')}
              className={`flex-1 rounded-md px-3 py-2 ${role === 'seller' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              I'm a seller
            </button>
          </div>

          <form onSubmit={handleCreateAccount} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Full name</label>
              <input value={form.name} onChange={set('name')} required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Jane Doe" />
            </div>

            {role === 'seller' && (
              <div>
                <label className="mb-1 block text-sm font-medium">Store name</label>
                <input value={form.storeName} onChange={set('storeName')} required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Acme Electronics" />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input type="email" value={form.email} onChange={set('email')} required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="you@example.com" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input type="password" value={form.password} onChange={set('password')} required minLength={6} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="At least 6 characters" />
            </div>

            {role === 'seller' && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                📄 After creating your account you'll upload your business license — an admin reviews it before your store goes live.
              </p>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Creating account…' : role === 'seller' ? 'Continue — add license' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-sm text-slate-600">
            Already have an account? <Link to="/login" className="font-medium text-slate-900 hover:underline">Log in</Link>
          </p>
        </>
      ) : (
        /* -------------------------------------- step 2: license for sellers */
        <>
          <p className="mt-2 text-slate-600">
            Account created ✅ — one last step: upload your <strong>business license</strong> so an admin can verify <strong>{form.storeName || 'your store'}</strong>.
          </p>

          <div className="mt-6 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center">
            <input
              id="license-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={pickLicense}
              className="hidden"
            />
            {!license && !licenseInfo && (
              <>
                <div className="text-4xl">📄</div>
                <label
                  htmlFor="license-file"
                  className="mt-3 inline-block cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Choose license file
                </label>
                <p className="mt-2 text-xs text-slate-500">PDF, JPG, PNG or WebP · up to {MAX_LICENSE_MB} MB</p>
              </>
            )}

            {license && !licenseInfo && (
              <div>
                <div className="text-4xl">📎</div>
                <p className="mt-2 text-sm font-medium">{license.name}</p>
                <p className="text-xs text-slate-500">{(license.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  type="button"
                  onClick={handleUploadLicense}
                  disabled={uploading}
                  className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload license'}
                </button>
                <label htmlFor="license-file" className="mt-2 block cursor-pointer text-xs text-slate-500 hover:underline">
                  choose a different file
                </label>
              </div>
            )}

            {licenseInfo && (
              <div>
                <div className="text-4xl">✅</div>
                <p className="mt-2 text-sm font-semibold text-emerald-700">License uploaded</p>
                <p className="text-xs text-slate-500">
                  {licenseInfo.originalName || 'document'} — stored securely for admin review
                </p>
              </div>
            )}
          </div>

          {licenseError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{licenseError}</p>}

          <button
            type="button"
            onClick={finish}
            className="mt-6 w-full rounded-lg bg-slate-900 py-2.5 font-semibold text-white hover:bg-slate-800"
          >
            {licenseInfo ? 'Go to Seller Hub →' : license ? 'Skip for now (approval needs a license)' : 'Skip for now — upload later'}
          </button>
          {licenseInfo && (
            <p className="mt-2 text-center text-xs text-slate-500">
              Your store is in the approval queue — you'll get a 🔔 notification when it's reviewed.
            </p>
          )}
        </>
      )}
    </div>
  );
}
