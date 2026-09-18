import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const link = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-white/10 text-cyan-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-4 flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span className="text-2xl">⚡</span>
          <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-cyan-300 bg-clip-text text-transparent">
            Voltix
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <NavLink to="/products" className={link}>Products</NavLink>
          {user?.role === 'seller' && (
            <NavLink to="/seller" className={link} end>Seller Hub</NavLink>
          )}
          {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              {user.role === 'customer' && (
                <>
                  <NavLink to="/orders" className={link}>Orders</NavLink>
                  <NavLink to="/cart" className={`${link} relative`}>
                    🛒 Cart
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-1 text-[10px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </NavLink>
                </>
              )}
              <div className="group relative hidden md:block">
                <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white uppercase">
                    {user.name?.charAt(0)}
                  </span>
                  <span className="max-w-[140px] truncate text-sm font-semibold text-slate-200">
                    {user.role === 'seller' ? user.shopName || user.name : user.name}
                  </span>
                </button>
                <div className="invisible absolute right-0 z-50 w-48 rounded-xl border border-white/10 bg-slate-900 p-1.5 opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100">
                  <div className="px-3 py-2 text-xs text-slate-400 capitalize">{user.email} · {user.status === 'pending' ? `${user.role} (pending)` : user.role}</div>
                  {(user.role === 'seller' || user.role === 'admin') && (
                    <Link to={user.role === 'admin' ? '/admin' : '/seller'} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/10">
                      Dashboard
                    </Link>
                  )}
                  <Link to="/account" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/10">
                    My account
                  </Link>
                  <button onClick={handleLogout} className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10">
                    Log out
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Log in</Link>
              <Link to="/register" className="btn-primary">Sign up</Link>
            </>
          )}
          <button className="ml-1 rounded-lg px-2 py-2 text-xl md:hidden" onClick={() => setOpen(!open)}>
            ☰
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-white/10 px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
          <div className="flex flex-col gap-1">
            <NavLink to="/products" className={link}>Products</NavLink>
            {user && <NavLink to="/account" className={link}>My account</NavLink>}
            {user?.role === 'customer' && <NavLink to="/cart" className={link}>Cart</NavLink>}
            {user?.role === 'seller' && <NavLink to="/seller" className={link}>Seller Hub</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
            {user && (
              <button onClick={handleLogout} className="btn-danger mt-2">Log out</button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
