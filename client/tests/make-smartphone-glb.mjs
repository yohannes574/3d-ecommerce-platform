/* Generates a realistic smartphone GLB with colorize-aware mesh names:
     Phone_Body / Phone_Back / Phone_Frame  → colorable (tinted per variant)
     Screen / Camera_Island / Camera_Lens* / Flash / Volume_Buttons / Power_Button → protected
   Authored in the canonical hotspot space: 3.4 wide × 7 tall × ~0.44 deep, centered at origin.
   Run: node client/tests/make-smartphone-glb.mjs → client/public/models/smartphone.glb */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* GLTFExporter expects browser globals in Node. The exporter assigns
   onloadend AFTER calling readAsArrayBuffer, so the callback must fire async. */
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        Promise.resolve().then(() => this.onloadend?.());
      });
    }
  };
}

const mat = (color, o = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: o.metalness ?? 0.6,
    roughness: o.roughness ?? 0.35,
    ...(o.emissive ? { emissive: new THREE.Color(o.emissive), emissiveIntensity: o.emissiveIntensity ?? 1 } : {}),
  });

const add = (scene, mesh, name, pos = [0, 0, 0], rot) => {
  mesh.name = name;
  mesh.position.set(...pos);
  if (rot) mesh.rotation.set(...rot);
  scene.add(mesh);
  return mesh;
};

const scene = new THREE.Scene();
scene.name = 'Smartphone';

/* Titanium-blue slab — the tintable core (colorize: 'body') */
add(scene, new THREE.Mesh(new RoundedBoxGeometry(3.4, 7, 0.4, 5, 0.34), mat(0x355c8a, { metalness: 0.75, roughness: 0.3 })), 'Phone_Body');

/* Back plate — slightly proud of the core (colorize: 'back') */
add(scene, new THREE.Mesh(new RoundedBoxGeometry(3.32, 6.94, 0.06, 4, 0.25), mat(0x355c8a, { metalness: 0.7, roughness: 0.32 })), 'Phone_Back', [0, 0, -0.215]);

/* Frame rim — pokes out 0.02 on each side (colorize: 'frame') */
add(scene, new THREE.Mesh(new RoundedBoxGeometry(3.46, 7.05, 0.42, 5, 0.36), mat(0x2b4a73, { metalness: 0.85, roughness: 0.25 })), 'Phone_Frame');

/* Front glass — near-black with a faint blue sheen (protected: 'screen') */
add(
  scene,
  new THREE.Mesh(new RoundedBoxGeometry(3.18, 6.72, 0.05, 4, 0.2), mat(0x05070d, { metalness: 0.2, roughness: 0.12, emissive: 0x0b1e3a, emissiveIntensity: 0.35 })),
  'Screen',
  [0, 0, 0.215]
);

/* Punch-hole selfie camera on the screen */
add(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 24), mat(0x000000, { metalness: 0.9, roughness: 0.1 })), 'Selfie_Camera', [0.9, 3.05, 0.245], [Math.PI / 2, 0, 0]);

/* Rear camera island (protected: 'camera') */
add(scene, new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.5, 0.1, 4, 0.18), mat(0x101014, { metalness: 0.5, roughness: 0.4 })), 'Camera_Island', [-0.85, 2.4, -0.28]);

/* Three lenses + flash on the island (protected: 'lens'/'camera') */
const lensPos = [
  [-1.25, 2.8],
  [-0.45, 2.8],
  [-0.85, 2.0],
];
for (const [x, y] of lensPos) {
  add(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 28), mat(0x06070a, { metalness: 0.9, roughness: 0.08 })), 'Camera_Lens', [x, y, -0.335], [Math.PI / 2, 0, 0]);
  add(scene, new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 10, 28), mat(0x3a3d45, { metalness: 0.9, roughness: 0.2 })), 'Camera_Lens_Ring', [x, y, -0.33]);
}
add(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), mat(0xf5f0dc, { metalness: 0.3, roughness: 0.5 })), 'Flash', [-1.25, 2.0, -0.33], [Math.PI / 2, 0, 0]);

/* Side buttons (protected) */
add(scene, new THREE.Mesh(new RoundedBoxGeometry(0.07, 1.1, 0.14, 2, 0.03), mat(0x1a1d24, { metalness: 0.8, roughness: 0.3 })), 'Volume_Buttons', [1.75, 1.3, 0]);
add(scene, new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.7, 0.14, 2, 0.03), mat(0x1a1d24, { metalness: 0.8, roughness: 0.3 })), 'Power_Button', [1.75, 0.1, 0]);

const exporter = new GLTFExporter();
const fs = await import('node:fs');
fs.mkdirSync(new URL('../public/models/', import.meta.url), { recursive: true });

exporter.parse(
  scene,
  (glb) => {
    const out = new URL('../public/models/smartphone.glb', import.meta.url);
    fs.writeFileSync(out, Buffer.from(glb));
    console.log('wrote client/public/models/smartphone.glb —', glb.byteLength, 'bytes');
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
  { binary: true }
);
