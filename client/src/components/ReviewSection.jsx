import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reviewApi, errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../constants';
import { Stars } from './Rating';
import { toast } from '../utils/toast';

const RATE_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

/**
 * Reviews block for the product page: rating summary, paginated list,
 * and (for eligible customers) a write/update form.
 * `refreshKey` lets the parent trigger a re-fetch (e.g. after order actions).
 */
export default function ReviewSection({ productId, product, refreshKey = 0 }) {
  const { user } = useAuth();
  const [data, setData] = useState(null); // { reviews, total, page, pages }
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    reviewApi
      .product(productId, page)
      .then(setData)
      .catch(() => setData({ reviews: [], total: 0, page: 1, pages: 1 }));
  }, [productId, page]);

  useEffect(load, [load, refreshKey]);

  return (
    <section className="mt-14">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Reviews</h2>
        <div className="text-sm text-slate-400">
          {product.numReviews > 0 ? (
            <span className="inline-flex items-center gap-2">
              <Stars value={product.averageRating} />
              <span className="font-bold text-slate-200">{Number(product.averageRating).toFixed(1)} / 5</span>
              <span>· {product.numReviews} review{product.numReviews === 1 ? '' : 's'}</span>
            </span>
          ) : (
            <span>No reviews yet — be the first!</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* list */}
        <div className="space-y-3">
          {!data ? (
            <>
              <div className="skeleton h-20" />
              <div className="skeleton h-20" />
            </>
          ) : data.reviews.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-400">
              No reviews yet. Verified buyers can share their experience after delivery.
            </div>
          ) : (
            data.reviews.map((r) => (
              <div key={r._id} className="card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white uppercase">
                    {r.user?.name?.charAt(0) || '?'}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{r.user?.name || 'Customer'}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Stars value={r.rating} size="text-xs" />
                      <span>{fmtDate(r.createdAt)}</span>
                    </div>
                  </div>
                  <span className="badge ml-auto bg-emerald-500/15 text-emerald-300">✔ verified purchase</span>
                </div>
                {r.comment && <p className="mt-3 text-sm leading-relaxed text-slate-300">{r.comment}</p>}
              </div>
            ))
          )}

          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </button>
              <span className="text-xs text-slate-400">
                Page {data.page} of {data.pages}
              </span>
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </div>

        {/* write form */}
        <div>
          {user?.role === 'customer' ? (
            <ReviewForm productId={productId} onSaved={load} />
          ) : (
            <div className="card p-5 text-sm text-slate-400">
              {user ? (
                <>Reviews are written by customers with a delivered order.</>
              ) : (
                <>
                  <Link to="/login" className="font-semibold text-cyan-300 hover:underline">
                    Log in
                  </Link>{' '}
                  as a customer to review after your order is delivered.
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Review form listing the caller's delivered, not-yet-reviewed items for this product. */
function ReviewForm({ productId, onSaved }) {
  const [eligible, setEligible] = useState(null); // [{orderItemId, orderedAt, reviewed}]
  const [editing, setEditing] = useState(null); // existing review being edited {orderItemId, rating, comment, _id}
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]); // my existing reviews for this product

  const loadEligible = useCallback(() => {
    reviewApi
      .mine()
      .then((d) => {
        const forProduct = d.items.filter((i) => i.product?._id === productId || i.productId === productId);
        setEligible(forProduct);
        // prefill the first unreviewed item
        const firstOpen = forProduct.find((i) => !i.reviewed);
        if (firstOpen) {
          setEditing(firstOpen);
          setRating(0);
          setComment('');
        }
      })
      .catch(() => setEligible([]));
  }, [productId]);

  useEffect(loadEligible, [loadEligible]);

  if (!eligible) return <div className="skeleton h-48" />;

  const hasOpen = eligible.some((i) => !i.reviewed);

  if (!hasOpen) {
    return (
      <div className="card p-5 text-sm text-slate-400">
        {eligible.length === 0
          ? 'You can review this product once an order containing it is delivered.'
          : 'Thanks — you already reviewed this product. ⭐'}
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast('Pick a star rating first.', 'error');
    setBusy(true);
    try {
      if (editing?.reviewed) {
        await reviewApi.update(editing.reviewId, { rating, comment });
      } else {
        await reviewApi.create({ orderItemId: editing.orderItemId, rating, comment });
      }
      toast('Review saved ⭐');
      setRating(0);
      setComment('');
      loadEligible();
      onSaved?.();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <h3 className="mb-1 font-bold">Write a review</h3>
      <p className="mb-4 text-xs text-slate-500">
        For <span className="text-slate-300">{editing?.name || 'your order'}</span> · delivered {editing ? fmtDate(editing.orderedAt) : ''}
      </p>

      <div className="mb-4 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`cursor-pointer text-2xl leading-none transition ${
              n <= rating ? 'text-amber-300' : 'text-slate-600 hover:text-amber-200'
            }`}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-xs font-semibold text-slate-400">{RATE_LABELS[rating]}</span>
      </div>

      <textarea
        rows={3}
        className="textarea"
        placeholder="What did you like or dislike?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button className="btn-primary mt-3 w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Submit review'}
      </button>
    </form>
  );
}
