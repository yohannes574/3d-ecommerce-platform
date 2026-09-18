import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { authApi, errMsg } from '../api/client';

/** Accepts a legacy link or the six-digit code from the verification email. */
export default function VerifyEmail() {
  const { token: pathToken } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const token = pathToken || params.get('token') || '';
  const [email, setEmail] = useState(location.state?.email || params.get('email') || '');
  const [code, setCode] = useState('');
  const [state, setState] = useState(token ? 'verifying' : 'form');
  const [error, setError] = useState('');
  const justRegistered = location.state?.justRegistered;
  const devCode = location.state?.devCode;

  useEffect(() => {
    if (!token) return;
    authApi
      .verifyEmail(token)
      .then(() => setState('ok'))
      .catch((e) => {
        setError(errMsg(e));
        setState('error');
      });
  }, [token]);

  async function submitCode(e) {
    e.preventDefault();
    setState('verifying');
    setError('');
    try {
      await authApi.verifyEmailCode(email, code);
      setState('ok');
    } catch (err) {
      setError(errMsg(err));
      setState('error');
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card fade-up p-10 text-center">
        {state === 'verifying' && (
          <>
            <div className="mb-3 text-5xl">Checking...</div>
            <h1 className="text-xl font-extrabold">Verifying your email...</h1>
          </>
        )}
        {state === 'ok' && (
          <>
            <div className="mb-3 text-5xl">Verified</div>
            <h1 className="text-xl font-extrabold">Email verified!</h1>
            <p className="mt-2 text-sm text-slate-400">Your address is confirmed. You can log in and start shopping.</p>
            <Link to="/login" className="btn-primary mt-6">Go to login</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="mb-3 text-5xl">Error</div>
            <h1 className="text-xl font-extrabold">Verification failed</h1>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
            <button type="button" onClick={() => setState('form')} className="btn-primary mt-6">Try again</button>
          </>
        )}
        {state === 'form' && (
          <>
            <div className="mb-3 text-5xl">Email</div>
            <h1 className="text-xl font-extrabold">Verify your email</h1>
            <p className="mt-2 text-sm text-slate-400">
              {justRegistered ? 'Enter the six-digit code we sent to your email.' : 'Enter the verification code from your email.'}
            </p>
            <form onSubmit={submitCode} className="mt-6 space-y-3 text-left">
              <label className="label">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
              <label className="label">Verification code</label>
              <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="input text-center text-2xl tracking-[0.4em]" placeholder="000000" />
              {devCode && <p className="text-xs text-slate-500">Development code: {devCode}</p>}
              <button type="submit" className="btn-primary w-full">Verify email</button>
            </form>
            <Link to="/login" className="mt-6 inline-block text-sm text-cyan-300 hover:underline">Back to login</Link>
          </>
        )}
      </div>
    </div>
  );
}
