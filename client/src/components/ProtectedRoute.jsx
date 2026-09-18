import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <div className="card p-10">
          <div className="mb-3 text-5xl">🚫</div>
          <h1 className="mb-2 text-2xl font-bold">403 — No access</h1>
          <p className="text-sm text-slate-400">This area is reserved for: {roles.join(', ')}.</p>
        </div>
      </div>
    );
  }
  return children;
}
