const mongoose = require('mongoose');

/**
 * One review per (user, order item). Reviews are tied to a delivered item so
 * only real purchasers can leave feedback; rating is 1..5.
 */
const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderItem: { type: String, required: true }, // `${orderId}:${itemIndex}`
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true, maxlength: 1000 },
    // editable until any review reply arrives? keep simple: editable within 24h
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, user: 1, orderItem: 1 }, { unique: true });

reviewSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Review', reviewSchema);
