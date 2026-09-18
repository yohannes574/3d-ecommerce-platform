const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('../utils/helpers');
const { notify, sendEmail } = require('../utils/notify');

const isDev = process.env.NODE_ENV !== 'production';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'voltix-dev-secret', {
    expiresIn: '7d',
  });
}

/** Issue a one-time six-digit verification code (24 h). */
async function issueVerificationToken(user) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  user.verifyTokenHash = crypto.createHash('sha256').update(code).digest('hex');
  user.verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  await sendEmail({
    to: user.email,
    subject: '[Voltix] Verify your email',
    text: `Welcome to Voltix! Your email verification code is ${code}. It is valid for 24 hours and can only be used once.`,
  });
  return isDev ? { devCode: code, devToken: code } : {};
}

/** POST /api/auth/register  (application/json; licenseUrl is attached via /api/upload/license) */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, shopName, licenseUrl, licenseOriginalName } = req.body;

  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required.');
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters.');

  const chosenRole = role === 'seller' ? 'seller' : 'customer'; // admins cannot self-register

  /* License is optional AT REGISTRATION (the signup UI uploads it right after
     the account exists). Approval remains hard-blocked without one. */

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const user = await User.create({
    name,
    email,
    password,
    role: chosenRole,
    shopName: chosenRole === 'seller' ? shopName || `${name}'s Store` : '',
    licenseUrl: chosenRole === 'seller' ? licenseUrl || '' : '',
    licenseOriginalName: chosenRole === 'seller' ? licenseOriginalName || '' : '',
  });

  /* every new account must confirm its email before logging in */
  const dev = await issueVerificationToken(user);

  res.status(201).json({
    token: signToken(user),
    user,
    message:
      chosenRole === 'seller'
        ? licenseUrl
          ? 'Registration complete. Your seller account (with license) is pending admin approval.'
          : 'Account created — now upload your business license to enter the approval queue.'
        : 'Welcome to Voltix!',
    ...dev,
  });
});

/** GET /api/auth/verify/:token — confirm an email address (one-time, 24 h) */
exports.verifyEmail = asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(String(req.params.token || '')).digest('hex');
  const user = await User.findOne({ verifyTokenHash: hash, verifyTokenExpires: { $gt: new Date() } });
  if (!user) throw new ApiError(400, 'This verification link is invalid or has expired.');

  user.isVerified = true;
  user.verifyTokenHash = '';
  user.verifyTokenExpires = null;
  await user.save();

  await notify({
    userId: user._id,
    type: 'account',
    title: 'Email verified ✅',
    body: 'Your email is confirmed — welcome aboard!',
    link: '/',
  });

  res.json({ message: 'Email verified! You can now log in.', email: user.email });
});

/** POST /api/auth/verify-code {email, code} — confirm an email with its code */
exports.verifyEmailCode = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) {
    throw new ApiError(400, 'A valid six-digit verification code is required.');
  }

  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const user = await User.findOne({
    email,
    verifyTokenHash: hash,
    verifyTokenExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, 'This verification code is invalid or has expired.');

  user.isVerified = true;
  user.verifyTokenHash = '';
  user.verifyTokenExpires = null;
  await user.save();

  await notify({
    userId: user._id,
    type: 'account',
    title: 'Email verified',
    body: 'Your email is confirmed — welcome aboard!',
    link: '/',
  });

  res.json({ message: 'Email verified! You can now log in.', email: user.email });
});

/** POST /api/auth/resend-verification {email} — always 200 (no account enumeration) */
exports.resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, 'Email is required.');

  const user = await User.findOne({ email: String(email).toLowerCase() });
  let dev = {};
  if (user && !user.isVerified) {
    dev = await issueVerificationToken(user);
  }
  res.json({
    message: 'If that account exists and is unverified, a fresh verification email is on its way.',
    ...dev,
  });
});

/** POST /api/auth/login */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  /* unverified accounts cannot log in — clients show the resend-verification UI */
  if (!user.isVerified) {
    const dev = await issueVerificationToken(user); // fresh link each attempt
    return res.status(403).json({
      message: 'Please verify your email before logging in — we just sent you a fresh link.',
      needsVerification: true,
      email: user.email,
      ...dev,
    });
  }

  /* Pending/rejected sellers CAN log in (read-only) so they can view their
     status and re-submit a license. The role guards still block seller
     capabilities (products/uploads) until status === 'approved'. */
  res.json({ token: signToken(user), user });
});

/** GET /api/auth/me (protected) */
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

/* ---------------- Account self-service ---------------- */

/** PUT /api/auth/me {name, shopName?, address?} — update profile fields */
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, shopName, address } = req.body;

  if (name !== undefined) {
    if (!String(name).trim()) throw new ApiError(400, 'Name cannot be empty.');
    req.user.name = String(name).trim();
  }
  if (shopName !== undefined && req.user.role === 'seller') {
    req.user.shopName = String(shopName).trim();
  }
  if (address !== undefined && typeof address === 'object' && address !== null) {
    for (const k of ['fullName', 'phone', 'line1', 'city', 'country']) {
      req.user.address[k] = String(address[k] ?? '').trim();
    }
  }
  await req.user.save();
  res.json({ user: req.user, message: 'Profile updated.' });
});

/** PUT /api/auth/password {currentPassword, newPassword} */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current and new password are required.');
  }
  if (String(newPassword).length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters.');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(String(currentPassword)))) {
    throw new ApiError(401, 'Current password is incorrect.');
  }
  user.password = String(newPassword);
  await user.save();
  res.json({ message: 'Password changed.' });
});

/**
 * POST /api/auth/license — (re)submit a business license.
 * Used at registration AND by pending/rejected sellers who need to replace
 * or add their document. Re-submitting re-enters the pending review queue.
 */
exports.submitLicense = asyncHandler(async (req, res) => {
  const { licenseUrl, licenseOriginalName } = req.body;
  if (!licenseUrl) throw new ApiError(400, 'licenseUrl is required (upload via /api/upload/license).');
  if (req.user.role !== 'seller') throw new ApiError(400, 'Only seller accounts carry a license.');
  if (req.user.status === 'approved') {
    throw new ApiError(400, 'Your account is already approved — no license change needed.');
  }

  req.user.licenseUrl = licenseUrl;
  req.user.licenseOriginalName = licenseOriginalName || '';
  req.user.status = 'pending'; // back into the review queue
  await req.user.save();

  await notify({
    userId: req.user._id,
    email: req.user.email,
    type: 'account',
    title: 'License submitted for review',
    body: 'An admin will verify your business license. We will notify you of the decision.',
    link: '/seller',
  });

  res.json({ user: req.user, message: 'License submitted. An admin will review it shortly.' });
});
