// A neutral studio set for the path-traced mode: everything a path tracer does better than the
// rasteriser in one frame. Glass refracts and throws caustics, metal reflects the room, the area
// light gives soft contact shadows, and the physical camera's aperture blurs the far wall.
// update() sets every animated property from t alone (no +=, no previous frame).
import * as G from '../lib/gl.js';
import * as PT from '../lib/pathtrace.js';
import * as M from '../lib/motion.js';

const { THREE } = G;

export function studioSet() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0c);
  const cam = PT.physicalCamera(35, { fStop: 2.2, focusDistance: 6 });

  const matte = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.75 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), matte);
  floor.rotation.x = -Math.PI / 2;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), matte);
  wall.position.set(0, 10, -6);

  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.9, 96, 48),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0, ior: 1.5, thickness: 1.8 }));
  const metal = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.2, 220, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.12 }));
  const clay = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshPhysicalMaterial({ color: 0xe6e6e6, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.08 }));

  // the key light is an area light: its size sets how soft the shadows are; the gradient
  // environment is the fill and what the metal and glass reflect
  scene.environment = PT.gradientEnvironment(0x3c3c3c, 0x060606);
  const light = PT.areaLight(0xffffff, 18, 4, 2.5);
  light.position.set(-2, 5, 3);
  light.lookAt(0, 0.5, 0);

  scene.add(floor, wall, glass, metal, clay, light);

  return {
    scene, camera: cam,
    update(t) {
      glass.position.set(-1.6, 0.9 + 0.25 * Math.sin(t * 1.6), 0.4);
      metal.position.set(0.3, 1.0, -0.6);
      metal.rotation.set(0.4 * t, 0.9 * t, 0);
      clay.position.set(1.9, 0.55, 0.6);
      clay.rotation.y = 0.6 + 0.3 * Math.sin(t * 0.8);
      const a = -0.35 + 0.12 * t;                           // a slow orbit
      cam.position.set(Math.sin(a) * 7, 2.2, Math.cos(a) * 7);
      cam.lookAt(0, 0.9, 0);
      cam.aspect = M.W / M.H;
      cam.updateProjectionMatrix();
    },
  };
}
