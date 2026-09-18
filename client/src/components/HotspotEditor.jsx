import { useState } from 'react';
import ModelViewer from '../three/LazyModelViewer';

/**
 * Seller-facing hotspot editor:
 * - click the 3D model to drop a new hotspot at that point
 * - edit titles/descriptions inline, select markers to preview them
 */
export default function HotspotEditor({ hotspots = [], onChange, modelUrl = '', accentColor, onParts }) {
  const [selected, setSelected] = useState(null);

  const addHotspot = ([x, y, z]) => {
    const next = [...hotspots, { title: 'New feature', description: '', position: { x, y, z } }];
    onChange(next);
    setSelected(next.length - 1);
  };

  const update = (i, patch) => {
    const next = hotspots.map((h, idx) => (idx === i ? { ...h, ...patch } : h));
    onChange(next);
  };

  const remove = (i) => {
    onChange(hotspots.filter((_, idx) => idx !== i));
    setSelected(null);
  };

  const move = (i, axis, value) => {
    const h = hotspots[i];
    update(i, { position: { ...h.position, [axis]: parseFloat(value) || 0 } });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <ModelViewer
        modelUrl={modelUrl}
        hotspots={hotspots}
        accentColor={accentColor}
        editable
        autoRotate={false}
        hideHotspots={hotspots.length === 0}
        openIndex={selected}
        onToggleHotspot={(i) => setSelected(i)}
        onSelectHotspot={(i) => setSelected(i)}
        onAddHotspot={addHotspot}
        onParts={onParts}
        className="h-[420px] rounded-2xl border border-white/10"
      />

      <div className="flex max-h-[420px] flex-col">
        <div className="mb-2 flex items-center justify-between text-xs tracking-wider text-slate-400 uppercase">
          <span>Hotspots ({hotspots.length})</span>
          {hotspots.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="cursor-pointer text-red-300 hover:underline">
              clear all
            </button>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {hotspots.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-xs leading-relaxed text-slate-500">
              Click anywhere on the 3D model to place your first hotspot marker.
            </p>
          )}

          {hotspots.map((h, i) => (
            <div key={i}
              onClick={() => setSelected(i)}
              className={`cursor-pointer rounded-xl border p-3 transition ${
                selected === i ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="hotspot-dot" style={{ transform: 'scale(.7)' }}>{i + 1}</span>
                <input
                  className="input !py-1.5 text-sm font-semibold"
                  value={h.title}
                  placeholder="Feature title"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => update(i, { title: e.target.value })}
                />
                <button type="button" title="Remove"
                  onClick={(e) => { e.stopPropagation(); remove(i); }}
                  className="cursor-pointer px-1 text-slate-500 hover:text-red-400">✕</button>
              </div>
              <textarea
                className="textarea !py-1.5 text-xs"
                rows={2}
                placeholder="What should customers know about this feature?"
                value={h.description}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => update(i, { description: e.target.value })}
              />
              {selected === i && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  {['x', 'y', 'z'].map((axis) => (
                    <label key={axis}>
                      {axis}
                      <input
                        type="number" step="0.05" className="input !px-2 !py-1 text-xs"
                        value={h.position?.[axis] ?? 0}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => move(i, axis, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Tip: rotate the view, then click the model surface to anchor a marker exactly where you want it.
        </p>
      </div>
    </div>
  );
}
