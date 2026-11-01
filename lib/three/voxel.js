// Voxel builder: model sets, props and characters as boxes with a matrix stack, rendered as one
// InstancedMesh per group (thousands of boxes, one draw call).
//
// Lessons behind it:
// - Slightly rounded boxes (bevel ~0.09) and per-box colour jitter (+-3.5 % lightness, seeded)
//   make voxels read as made objects instead of flat CG.
// - Coplanar faces flicker (z-fighting) and were rejected as "textures pass through each other".
//   Offset decals by >= 0.02 along the normal, and run a coplanar-face audit before showing.
// - Build parts around their pivot (part()) so limbs rotate at the joint, and keep limbs as one
//   continuous box chain (same section, same axis): misaligned rig parts read as "two pairs of hands".
import { mulberry32 } from '../core.js';

export function voxelBuilder(THREE, { RoundedBoxGeometry = null, roughness = 0.78, bevel = 0.09, seed = 7 } = {}) {
  const unit = RoundedBoxGeometry ? new RoundedBoxGeometry(1, 1, 1, 2, bevel) : new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ roughness, metalness: 0 });
  const rnd = mulberry32(seed);
  let stack = [new THREE.Matrix4()], boxes = [];
  const top = () => stack[stack.length - 1];

  const M = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));

  const jitter = (col, a = 0.035) => {
    const c = new THREE.Color(col), h = {};
    c.getHSL(h);
    c.setHSL(h.h, h.s, Math.min(1, Math.max(0, h.l + (rnd() - 0.5) * a)));
    return c;
  };

  const api = {
    M,
    push: (m) => stack.push(top().clone().multiply(m)),
    pop: () => stack.pop(),
    /** Box with its BOTTOM centre at (x, y, z), size w x h x d, colour col, jitter a. */
    box(x, y, z, w, h, d, col, a = 0.035) {
      boxes.push({ m: top().clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d))), c: jitter(col, a) });
    },
    /** Run fn, collect its boxes into a Group holding one InstancedMesh. */
    build(fn) {
      const saved = [stack, boxes];
      stack = [new THREE.Matrix4()]; boxes = [];
      fn(api);
      const g = new THREE.Group();
      if (boxes.length) {
        const im = new THREE.InstancedMesh(unit, material, boxes.length);
        boxes.forEach((b, i) => { im.setMatrixAt(i, b.m); im.setColorAt(i, b.c); });
        im.castShadow = im.receiveShadow = true;
        im.frustumCulled = false;
        g.add(im);
      }
      [stack, boxes] = saved;
      return g;
    },
    /** A group whose origin is the pivot p (root coordinates); fn draws in root coordinates. */
    part(p, fn) {
      const g = api.build(() => { api.push(M(-p[0], -p[1], -p[2])); fn(api); api.pop(); });
      const o = new THREE.Group();
      o.add(g);
      o.userData.pivot = new THREE.Vector3(...p);
      o.position.set(...p);
      return o;
    },
    /** Attach a part to a parent part, converting the child's pivot to the parent's local space. */
    attach(parent, child) {
      parent.add(child);
      if (parent.userData.pivot) child.position.sub(parent.userData.pivot);
      return child;
    },
  };
  return api;
}
