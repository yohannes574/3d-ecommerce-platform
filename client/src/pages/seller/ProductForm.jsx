import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sellerApi, uploadFile, errMsg } from '../../api/client';
import HotspotEditor from '../../components/HotspotEditor';
import { CATEGORIES, colorForName, optionSwatch, toHex } from '../../constants';
import { toast } from '../../utils/toast';

const EMPTY = {
  name: '',
  brand: '',
  category: 'smartphone',
  description: '',
  price: '',
  compareAtPrice: '',
  stock: '',
  images: [],
  specs: [],
  variants: [],
  model3dUrl: '',
  hotspots: [],
};

/* Editor shape for one variant option: { value, delta, stockStr, swatch } — strings for input binding */
const toEditorOption = (o) =>
  typeof o === 'string'
    ? { value: o, delta: '0', stockStr: '', swatch: '' }
    : {
        value: o?.value || '',
        delta: String(o?.priceDelta ?? 0),
        stockStr: o?.stock === null || o?.stock === undefined ? '' : String(o.stock),
        swatch: typeof o?.swatch === 'string' ? o.swatch : '',
      };

const isColorGroup = (name = '') => name.toLowerCase().includes('color');

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const imgInputRef = useRef(null);
  const glbInputRef = useRef(null);

  const [form, setForm] = useState(EMPTY);
  const [imgUrl, setImgUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  /* Detected mesh parts of the uploaded GLB (colorable vs protected) */
  const [glbParts, setGlbParts] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    sellerApi
      .get(id)
      .then(({ product }) =>
        setForm({
          ...EMPTY,
          ...product,
          // API output is already normalized to { value, priceDelta }
          variants: (product.variants || []).map((g) => ({
            name: g.name,
            values: (g.values || []).map(toEditorOption),
          })),
        })
      )
      .catch((e) => toast(errMsg(e), 'error'));
  }, [id, isEdit]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ---------- images ---------- */
  const addImageUrl = () => {
    const url = imgUrl.trim();
    if (!url) return;
    setForm((f) => ({ ...f, images: [...f.images, url] }));
    setImgUrl('');
  };
  const removeImage = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const d = await uploadFile(file);
        if (d.kind === 'model') setForm((f) => ({ ...f, model3dUrl: d.url }));
        else setForm((f) => ({ ...f, images: [...f.images, d.url] }));
      }
      toast('Upload complete ✨');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  /* ---------- specs ---------- */
  const addSpec = () => setForm((f) => ({ ...f, specs: [...f.specs, { key: '', value: '' }] }));
  const setSpec = (i, k, v) =>
    setForm((f) => ({ ...f, specs: f.specs.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)) }));
  const delSpec = (i) => setForm((f) => ({ ...f, specs: f.specs.filter((_, idx) => idx !== i) }));

  /* ---------- variants (group cards with priced options) ---------- */
  const addVariantGroup = () =>
    setForm((f) => ({
      ...f,
      variants: [...f.variants, { name: '', values: [{ value: '', delta: '0', stockStr: '', swatch: '' }] }],
    }));
  const delVariantGroup = (gi) =>
    setForm((f) => ({ ...f, variants: f.variants.filter((_, idx) => idx !== gi) }));
  const setGroupName = (gi, name) =>
    setForm((f) => ({ ...f, variants: f.variants.map((g, idx) => (idx === gi ? { ...g, name } : g)) }));
  const addOption = (gi) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, idx) =>
        idx === gi ? { ...g, values: [...g.values, { value: '', delta: '0', stockStr: '', swatch: '' }] } : g
      ),
    }));
  const delOption = (gi, oi) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, idx) =>
        idx === gi ? { ...g, values: g.values.filter((_, i) => i !== oi) } : g
      ),
    }));
  const setOption = (gi, oi, k, v) =>
    setForm((f) => ({
      ...f,
      variants: f.variants.map((g, idx) =>
        idx === gi
          ? { ...g, values: g.values.map((o, i) => (i === oi ? { ...o, [k]: v } : o)) }
          : g
      ),
    }));

  /* ---------- submit ---------- */
  async function submit(status) {
    if (!form.name.trim() || !form.brand.trim()) return toast('Name and brand are required.', 'error');
    if (form.price === '' || Number(form.price) < 0) return toast('Enter a valid price.', 'error');

    const payload = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      description: form.description,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice === '' ? null : Number(form.compareAtPrice),
      stock: Number(form.stock) || 0,
      images: form.images.filter(Boolean),
      specs: form.specs.filter((s) => s.key.trim()),
      variants: form.variants
        .filter((g) => g.name.trim())
        .map((g) => ({
          name: g.name.trim(),
          values: g.values
            .filter((o) => o.value.trim())
            .map((o) => ({
              value: o.value.trim(),
              priceDelta: Number(o.delta) || 0,
              swatch: o.swatch || '',
              stock: o.stockStr === '' ? null : Number(o.stockStr),
            })),
        })),
      model3dUrl: form.model3dUrl,
      hotspots: form.hotspots.filter((h) => h.title?.trim() && h.position),
      status,
    };

    setBusy(true);
    try {
      const res = isEdit ? await sellerApi.update(id, payload) : await sellerApi.create(payload);
      toast(res.message || 'Saved!');
      navigate('/seller');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const colorGroup = form.variants.find((g) => isColorGroup(g.name));
  const accentFor3d = colorGroup?.values?.[0] ? optionSwatch(colorGroup.values[0]) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <button onClick={() => navigate('/seller')} className="mb-4 cursor-pointer text-sm text-slate-400 hover:text-cyan-300">
        ← Back to Seller Hub
      </button>
      <h1 className="text-2xl font-extrabold">{isEdit ? `Edit: ${form.name || '…'}` : 'Create a new product'}</h1>
      <p className="mt-1 mb-8 text-sm text-slate-400">Save as a private draft or submit for admin approval.</p>

      <div className="space-y-6">
        {/* ---------- basics ---------- */}
        <section className="card p-6">
          <h2 className="mb-4 font-bold">1 · Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Product name *</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="Nova X1 Pro" /></div>
            <div><label className="label">Brand *</label>
              <input className="input" value={form.brand} onChange={set('brand')} placeholder="NovaTech" /></div>
            <div><label className="label">Category</label>
              <select className="select" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Base price ($) *</label>
                <input type="number" min="0" step="0.01" className="input" value={form.price} onChange={set('price')} /></div>
              <div><label className="label">Compare at</label>
                <input type="number" min="0" step="0.01" className="input" value={form.compareAtPrice ?? ''} onChange={set('compareAtPrice')} /></div>
              <div><label className="label">Stock *</label>
                <input type="number" min="0" className="input" value={form.stock} onChange={set('stock')} /></div>
            </div>
            <div className="sm:col-span-2"><label className="label">Description</label>
              <textarea rows={4} className="textarea" value={form.description} onChange={set('description')}
                placeholder="What makes this product special?" /></div>
          </div>
        </section>

        {/* ---------- images ---------- */}
        <section className="card p-6">
          <h2 className="mb-4 font-bold">2 · Images</h2>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Paste an image URL…" value={imgUrl}
              onChange={(e) => setImgUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())} />
            <button type="button" className="btn-ghost" onClick={addImageUrl}>Add</button>
            <button type="button" className="btn-primary" disabled={uploading}
              onClick={() => imgInputRef.current?.click()}>
              {uploading ? 'Uploading…' : '⬆ Upload'}
            </button>
          </div>
          {form.images.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {form.images.map((src, i) => (
                <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-white/10">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  {i === 0 && <span className="badge absolute top-1 left-1 bg-indigo-500/70 text-[9px] text-white">main</span>}
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 text-red-300 opacity-0 transition group-hover:opacity-100">
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------- specs & variants ---------- */}
        <section className="card p-6">
          <h2 className="mb-1 font-bold">3 · Specs & variants</h2>
          <p className="mb-4 text-xs text-slate-500">
            Free-form specs power the spec table. Variant options can carry a <strong className="text-slate-300">price
            adjustment</strong> — e.g. 512GB at +$150 charges more on the customer side. A group named “Color” also tints the 3D model.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* specs column */}
            <div>
              <div className="label">Specifications</div>
              <div className="space-y-2">
                {form.specs.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input w-36" placeholder="Display" value={s.key}
                      onChange={(e) => setSpec(i, 'key', e.target.value)} />
                    <input className="input flex-1" placeholder='6.9″ AMOLED 144Hz' value={s.value}
                      onChange={(e) => setSpec(i, 'value', e.target.value)} />
                    <button type="button" onClick={() => delSpec(i)} className="btn-danger px-3 py-1">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addSpec} className="btn-ghost mt-3 px-3 py-1.5 text-xs">＋ Add spec</button>
            </div>

            {/* variants column */}
            <div>
              <div className="label">Variant groups (name + priced options)</div>
              <div className="space-y-3">
                {form.variants.map((g, gi) => (
                  <div key={gi} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <input className="input flex-1" placeholder='Group name, e.g. "Storage" or "Color"'
                        value={g.name} onChange={(e) => setGroupName(gi, e.target.value)} />
                      <button type="button" onClick={() => delVariantGroup(gi)} className="btn-danger px-3 py-1.5 text-xs">✕</button>
                    </div>
                    <div className="space-y-2">
                      {g.values.map((o, oi) => {
                        const isColor = isColorGroup(g.name);
                        return (
                        <div key={oi} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                          {/* row 1 — swatch picker (Color groups) + name + price delta + remove */}
                          <div className="flex items-center gap-2">
                            {isColor && (
                              <label className="relative h-8 w-8 shrink-0 cursor-pointer rounded-full border border-white/25"
                                style={{ background: o.swatch || colorForName(o.value) }} title="Pick the swatch color">
                                <input type="color" value={toHex(o.swatch || colorForName(o.value))}
                                  onChange={(e) => setOption(gi, oi, 'swatch', e.target.value)}
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                              </label>
                            )}
                            <input className="input flex-1" placeholder={isColor ? 'Ocean Blue' : '512GB'}
                              value={o.value} onChange={(e) => setOption(gi, oi, 'value', e.target.value)} />
                            <div className="relative w-32 shrink-0">
                              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                              <input type="number" step="0.01" className="input pl-6 pr-7" placeholder="0"
                                title="Added to the base price when the customer picks this option"
                                value={o.delta} onChange={(e) => setOption(gi, oi, 'delta', e.target.value)} />
                              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                                {Number(o.delta) > 0 ? '▲' : Number(o.delta) < 0 ? '▼' : ''}
                              </span>
                            </div>
                            <button type="button" onClick={() => delOption(gi, oi)} className="btn-danger px-2.5 py-1.5 text-xs">✕</button>
                          </div>
                          {/* row 2 — optional per-option stock + swatch status */}
                          <div className="mt-2 flex items-center gap-2 pl-10">
                            <span className="text-[11px] text-slate-500">Stock for this option</span>
                            <input type="number" min="0" className="input w-20 py-1 text-xs" placeholder="shared"
                              title="Optional: track stock separately for this option (empty = shared product stock)"
                              value={o.stockStr} onChange={(e) => setOption(gi, oi, 'stockStr', e.target.value)} />
                            {isColor && (
                              <span className="ml-auto text-[11px] text-slate-500">
                                {o.swatch ? '✓ custom swatch set' : 'swatch auto-guessed from the name'}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    <button type="button" onClick={() => addOption(gi)} className="btn-ghost mt-2 px-3 py-1.5 text-xs">
                      ＋ Add option
                    </button>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Price adjustment is added to the base price (negative = cheaper). Leave 0 for no extra cost.
                      Groups named “Color” get a swatch picker and drive the 3D model tint.
                    </p>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addVariantGroup} className="btn-ghost mt-3 px-3 py-1.5 text-xs">
                ＋ Add variant group
              </button>
            </div>
          </div>
        </section>

        {/* ---------- 3D + hotspots ---------- */}
        <section className="card p-6">
          <h2 className="mb-4 font-bold">4 · 3D model & interactive hotspots 🧊</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            <input className="input min-w-[240px] flex-1"
              placeholder="GLB model URL (optional — empty uses the built-in demo phone)"
              value={form.model3dUrl} onChange={set('model3dUrl')} />
            <button type="button" className="btn-ghost" disabled={uploading}
              onClick={() => glbInputRef.current?.click()}>
              ⬆ Upload .glb
            </button>
            {form.model3dUrl && (
              <button type="button" className="btn-danger" onClick={() => setForm((f) => ({ ...f, model3dUrl: '' }))}>
                Remove
              </button>
            )}
          </div>
          <HotspotEditor
            hotspots={form.hotspots}
            modelUrl={form.model3dUrl}
            accentColor={accentFor3d}
            onParts={setGlbParts}
            onChange={(hotspots) => setForm((f) => ({ ...f, hotspots }))}
          />

          {/* GLB parts report — tells the seller whether variant colors will recolor the model */}
          {form.model3dUrl && glbParts && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className={`rounded-xl border p-3 ${glbParts.colorable.length ? 'border-emerald-400/25 bg-emerald-500/[0.06]' : 'border-amber-400/25 bg-amber-500/[0.06]'}`}>
                <p className="text-xs font-bold text-emerald-300">
                  🎨 Colorable parts ({glbParts.colorable.length}) — recolored when the customer picks a color
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {glbParts.colorable.length
                    ? glbParts.colorable.join(', ')
                    : 'None detected. Name your meshes with “Body”, “Back” or “Frame” (e.g. Phone_Body) to enable recoloring.'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-bold text-slate-300">
                  🔒 Protected parts ({glbParts.protected.length}) — never recolored
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {glbParts.protected.length ? glbParts.protected.join(', ') : 'None detected'}
                </p>
              </div>
            </div>
          )}
          {form.model3dUrl && colorGroup && glbParts && glbParts.colorable.length === 0 && (
            <p className="mt-2 text-[11px] text-amber-300">
              ⚠ Your Color variants won't change the 3D model yet — no colorable mesh was found in this GLB.
            </p>
          )}
        </section>

        {/* ---------- actions ---------- */}
        <div className="sticky bottom-4 z-40 flex flex-wrap justify-end gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-2xl backdrop-blur">
          <span className="mr-auto self-center text-xs text-slate-500">Products appear publicly after admin approval.</span>
          <button className="btn-ghost" disabled={busy} onClick={() => submit('draft')}>Save draft</button>
          <button className="btn-primary px-6" disabled={busy} onClick={() => submit('pending')}>
            {busy ? 'Saving…' : isEdit ? 'Update & submit' : 'Submit for approval'}
          </button>
        </div>
      </div>

      <input ref={imgInputRef} type="file" accept="image/*" multiple hidden onChange={handleUpload} />
      <input ref={glbInputRef} type="file" accept=".glb,model/gltf-binary" hidden onChange={handleUpload} />
    </div>
  );
}
