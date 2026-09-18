import axios from 'axios';

const TOKEN_KEY = 'voltix_token';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export const errMsg = (e) =>
  e?.response?.data?.message || e?.message || 'Something went wrong';

/* ---------------- API helpers ---------------- */

export const authApi = {
  login: (d) => api.post('/auth/login', d).then((r) => r.data),
  register: (d) => api.post('/auth/register', d).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateMe: (d) => api.put('/auth/me', d).then((r) => r.data),
  changePassword: (d) => api.put('/auth/password', d).then((r) => r.data),
  submitLicense: (d) => api.post('/auth/license', d).then((r) => r.data),
  verifyEmail: (token) => api.get(`/auth/verify/${token}`).then((r) => r.data),
  verifyEmailCode: (email, code) => api.post('/auth/verify-code', { email, code }).then((r) => r.data),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }).then((r) => r.data),
};

/** Upload a payment receipt screenshot (image) → { url, kind, size } */
export async function uploadPaymentProof(file) {
  const fd = new FormData();
  fd.append('file', file);
  return api
    .post('/upload/payment', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
}

/** Upload a seller license document (pdf/image) → { url, kind, size } */
export async function uploadLicense(file) {
  const fd = new FormData();
  fd.append('file', file);
  return api
    .post('/upload/license', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
}

export const productApi = {
  list: (params = {}) => api.get('/products', { params }).then((r) => r.data),
  meta: () => api.get('/products/meta').then((r) => r.data),
  get: (id) => api.get(`/products/${id}`).then((r) => r.data),
};

export const sellerApi = {
  stats: () => api.get('/seller/stats').then((r) => r.data),
  orders: () => api.get('/seller/orders').then((r) => r.data),
  mine: () => api.get('/seller/products').then((r) => r.data),
  get: (id) => api.get(`/seller/products/${id}`).then((r) => r.data),
  create: (d) => api.post('/seller/products', d).then((r) => r.data),
  update: (id, d) => api.put(`/seller/products/${id}`, d).then((r) => r.data),
  remove: (id) => api.delete(`/seller/products/${id}`).then((r) => r.data),
};

export const adminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data),
  orders: (params = {}) => api.get('/orders', { params }).then((r) => r.data),
  setOrderStatus: (id, status) =>
    api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
  sellers: (params = {}) => api.get('/admin/sellers', { params }).then((r) => r.data),
  setSellerStatus: (id, status) =>
    api.patch(`/admin/sellers/${id}/status`, { status }).then((r) => r.data),
  products: (params = {}) => api.get('/admin/products', { params }).then((r) => r.data),
  setProductStatus: (id, status) =>
    api.patch(`/admin/products/${id}/status`, { status }).then((r) => r.data),
  setFeatured: (id, featured) =>
    api.patch(`/admin/products/${id}/featured`, { featured }).then((r) => r.data),
};

export const cartApi = {
  get: () => api.get('/cart').then((r) => r.data),
  add: (d) => api.post('/cart', d).then((r) => r.data),
  update: (itemId, qty) => api.patch(`/cart/${itemId}`, { qty }).then((r) => r.data),
  remove: (itemId) => api.delete(`/cart/${itemId}`).then((r) => r.data),
};

export const orderApi = {
  place: (d) => api.post('/orders', d).then((r) => r.data),
  mine: () => api.get('/orders/mine').then((r) => r.data),
  cancel: (id) => api.patch(`/orders/${id}/cancel`).then((r) => r.data),
  confirm: (id) => api.patch(`/orders/${id}/confirm`).then((r) => r.data), // seller
  rejectPayment: (id) => api.patch(`/orders/${id}/reject-payment`).then((r) => r.data), // seller
  all: (params = {}) => api.get('/orders', { params }).then((r) => r.data), // admin
  setStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }).then((r) => r.data), // admin
};

export const paymentApi = {
  config: () => api.get('/payments/config').then((r) => r.data),
  chapaInit: (orderId) => api.post('/payments/chapa/init', { orderId }).then((r) => r.data),
};

export const notificationApi = {
  list: (params = {}) => api.get('/notifications', { params }).then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
};

export const reviewApi = {
  product: (id, page = 1) =>
    api.get(`/reviews/product/${id}`, { params: { page } }).then((r) => r.data),
  mine: () => api.get('/reviews/mine').then((r) => r.data),
  create: (d) => api.post('/reviews', d).then((r) => r.data),
  update: (id, d) => api.put(`/reviews/${id}`, d).then((r) => r.data),
  remove: (id) => api.delete(`/reviews/${id}`).then((r) => r.data),
};

/** Upload an image or .glb model → { url, kind, size } */
export async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  return api
    .post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
}

export default api;
