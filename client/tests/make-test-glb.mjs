/* Generates a minimal test GLB with named meshes:
   Phone_Body (colorable), Phone_Back (colorable), Screen (protected), Camera_Glass (protected)
   Run: node client/tests/make-test-glb.mjs  → client/public/models/test-phone.glb */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Scene, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';

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

function box(w, h, d, color, name) {
  const m = new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color }));
  m.name = name;
  return m;
}

const scene = new Scene();
scene.name = 'Phone';

const body = box(1.4, 3.0, 0.16, 0x355c8a, 'Phone_Body');
const back = box(1.35, 2.9, 0.05, 0x355c8a, 'Phone_Back');
back.position.z = -0.1;
const screen = box(1.25, 2.75, 0.02, 0x0a1230, 'Screen');
screen.position.z = 0.095;
const cam = box(0.5, 0.5, 0.03, 0x0d0d0f, 'Camera_Glass');
cam.position.set(-0.35, 1.05, 0.11);

scene.add(body, back, screen, cam);

const exporter = new GLTFExporter();

const fs = await import('node:fs');
const outPath = new URL('../public/models/', import.meta.url);
fs.mkdirSync(outPath, { recursive: true });

exporter.parse(
  scene,
  (glb) => {
    fs.writeFileSync(new URL('../public/models/test-phone.glb', import.meta.url), Buffer.from(glb));
    console.log('wrote client/public/models/test-phone.glb', glb.byteLength, 'bytes');
  },
  (err) => { console.error(err); process.exit(1); },
  { binary: true }
);
