import React, { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  ContactShadows,
  useGLTF,
  Environment,
  Lightformer,
  useProgress,
} from '@react-three/drei';
import PhoneModel from './PhoneModel';
import HotspotsLayer from './HotspotsLayer';
import { applyTint, collectParts } from './colorize';

/**
 * Renders a GLB and tints its colorable parts (Body/Back/Frame…) to `color`.
 * `onParts` reports the detected part inventory (seller form uses this).
 */
function GltfModel({ url, color, onParts }) {
  const { scene } = useGLTF(url);

  /* Report the part inventory once per loaded model. */
  useEffect(() => {
    if (!scene) return;
    /* debug/testing handle: lets QA scripts inspect materials */
    if (typeof window !== 'undefined') window.__voltixGlbScene = scene;
    if (onParts) onParts(collectParts(scene));
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Normalize arbitrary GLBs into the canonical product space: largest dimension
     scaled to 7 units (the procedural phone's height) and centered at origin, so
     stored hotspot coordinates align no matter how the source model was authored.
     Runs a frame after mount (world matrices must be up to date) and is guarded
     so StrictMode double-mounting or prop changes can't double-apply it. */
  useEffect(() => {
    if (!scene || scene.userData.voltixNormalized) return undefined;
    const raf = requestAnimationFrame(() => {
      scene.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(scene);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) scene.scale.setScalar(7 / maxDim);
      scene.updateWorldMatrix(true, true);
      const box2 = new THREE.Box3().setFromObject(scene);
      if (!box2.isEmpty()) {
        const center = box2.getCenter(new THREE.Vector3());
        scene.position.set(-center.x, -center.y, -center.z);
      }
      scene.userData.voltixNormalized = true;
    });
    return () => cancelAnimationFrame(raf);
  }, [scene]);

  /* (Re)apply the variant tint whenever the color changes. */
  useEffect(() => {
    if (!scene) return undefined;
    if (color) applyTint(scene, color);

    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    return () => {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) {
            o.material.forEach((m) => m?.dispose?.());
          } else {
            o.material.dispose?.();
          }
        }
      });
    };
  }, [scene, color]);

  return scene ? <primitive object={scene} /> : null;
}

class GlbBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn('[Voltix] GLB failed to load — showing demo phone instead:', err?.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function ProgressOverlay() {
  const { active, progress } = useProgress();
  if (!active || progress >= 100) return null;
  return (
    <div className="absolute inset-x-0 bottom-4 z-10 mx-auto w-56 rounded-full bg-white/10 p-1 backdrop-blur">
      <div
        className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 transition-all"
        style={{ width: `${Math.max(8, Math.round(progress))}%` }}
      />
    </div>
  );
}

/**
 * Interactive 3D product viewer.
 * - modelUrl: optional .glb URL (falls back to a procedural smartphone)
 * - editable: seller hotspot-editor mode (click the model to place hotspots)
 */
export default function ModelViewer({
  modelUrl = '',
  hotspots = [],
  accentColor = '#2563eb',
  editable = false,
  autoRotate = true,
  hideHotspots = false,
  openIndex = null,
  onToggleHotspot,
  onSelectHotspot,
  onAddHotspot,
  onParts,
  className = '',
  style,
}) {
  const showHotspots = !hideHotspots && hotspots.length > 0;
  const safeModelUrl = typeof modelUrl === 'string' ? modelUrl.trim() : '';
  const hasModelUrl = Boolean(safeModelUrl);

  return (
    <div className={`viewer-shell relative overflow-hidden ${className}`} style={style}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 1.6, 12.5], fov: 42 }}
        onPointerMissed={() => onToggleHotspot?.(null)}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-6, 3, -4]} intensity={0.55} color="#8ea2ff" />
        <pointLight position={[0, -2, 8]} intensity={18} distance={20} color="#9ff3ff" />

        {/* procedural studio environment — zero network dependency */}
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2.2} position={[0, 5, -9]} scale={[12, 10, 1]} color="#cfe0ff" />
          <Lightformer intensity={1.3} position={[-8, 2, 4]} scale={[8, 6, 1]} color="#93a7ff" />
          <Lightformer intensity={1.3} position={[8, 1, 4]} scale={[8, 6, 1]} color="#9ff3ff" />
          <Lightformer form="ring" intensity={1.1} position={[0, 8, 6]} scale={5} color="#ffffff" />
        </Environment>

        <ContactShadows position={[0, -4.15, 0]} opacity={0.5} scale={16} blur={2.6} far={7} resolution={512} />

        <Suspense fallback={null}>
          <group
            onClick={(e) => {
              if (!editable) return;
              e.stopPropagation();
              if (e.delta > 6) return; // ignore orbit drags
              onAddHotspot?.([+e.point.x.toFixed(3), +e.point.y.toFixed(3), +e.point.z.toFixed(3)]);
            }}
          >
            <GlbBoundary fallback={<PhoneModel color={accentColor} />}>
              {hasModelUrl ? (
                /* GLBs are pre-normalized (7u max dim, centered) — same framing as the procedural phone */
                <GltfModel url={safeModelUrl} color={accentColor} onParts={onParts} />
              ) : (
                <PhoneModel color={accentColor} />
              )}
            </GlbBoundary>
            {showHotspots && (
              <HotspotsLayer
                hotspots={hotspots}
                openIndex={openIndex}
                onToggle={onToggleHotspot}
                onSelect={onSelectHotspot}
              />
            )}
          </group>
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={5}
          maxDistance={22}
          minPolarAngle={Math.PI / 3.6}
          maxPolarAngle={Math.PI / 1.65}
          enableDamping
          dampingFactor={0.08}
          autoRotate={!editable && autoRotate}
          autoRotateSpeed={1.1}
        />
      </Canvas>

      <ProgressOverlay />

      {editable && (
        <div className="pointer-events-none absolute top-3 left-3 z-10 badge bg-indigo-500/25 text-indigo-100 backdrop-blur">
          ✎ Editor mode — click the model to add a hotspot
        </div>
      )}
    </div>
  );
}
