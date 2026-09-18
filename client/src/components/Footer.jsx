import { Link } from 'react-router-dom';
import { CATEGORIES } from '../constants';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-slate-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-lg font-extrabold">
            <span>⚡</span>
            <span className="bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">Voltix</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-400">
            The multi-vendor electronics marketplace where you can explore products in interactive 3D before you buy.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold tracking-wider text-slate-200 uppercase">Shop</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link className="hover:text-cyan-300" to="/products">All products</Link></li>
            {CATEGORIES.slice(0, 4).map((c) => (
              <li key={c.value}>
                {c.live ? (
                  <Link className="hover:text-cyan-300" to={`/products?category=${c.value}`}>
                    {c.icon} {c.label}
                  </Link>
                ) : (
                  <span title="Coming soon">{c.icon} {c.label} · soon</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold tracking-wider text-slate-200 uppercase">Sell</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link className="hover:text-cyan-300" to="/register?role=seller">Become a seller</Link></li>
            <li><Link className="hover:text-cyan-300" to="/seller">Seller dashboard</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold tracking-wider text-slate-200 uppercase">Account</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li><Link className="hover:text-cyan-300" to="/login">Log in</Link></li>
            <li><Link className="hover:text-cyan-300" to="/register">Create account</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 text-center text-xs text-slate-500">
        Voltix © {new Date().getFullYear()} — MERN + react-three-fiber demo project. Smartphone-first, built for every category.
      </div>
    </footer>
  );
}
