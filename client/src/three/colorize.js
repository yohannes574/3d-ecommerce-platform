/**
 * Selective GLB colorization for variant colors.
 *
 * A phone GLB typically contains Body, Screen, Camera Glass, USB Port…
 * Recoloring every material would paint the screen and glass too, so meshes
 * are classified first:
 *
 *   colorable  → body/back/frame/shell/casing…   (gets the variant color)
 *   protected  → screen/camera/port/speaker…     (never touched)
 *   neutral    → everything else                 (never touched)
 *
 * If a GLB has no colorable-named parts at all, nothing is tinted — a seller
 * naming their meshes "Phone_Body"/"Phone_Back" gets recoloring for free
 * (the product form shows a parts report so they know what to rename).
 */

/* Names that carry the product's finish/color. */
const COLORABLE = [
  'body', 'back', 'frame', 'shell', 'casing', 'chassis', 'housing',
  'cover', 'enclosure', 'exterior', 'band',
];

/* Names that must keep their own look (screens, glass, openings, details). */
const PROTECTED = [
  'screen', 'display', 'glass', 'lens', 'camera', 'cam_', 'sensor',
  'port', 'usb', 'type-c', 'usbc', 'lightning', 'speaker', 'mic',
  'grill', 'button', 'buttons', 'key', 'keyboard', 'trackpad', 'hinge',
  'logo', 'strap', 'lanyard', 'stand', 'screen_protector', 'notch',
  'punch-hole', 'punchhole', 'front_cam',
];

import { Color } from 'three';

const has = (name, list) => list.some((frag) => name.includes(frag));

/**
 * 'colorable' | 'protected' | 'neutral' for a mesh/object name.
 * Protected wins over colorable (e.g. "Back_Glass" stays glass).
 */
export function classifyPart(name = '') {
  const n = String(name).toLowerCase();
  if (!n) return 'neutral';
  if (has(n, PROTECTED)) return 'protected';
  if (has(n, COLORABLE)) return 'colorable';
  return 'neutral';
}

/** Scan a scene → { colorable:[names], protected:[names], neutral:[names] } (deduped, original order). */
export function collectParts(scene) {
  const out = { colorable: [], protected: [], neutral: [] };
  scene?.traverse?.((o) => {
    if (!o.isMesh) return;
    const kind = classifyPart(o.name);
    if (kind !== 'neutral' || o.name) {
      const bucket = out[kind];
      if (!bucket.includes(o.name)) bucket.push(o.name);
    }
  });
  return out;
}

const tintTargets = (scene) => {
  const meshes = [];
  scene?.traverse?.((o) => {
    if (o.isMesh && classifyPart(o.name) === 'colorable' && o.material) meshes.push(o);
  });
  return meshes;
};

/**
 * Tint only colorable parts. Materials are cloned per-mesh on first use so a
 * material shared between a body and (say) a button never leaks the color.
 * The original material is kept (other meshes may still reference it).
 * Returns the number of colorable meshes tinted.
 */
export function applyTint(scene, hex) {
  if (!scene || !hex) return 0;
  const color = new Color(hex);
  let count = 0;
  for (const mesh of tintTargets(scene)) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = Array.isArray(mesh.material) ? [...mesh.material] : mesh.material;
    let changed = false;
    mats.forEach((m, i) => {
      if (!m || !m.color) return;
      let target = m;
      if (!m.userData?.__voltixClone) {
        target = m.clone();
        target.userData = { ...target.userData, __voltixClone: true };
        if (Array.isArray(mesh.material)) next[i] = target;
        else mesh.material = target; // swap single material in place
        changed = true;
      }
      target.color.set(color);
    });
    if (changed && Array.isArray(mesh.material)) mesh.material = next;
    count += 1;
  }
  return count;
}
