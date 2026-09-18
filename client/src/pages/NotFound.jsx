import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 pt-28 text-center">
      <div className="card p-12">
        <div className="mb-4 text-7xl">🛸</div>
        <h1 className="text-3xl font-extrabold">404</h1>
        <p className="mt-2 text-sm text-slate-400">This page drifted out of orbit.</p>
        <Link to="/" className="btn-primary mt-6">← Back to Voltix</Link>
      </div>
    </div>
  );
}
