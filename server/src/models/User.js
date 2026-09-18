const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: { type: String, enum: ['customer', 'seller', 'admin'], default: 'customer' },
    // For sellers: admin approval workflow. Customers are active immediately.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active'],
      default: function () {
        return this.role === 'seller' ? 'pending' : 'active';
      },
    },
    shopName: { type: String, trim: true, default: '' },
    /* Sellers only: business-license document (pdf/image) verified by an admin.
       Approval is hard-blocked server-side while this is empty. */
    licenseUrl: { type: String, default: '' },
    licenseOriginalName: { type: String, default: '' },
    /* Email verification: users must confirm their address before logging in
       or placing orders. The raw token is never stored — only its SHA-256 hash. */
    isVerified: { type: Boolean, default: false },
    verifyTokenHash: { type: String, default: '', select: false },
    verifyTokenExpires: { type: Date, default: null },
    /* Default shipping address, prefilled at checkout (all roles). */
    address: {
      fullName: { type: String, default: '' },
      phone: { type: String, default: '' },
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      _id: false,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
