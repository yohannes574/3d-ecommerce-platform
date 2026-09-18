import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { cartApi } from '../api/client';
import { useAuth } from './AuthContext';
import { toast } from '../utils/toast';

const CartCtx = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'customer') {
      cartApi.get().then((d) => setCount(d.count)).catch(() => {});
    } else {
      setCount(0);
    }
  }, [user?._id, user?.role]);

  /** add(productId, qty, variant) — variant: [{name, value}] */
  const addToCart = useCallback(async (productId, qty = 1, variant = []) => {
    const d = await cartApi.add({ productId, qty, variant });
    setCount(d.count);
    toast('Added to cart 🛒');
    return d;
  }, []);

  const refresh = useCallback(
    () =>
      user?.role === 'customer'
        ? cartApi.get().then((d) => setCount(d.count)).catch(() => {})
        : Promise.resolve(),
    [user?._id, user?.role]
  );

  const clearCount = () => setCount(0);

  return (
    <CartCtx.Provider value={{ count, setCount, addToCart, refresh, clearCount }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);
