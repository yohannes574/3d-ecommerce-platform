const mongoose = require('mongoose');

/**
 * Category list is open-ended on purpose: v1 focuses on smartphones, but the
 * schema (free-form specs[], variants[], hotspots[]) is designed so laptops,
 * headphones, smartwatches, tablets etc. can be added without migrations.
 */
const CATEGORIES = [
  'smartphone',
  'laptop',
  'tablet',
  'headphone',
  'smartwatch',
  'accessory',
  'other',
];

/* One selectable option inside a variant group, e.g. { value:'512GB', priceDelta:150 } */
const optionSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true },
    /* Added to (or subtracted from) the base price when this option is picked.
       Negative deltas act as a discount; the effective total can never go below 0. */
    priceDelta: { type: Number, default: 0 },
    /* Per-option stock. null/undefined → inherits the product-level counter;
       a number → this option tracks its own inventory (e.g. 256GB sold out while
       512GB remains). Optional so legacy docs need no migration. */
    stock: { type: Number, min: 0, default: null },
    /* Explicit hex color for swatches + 3D tinting ("Color" groups). Empty →
       the client falls back to guessing a color from the option name. */
    swatch: { type: String, default: '', trim: true },
    _id: false,
  },
);

const variantGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    values: { type: [optionSchema], default: [] },
    _id: false,
  },
);

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    brand: { type: String, required: [true, 'Brand is required'], trim: true },
    category: { type: String, enum: CATEGORIES, default: 'smartphone' },
    description: { type: String, default: '', trim: true },

    price: { type: Number, required: [true, 'Price is required'], min: 0 },
    compareAtPrice: { type: Number, min: 0, default: null },
    stock: { type: Number, required: true, min: 0, default: 0 },

    images: { type: [String], default: [] },

    /* Free-form specification pairs, e.g. [{key:'Display', value:'6.8" AMOLED'}] */
    specs: { type: [{ key: String, value: String, _id: false }], default: [] },

    /* Option groups, e.g. [{name:'Storage', values:[{value:'256GB', priceDelta:0}]}] */
    variants: { type: [variantGroupSchema], default: [] },

    /* Interactive 3D */
    model3dUrl: { type: String, default: '' }, // URL/path to a .glb file
    hotspots: {
      type: [
        {
          title: { type: String, required: true },
          description: { type: String, default: '' },
          position: {
            x: { type: Number, required: true },
            y: { type: Number, required: true },
            z: { type: Number, required: true },
          },
          _id: false,
        },
      ],
      default: [],
    },

    /* Aggregates maintained by the review system (1 decimal place) */
    numReviews: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },

    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'pending',
    },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ name: 'text', brand: 'text' });

/**
 * Effective unit price for a selection, e.g.
 *   product.priceFor([{ name:'Storage', value:'512GB' }])  →  base + delta
 * Unknown/unselected options contribute 0. Result is never negative.
 */
productSchema.methods.priceFor = function (selection = []) {
  let total = this.price;
  const groups = this.variants || [];
  for (const sel of selection || []) {
    const group = groups.find(
      (g) => g.name.toLowerCase() === String(sel.name || '').toLowerCase()
    );
    if (!group) continue;
    const opt = (group.values || []).find(
      (o) => o.value.toLowerCase() === String(sel.value || '').toLowerCase()
    );
    if (opt) total += opt.priceDelta || 0;
  }
  return Math.max(0, Math.round(total * 100) / 100);
};

/** Cheapest selectable price (base + most-negative deltas) — used for "From $X". */
productSchema.virtual('minPrice').get(function () {
  let total = this.price;
  for (const g of this.variants || []) {
    if (!g.values?.length) continue;
    total += Math.min(...g.values.map((o) => o.priceDelta || 0));
  }
  return Math.max(0, Math.round(total * 100) / 100);
});

/* Normalize legacy/plain-string values to { value, priceDelta } on output.
   Per-option stock is only exposed when that option actually tracks stock. */
productSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    ret.variants = (ret.variants || []).map((g) => ({
      name: g.name,
      values: (g.values || []).map((o) =>
        typeof o === 'string'
          ? { value: o, priceDelta: 0 }
          : {
              value: o.value,
              priceDelta: o.priceDelta || 0,
              ...(o.swatch ? { swatch: o.swatch } : {}),
              ...(o.stock !== null && o.stock !== undefined ? { stock: o.stock } : {}),
            }
      ),
    }));
    return ret;
  },
});

productSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model('Product', productSchema);
