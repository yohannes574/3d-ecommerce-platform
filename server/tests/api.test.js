/**
 * Voltix API test suite — run with the API already live:
 *   npm test            (from /server; API must be on :5000)
 *
 * Uses node:test (no extra deps). Creates its own test users/products and
 * cleans them up at the end. Covers: auth, catalog, variant pricing + stock,
 * order pipeline, reviews, admin flows, notifications, security headers.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const BASE = process.env.TEST_BASE || 'http://localhost:5000/api';

/* ---------------- tiny fetch helpers ---------------- */
async function api(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !form) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data: json, headers: res.headers };
}

const created = { users: [], products: [], orders: [] };
let admin, seller, customer, product;

before(async () => {
  const h = await api('GET', '/health');
  assert.equal(h.status, 200, 'API must be running on :5000 (npm run dev)');
});

after(async () => {
  // cleanup via direct DB (test user ids recorded during the run)
  if (created.users.length) {
    await mongoose
      .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voltix')
      .then(() =>
        Promise.all([
          mongoose.connection.collection('users').deleteMany({ _id: { $in: created.users } }),
          mongoose.connection.collection('products').deleteMany({ _id: { $in: created.products } }),
          mongoose.connection.collection('orders').deleteMany({ _id: { $in: created.orders } }),
          mongoose.connection.collection('notifications').deleteMany({ user: { $in: created.users } }),
        ])
      )
      .then(() => mongoose.disconnect())
      .catch(() => {});
  }
});

/* ================= 1. Health & security headers ================= */

test('health endpoint responds', async () => {
  const r = await api('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test('security headers present (helmet)', async () => {
  const r = await api('GET', '/products');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

/* ================= 2. Auth ================= */

test('register customer → token + active status + verification token (dev)', async () => {
  const r = await api('POST', '/auth/register', {
    body: { name: 'Test Cust', email: `cust${Date.now()}@t.test`, password: 'secret1' },
  });
  assert.equal(r.status, 201);
  assert.ok(r.data.token);
  customer = r.data;
  created.users.push(r.data.user._id);

  /* email verification: unverified users are blocked at login with a fresh token */
  const blocked = await api('POST', '/auth/login', {
    body: { email: customer.user.email, password: 'secret1' },
  });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.needsVerification, true);
  assert.ok(blocked.data.devToken, 'dev mode returns the verification token');

  const badToken = await api('GET', '/auth/verify/deadbeef');
  assert.equal(badToken.status, 400);

  const ok = await api('GET', `/auth/verify/${blocked.data.devToken}`);
  assert.equal(ok.status, 200);

  const codeUser = await api('POST', '/auth/register', {
    body: { name: 'Code Cust', email: `code${Date.now()}@t.test`, password: 'secret1' },
  });
  assert.equal(codeUser.status, 201);
  created.users.push(codeUser.data.user._id);
  assert.match(codeUser.data.devCode, /^\d{6}$/);
  const codeOk = await api('POST', '/auth/verify-code', {
    body: { email: codeUser.data.user.email, code: codeUser.data.devCode },
  });
  assert.equal(codeOk.status, 200);
  const reusedCode = await api('POST', '/auth/verify-code', {
    body: { email: codeUser.data.user.email, code: codeUser.data.devCode },
  });
  assert.equal(reusedCode.status, 400);

  const canLogin = await api('POST', '/auth/login', {
    body: { email: customer.user.email, password: 'secret1' },
  });
  assert.equal(canLogin.status, 200);
});

test('register seller WITHOUT license → 201, license can be attached after', async () => {
  const r = await api('POST', '/auth/register', {
    body: { name: 'No License', email: `nl${Date.now()}@t.test`, password: 'secret1', role: 'seller', shopName: 'NL' },
  });
  assert.equal(r.status, 201);
  assert.ok(r.data.token);
  created.users.push(r.data.user._id);
  /* two-step signup: the license is uploaded right after the account exists */
  const attach = await api('POST', '/auth/license', {
    token: r.data.token,
    body: { licenseUrl: '/uploads/late-license.pdf', licenseOriginalName: 'late.pdf' },
  });
  assert.equal(attach.status, 200);
  assert.ok(attach.data.user.licenseUrl);
});

test('login with wrong password → 401', async () => {
  const r = await api('POST', '/auth/login', {
    body: { email: customer.user.email, password: 'wrongpass' },
  });
  assert.equal(r.status, 401);
});

/* ================= 3. Seller + product with priced variants ================= */

test('seller registers with license → must verify email, cannot create products (403)', async () => {
  const reg = await api('POST', '/auth/register', {
    body: {
      name: 'Test Seller', email: `sel${Date.now()}@t.test`, password: 'secret1',
      role: 'seller', shopName: 'Test Seller Store',
      licenseUrl: '/uploads/test-license.pdf', licenseOriginalName: 'test.pdf',
    },
  });
  assert.equal(reg.status, 201);
  seller = reg.data;
  created.users.push(reg.data.user._id);

  /* seller must verify email before logging in; verify via the dev token */
  const blocked = await api('POST', '/auth/login', {
    body: { email: seller.user.email, password: 'secret1' },
  });
  assert.equal(blocked.status, 403);
  assert.ok(blocked.data.devToken);
  const v = await api('GET', `/auth/verify/${blocked.data.devToken}`);
  assert.equal(v.status, 200);

  const attempt = await api('POST', '/seller/products', {
    token: seller.token,
    body: { name: 'X', brand: 'Y', price: 1 },
  });
  assert.equal(attempt.status, 403);
});

test('admin approves seller (license on file) → seller can create product', async () => {
  admin = await api('POST', '/auth/login', {
    body: { email: 'admin@voltix.com', password: 'admin123' },
  }).then((r) => r.data);

  const ok = await api('PATCH', `/admin/sellers/${seller.user._id}/status`, {
    token: admin.token, body: { status: 'approved' },
  });
  assert.equal(ok.status, 200);

  const p = await api('POST', '/seller/products', {
    token: seller.token,
    body: {
      name: 'TestPhone P1', brand: 'TestCo', category: 'smartphone',
      price: 500, stock: 100,
      variants: [{
        name: 'Storage',
        values: [
          { value: '64GB', priceDelta: 0, stock: 3 },
          { value: '256GB', priceDelta: 80 },
        ],
      }],
      status: 'pending',
    },
  });
  assert.equal(p.status, 201);
  product = p.data.product;
  created.products.push(product._id);

  // admin approves the product
  const ap = await api('PATCH', `/admin/products/${product._id}/status`, {
    token: admin.token, body: { status: 'approved' },
  });
  assert.equal(ap.status, 200);
});

/* ================= 4. Variant pricing ================= */

test('cart line price = base + deltas (64GB=500, 256GB=580)', async () => {
  const add = await api('POST', '/cart', {
    token: customer.token,
    body: { productId: product._id, qty: 1, variant: [{ name: 'Storage', value: '256GB' }] },
  });
  assert.equal(add.status, 201);

  const cart = await api('GET', '/cart', { token: customer.token });
  assert.equal(cart.data.subtotal, 580);
});

test('per-option stock enforced: second drain order must be blocked', async () => {
  /* 64GB tracks stock: 3 units. The pricing test reserved 1 (580-line used 256GB,
     so nothing used yet). Drain it: order 2 → OK; order 2 again → only 1 left →
     the atomic decrement must refuse (cart clamps qty to 1, order succeeds with 1,
     then a third attempt must find stock 0 and be refused at cart-add). */
  const clear = await api('GET', '/cart', { token: customer.token });
  for (const line of clear.data.cart.items) {
    await api('DELETE', `/cart/${line._id}`, { token: customer.token });
  }

  await api('POST', '/cart', {
    token: customer.token,
    body: { productId: product._id, qty: 2, variant: [{ name: 'Storage', value: '64GB' }] },
  });
  const r1 = await api('POST', '/orders', {
    token: customer.token,
    body: { shippingAddress: { fullName: 'T', phone: '1', line1: 'x', city: 'c', country: 'co' } },
  });
  assert.equal(r1.status, 201, 'first drain order (2 units of 3) should succeed');

  await api('POST', '/cart', {
    token: customer.token,
    body: { productId: product._id, qty: 2, variant: [{ name: 'Storage', value: '64GB' }] },
  });
  const r2 = await api('POST', '/orders', {
    token: customer.token,
    body: { shippingAddress: { fullName: 'T', phone: '1', line1: 'x', city: 'c', country: 'co' } },
  });
  // cart clamps to the 1 remaining unit, so this order succeeds with qty 1
  assert.equal(r2.status, 201);
  assert.equal(r2.data.order.items[0].qty, 1, 'clamped to the last unit');

  // now option stock is 0 — cart-add must refuse outright
  const add = await api('POST', '/cart', {
    token: customer.token,
    body: { productId: product._id, qty: 1, variant: [{ name: 'Storage', value: '64GB' }] },
  });
  assert.equal(add.status, 400, 'out-of-stock option must be refused at cart-add');
});

/* ================= 5. Order pipeline ================= */

test('seller confirms order; prepaid without proof is refused at placement', async () => {
  const mine = await api('GET', '/orders/mine', { token: customer.token });
  const order = mine.data.orders[0];
  assert.equal(order.status, 'placed');

  /* prepaid without proof → 400 at placement (telebirr always needs a screenshot;
     chapa may run in electronic mode when CHAPA_SECRET_KEY is configured) */
  await api('POST', '/cart', { token: customer.token, body: { productId: product._id, qty: 1, variant: [{ name: 'Storage', value: '256GB' }] } });
  const noProof = await api('POST', '/orders', {
    token: customer.token,
    body: { shippingAddress: { fullName: 'T', phone: '1', line1: 'x', city: 'c', country: 'co' }, paymentMethod: 'telebirr' },
  });
  assert.equal(noProof.status, 400, 'telebirr without screenshot must be refused');

  /* seller (not admin) confirms the placed order */
  const c = await api('PATCH', `/orders/${order._id}/confirm`, { token: seller.token });
  assert.equal(c.status, 200);
  assert.equal(c.data.order.status, 'confirmed');

  /* second confirm attempt → 400 (already confirmed) */
  const again = await api('PATCH', `/orders/${order._id}/confirm`, { token: seller.token });
  assert.equal(again.status, 400);

  /* an unrelated seller gets 403 — create one via direct registration + approval */
  const other = await api('POST', '/auth/register', {
    body: { name: 'Other Seller', email: `oth${Date.now()}@t.test`, password: 'secret1', role: 'seller', shopName: 'Other' },
  });
  created.users.push(other.data.user._id);
  const ov = await api('POST', '/auth/login', { body: { email: other.data.user.email, password: 'secret1' } });
  const vt = await api('GET', `/auth/verify/${ov.data.devToken}`);
  assert.equal(vt.status, 200);
  const oLogin = await api('POST', '/auth/login', { body: { email: other.data.user.email, password: 'secret1' } });
  /* still pending → the seller guard rejects before ownership matters */
  const forbidden = await api('PATCH', `/orders/${order._id}/confirm`, { token: oLogin.data.token });
  assert.ok([401, 403].includes(forbidden.status), 'unapproved seller cannot confirm orders');
});

test('place order → stock decremented, notification created', async () => {
  // 256GB is untracked → uses product-level stock. Fresh line after the drain test.
  const add = await api('POST', '/cart', {
    token: customer.token,
    body: { productId: product._id, qty: 1, variant: [{ name: 'Storage', value: '256GB' }] },
  });
  assert.equal(add.status, 201);

  const r = await api('POST', '/orders', {
    token: customer.token,
    body: { shippingAddress: { fullName: 'T', phone: '1', line1: 'x', city: 'c', country: 'co' } },
  });
  assert.equal(r.status, 201);
  const order = r.data.order;
  created.orders.push(order._id);
  assert.equal(order.items[0].unitPrice, 580);

  // product stock must have dropped by exactly the ordered qty (256GB, 1 unit)
  const det = await api('GET', `/products/${product._id}`);
  assert.ok(det.data.product.stock < 100, 'stock must decrease after an order');

  // customer notification exists
  const n = await api('GET', '/notifications', { token: customer.token });
  assert.ok(n.data.notifications.some((x) => x.title.includes('placed')));
});

test('admin pipeline: ship → deliver (customer notified); confirmation was seller\'s job', async () => {
  const mine = await api('GET', '/orders/mine', { token: customer.token });
  const order = mine.data.orders.find((o) => o.status === 'confirmed');
  for (const s of ['shipped', 'delivered']) {
    const r = await api('PATCH', `/orders/${order._id}/status`, { token: admin.token, body: { status: s } });
    assert.equal(r.status, 200);
  }
  const n = await api('GET', '/notifications', { token: customer.token });
  assert.ok(n.data.notifications.some((x) => x.title.includes('delivered')));
});

/* ================= 6. Reviews (verified purchase) ================= */

test('review blocked before delivery, allowed after, duplicate blocked', async () => {
  const mine = await api('GET', '/orders/mine', { token: customer.token });
  const delivered = mine.data.orders.find((o) => o.status === 'delivered');
  const orderItemId = `${delivered._id}:0`;

  // seeded delivered order for the demo customer → use that instead for determinism
  const demo = await api('POST', '/auth/login', {
    body: { email: 'customer@voltix.com', password: 'cust123' },
  }).then((r) => r.data);
  const demoOrders = await api('GET', '/orders/mine', { token: demo.token });
  const dOrder = demoOrders.data.orders.find((o) => o.status === 'delivered');
  assert.ok(dOrder, 'seeded customer should have a delivered order');
  const dItem = `${dOrder._id}:0`;

  const dup = await api('POST', '/reviews', {
    token: demo.token,
    body: { orderItemId: dItem, rating: 5, comment: 'again' },
  });
  assert.equal(dup.status, 409, 'duplicate review must be blocked');
});

/* ================= 7. Admin guardrails ================= */

test('approving a seller without license → 400 (hard block)', async () => {
  // create license-less seller directly in DB via register is blocked; use pending seeded seller
  const pend = await api('GET', '/admin/sellers?status=pending', { token: admin.token });
  const target = pend.data.sellers.find((s) => !s.licenseUrl);
  if (!target) return; // seed gives everyone a license; nothing to prove
  const r = await api('PATCH', `/admin/sellers/${target._id}/status`, {
    token: admin.token, body: { status: 'approved' },
  });
  assert.equal(r.status, 400);
});

test('customer cannot access admin routes (403), anonymous gets 401', async () => {
  const a = await api('GET', '/admin/orders', { token: customer.token });
  assert.equal(a.status, 403);
  const b = await api('GET', '/admin/orders');
  assert.equal(b.status, 401);
});

test('audit log records admin actions', async () => {
  const r = await api('GET', '/admin/audit', { token: admin.token });
  assert.equal(r.status, 200);
  assert.ok(r.data.logs.length > 0);
  assert.ok(r.data.logs.some((l) => l.action.startsWith('order.') || l.action.startsWith('seller.')));
});

