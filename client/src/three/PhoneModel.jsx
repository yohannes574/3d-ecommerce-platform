import * as THREE from 'three';
import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';

/**
 * Procedural smartphone (no external assets needed).
 * Dimensions are shared with the seeded hotspot coordinates:
 *   body W 3.4 × H 7 × D ~0.38, centered at origin.
 */

/**
 * Canvas2D roundRect() is missing in older Firefox (<116) and Safari (<16),
 * so we fall back to drawing the rounded path manually.
 */
function traceRoundedRect(ctx, rx, ry, rw, rh, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(rx, ry, rw, rh, radius);
    return;
  }
  ctx.moveTo(rx + radius, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, radius);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, radius);
  ctx.arcTo(rx, ry + rh, rx, ry, radius);
  ctx.arcTo(rx, ry, rx + rw, ry, radius);
  ctx.closePath();
}

function makeScreenTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const x = c.getContext('2d');

  const g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#0a1030');
  g.addColorStop(0.5, '#111b3f');
  g.addColorStop(1, '#05070f');
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 1024);

  const blob = (cx, cy, r, color) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  blob(130, 230, 270, 'rgba(99,102,241,.55)');
  blob(430, 430, 250, 'rgba(34,211,238,.38)');
  blob(300, 770, 290, 'rgba(236,72,153,.22)');

  x.textAlign = 'left';
  x.fillStyle = '#e8ecff';
  x.font = '700 116px "Segoe UI", Arial';
  x.fillText('10:24', 42, 196);
  x.font = '500 38px "Segoe UI", Arial';
  x.fillStyle = 'rgba(226,232,255,.72)';
  x.fillText('Wed, August 26', 46, 252);

  const cols = 4;
  const size = 64;
  const gap = (512 - cols * size) / (cols + 1);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < cols; i++) {
      x.fillStyle = `hsla(${(row * 67 + i * 47) % 360} 78% 62% / .85)`;
      x.beginPath();
      traceRoundedRect(x, gap + i * (size + gap), 420 + row * (size + 34), size, size, 18);
      x.fill();
    }
  }

  x.fillStyle = 'rgba(255,255,255,.13)';
  x.beginPath();
  traceRoundedRect(x, 34, 862, 444, 108, 30);
  x.fill();
  ['#38bdf8', '#a78bfa', '#f472b6', '#34d399'].forEach((col, i) => {
    x.fillStyle = col;
    x.beginPath();
    x.arc(100 + i * 104, 916, 32, 0, Math.PI * 2);
    x.fill();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function PhoneModel({ color = '#2563eb' }) {
  // If anything in the canvas drawing is unsupported by the browser,
  // fall back to a plain dark screen instead of crashing the whole viewer.
  const screenTex = useMemo(() => {
    try {
      return makeScreenTexture();
    } catch (err) {
      console.warn('[Voltix] Screen texture unavailable:', err?.message);
      return null;
    }
  }, []);
  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        metalness: 0.65,
        roughness: 0.3,
        envMapIntensity: 1.1,
      }),
    [color]
  );
  const buttonMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.25 }),
    [color]
  );

  const lensPositions = [
    [-1.27, 2.84],
    [-1.27, 2.16],
    [-0.62, 2.5],
  ];

  return (
    <group>
      {/* main frame */}
      <RoundedBox args={[3.4, 7, 0.34]} radius={0.16} smoothness={8} material={bodyMat} castShadow receiveShadow />

      {/* front black glass */}
      <RoundedBox args={[3.26, 6.86, 0.1]} radius={0.12} smoothness={8} position={[0, 0, 0.13]} castShadow>
        <meshStandardMaterial color="#05070d" metalness={0.35} roughness={0.14} />
      </RoundedBox>

      {/* live wallpaper screen */}
      <mesh position={[0, 0, 0.186]}>
        <planeGeometry args={[2.96, 6.56]} />
        {screenTex ? (
          <meshBasicMaterial map={screenTex} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#0a1230" toneMapped={false} />
        )}
      </mesh>

      {/* punch-hole camera */}
      <mesh position={[0, 2.94, 0.192]}>
        <circleGeometry args={[0.07, 24]} />
        <meshBasicMaterial color="#000" />
      </mesh>

      {/* rear camera island */}
      <RoundedBox args={[1.35, 1.35, 0.16]} radius={0.14} smoothness={6} position={[-0.95, 2.5, -0.21]} castShadow>
        <meshStandardMaterial color="#14161e" metalness={0.55} roughness={0.32} />
      </RoundedBox>

      {/* lenses */}
      {lensPositions.map(([lx, ly], i) => (
        <group key={i} position={[lx, ly, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.205, 0.205, 0.09, 32]} />
            <meshStandardMaterial color="#1c2030" metalness={0.85} roughness={0.22} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.125, 0.125, 0.03, 32]} />
            <meshStandardMaterial color="#0a1030" metalness={0.95} roughness={0.06} envMapIntensity={1.6} />
          </mesh>
        </group>
      ))}
      {/* flash */}
      <mesh position={[-0.5, 2.9, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.05, 24]} />
        <meshStandardMaterial color="#fffbe8" emissive="#fff3c2" emissiveIntensity={0.55} />
      </mesh>

      {/* side buttons */}
      <RoundedBox args={[0.07, 0.9, 0.16]} radius={0.03} smoothness={4} position={[1.735, 1.0, 0]} material={buttonMat} />
      <RoundedBox args={[0.07, 1.3, 0.16]} radius={0.03} smoothness={4} position={[1.735, 2.35, 0]} material={buttonMat} />

      {/* USB-C slot + speaker grilles */}
      <mesh position={[0, -3.49, 0]}>
        <boxGeometry args={[0.5, 0.09, 0.14]} />
        <meshStandardMaterial color="#0a0c12" roughness={0.5} />
      </mesh>
      {[-0.95, 0.95].map((sx) => (
        <mesh key={sx} position={[sx, -3.49, 0]}>
          <boxGeometry args={[0.55, 0.07, 0.12]} />
          <meshStandardMaterial color="#0a0c12" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
