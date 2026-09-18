const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        image: { type: String, default: '' },
        unitPrice: Number,
        qty: Number,
        variant: { type: [{ name: String, value: String }], default: [], _id: false },
      },
    ],
    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    /* Cash on delivery, or pre-paid methods where the customer uploads a
       payment screenshot + transaction reference for the SELLER to verify. */
    paymentMethod: {
      type: String,
      enum: ['cod', 'chapa', 'telebirr', 'bank_transfer'],
      default: 'cod',
    },
    paymentProof: {
      screenshotUrl: { type: String, default: '' }, // uploaded receipt image
      transactionRef: { type: String, default: '' }, // Chapa/TB/_bank reference
      uploadedAt: { type: Date, default: null },
      _id: false,
    },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      city: { type: String, required: true },
      country: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'placed',
    },
  },
  { timestamps: true }
);

orderSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Order', orderSchema);
