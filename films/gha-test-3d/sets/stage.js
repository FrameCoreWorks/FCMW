// A neutral 3-D stage for the --3d starter: three primitives drop onto a floor on the beat, a slow
// orbiting camera, key/rim lights and the shared environment light. Replace it with the approved
// shot list. update() sets every animated property from (t, u) alone: no +=, no previous frame.
import * as G from '../lib/gl.js';
import * as M from '../lib/motion.js';

const { THREE } = G;

// Drop beats match HITS in film.js, so each landing gets its sound.
export const DROPS = [0, 0.5, 1];

export function stageSet({ bg = 0x1c1c1c, floor = 0x3a3a3a, colors = [0xc8c8c8, 0x8a8a8a, 0xb0b0b0] } = {}) {
  const scene = new THREE.Scene();
  scene.environment = G.ENV;
  scene.environmentIntensity = 0.45;
  // the floor fades into the background colour, so it has no visible edge
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(bg, 10, 30);
  // portrait needs a wider lens to keep all three shapes in frame
  const cam = G.camera(M.FORMAT.portrait ? 55 : 35);
  const { key } = G.keyLights(scene, { key: 2.4, rim: 1.8, fill: 0.35 });
  key.castShadow = true;                                  // soft contact shadows anchor the shapes
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.85 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const mat = (c, extra = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.6, ...extra });
  const shapes = [
    { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.75, 64, 32), mat(colors[0])), x: -1.9, rest: 0.75 },
    { mesh: new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), mat(colors[1])), x: 0, rest: 0.65 },
    { mesh: new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.24, 32, 96), mat(colors[2], { metalness: 0.6, roughness: 0.25 })), x: 1.9, rest: 0.85 },
  ];
  for (const s of shapes) { s.mesh.castShadow = true; scene.add(s.mesh); }

  return {
    scene, camera: cam,
    update(t, u) {
      shapes.forEach((s, i) => {
        const b = DROPS[i] - 0.35;                        // fall starts just before the beat it lands on
        const k = M.springU(u, b, M.SPRING.bouncy);       // 0 -> 1 with overshoot: the bounce
        s.mesh.visible = u >= b;
        s.mesh.position.set(s.x, s.rest + (1 - k) * 5, 0);
        const squash = 0.12 * M.wobble(u - DROPS[i], 2.6, 7); // land, squash, settle
        s.mesh.scale.set(1 + squash, 1 - squash, 1 + squash);
        s.mesh.rotation.set(0, 0.5 * i + 0.15 * t, i === 2 ? Math.PI / 2 - 0.25 : 0);
      });
      // camera: pushes in after the landings, then a slow orbit; portrait sits further back
      const far = M.FORMAT.portrait ? 1.6 : 1;
      const d = far * M.springKeys(u, [[0, 10], [2, 7.5]], M.SPRING.gentle);
      const a = -0.3 + 0.06 * t;
      G.lookFrom(cam, [Math.sin(a) * d, 2.4 + 0.15 * d, Math.cos(a) * d], [0, 0.7, 0]);
      cam.aspect = M.W / M.H;
      cam.updateProjectionMatrix();
    },
  };
}
