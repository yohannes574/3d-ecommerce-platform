import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, errMsg } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(null); // { email, devCode? }
  const [resent, setResent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNeedsVerify(null);
    try {
      const user = await login(email, password);
      const from = location.state?.from;
      navigate(user.role === 'admin' ? '/admin' : user.role === 'seller' ? '/seller' : from || '/');
    } catch (err) {
      const data = err?.response?.data;
      if (data?.needsVerification) {
        setNeedsVerify({ email: data.email, devCode: data.devCode });
        setResent(false);
      } else {
        setError(errMsg(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!needsVerify?.email) return;
    setBusy(true);
    try {
      const d = await authApi.resendVerification(needsVerify.email);
      setResent(true);
      if (d.devCode) setNeedsVerify((v) => ({ ...v, devCode: d.devCode }));
    } catch {
      /* response is intentionally uniform — nothing to surface */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card fade-up p-8">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">⚡</div>
          <h1 className="text-2xl font-extrabold">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Log in to shop, sell or manage Voltix.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        {needsVerify && (
          <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="font-semibold">📧 Verify your email to continue</div>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
              We sent a six-digit verification code to <b>{needsVerify.email}</b>.
            </p>
            <Link to="/verify-email" state={{ email: needsVerify.email, devCode: needsVerify.devCode }} className="mt-2 inline-block text-xs font-semibold text-cyan-300 hover:underline">
              Enter verification code →
            </Link>
            {resent ? (
              <p className="mt-2 text-xs text-emerald-300">✓ Fresh link sent — check the mailer log or your inbox.</p>
            ) : (
              <button type="button" onClick={resend} disabled={busy}
                className="mt-2 block cursor-pointer text-xs font-semibold text-cyan-300 hover:underline">
                Resend verification email
              </button>
            )}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required className="input" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New here?{' '}
          <Link to="/register" className="font-semibold text-cyan-300 hover:underline">Create an account</Link>
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-xs leading-relaxed text-slate-500">
          Demo accounts — admin@voltix.com / admin123 · seller@voltix.com / seller123 · customer@voltix.com / cust123
        </div>
      </div>
    </div>
  );
}
