import { Html } from '@react-three/drei';

/** Interactive numbered hotspot markers rendered as HTML overlays in the 3D scene. */
export default function HotspotsLayer({ hotspots = [], openIndex = null, onToggle, onSelect }) {
  return hotspots.map((h, i) =>
    !h?.position ? null : (
      <Html
        key={i}
        position={[h.position.x || 0, h.position.y || 0, h.position.z || 0]}
        center
        zIndexRange={[30, 0]}
        style={{ pointerEvents: 'auto', userSelect: 'none' }}
      >
        <div className="relative flex flex-col items-center">
          {openIndex === i && (
            <div className="hotspot-card mb-2" onPointerDown={(e) => e.stopPropagation()}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <strong className="text-sm leading-snug text-cyan-200">{h.title}</strong>
                <button
                  onClick={() => onToggle(null)}
                  className="-mt-0.5 cursor-pointer text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
              {h.description ? (
                <p className="text-xs leading-relaxed text-slate-400">{h.description}</p>
              ) : null}
            </div>
          )}
          <button
            className="hotspot-dot"
            data-active={openIndex === i}
            title={h.title}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(openIndex === i ? null : i);
              onSelect?.(i);
            }}
          >
            {i + 1}
          </button>
        </div>
      </Html>
    )
  );
}
