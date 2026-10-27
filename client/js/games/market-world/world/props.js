// ==========================================================
// Market World - the small shared models.
//
// Products on shelves, plants in the ground, coins, markers. Each one
// is built once in plain white and drawn many times with a tint, so a
// shelf of forty tomatoes still costs almost nothing.
// ==========================================================
import { MeshBuilder, roundBoxGeo, sphereGeo, cylinderGeo, coneGeo, discGeo, planeGeo } from '../engine/geometry.js';
import { Mesh } from '../engine/renderer.js';

function mk(gl, fn) {
  const b = new MeshBuilder();
  fn(b);
  return new Mesh(gl, b.data());
}

/** The little models that stand in for each product shape. */
export function createProductMeshes(gl) {
  return {
    box: mk(gl, (b) => b.add(roundBoxGeo(0.3, 0.34, 0.22, 0.04), { y: 0.17, color: '#ffffff' })),
    bottle: mk(gl, (b) => {
      b.add(cylinderGeo(0.09, 0.3, 8), { y: 0.15, color: '#ffffff' });
      b.add(cylinderGeo(0.045, 0.12, 6), { y: 0.34, color: '#ffffff' });
    }),
    jar: mk(gl, (b) => {
      b.add(cylinderGeo(0.11, 0.22, 9), { y: 0.11, color: '#ffffff' });
      b.add(cylinderGeo(0.115, 0.05, 9), { y: 0.24, color: '#ffffff' });
    }),
    ball: mk(gl, (b) => b.add(sphereGeo(0.13, 6, 9), { y: 0.13, color: '#ffffff' })),
    bag: mk(gl, (b) => b.add(roundBoxGeo(0.28, 0.32, 0.14, 0.08), { y: 0.16, color: '#ffffff' })),
    carton: mk(gl, (b) => b.add(roundBoxGeo(0.34, 0.16, 0.24, 0.03), { y: 0.08, color: '#ffffff' })),
    cup: mk(gl, (b) => b.add(cylinderGeo(0.1, 0.2, 9, 0.12), { y: 0.1, color: '#ffffff' })),
    wedge: mk(gl, (b) => b.add(coneGeo(0.16, 0.24, 4), { y: 0.12, ry: 0.6, color: '#ffffff' })),
    loaf: mk(gl, (b) => b.add(roundBoxGeo(0.34, 0.2, 0.2, 0.09), { y: 0.11, color: '#ffffff' })),
    cake: mk(gl, (b) => {
      b.add(cylinderGeo(0.16, 0.16, 10), { y: 0.08, color: '#ffffff' });
      b.add(sphereGeo(0.045, 5, 7), { y: 0.18, color: '#ffffff' });
    }),
    roll: mk(gl, (b) => b.add(cylinderGeo(0.1, 0.34, 9), { y: 0.17, color: '#ffffff' })),
    cone: mk(gl, (b) => b.add(coneGeo(0.1, 0.32, 8), { y: 0.16, color: '#ffffff' })),
    leaf: mk(gl, (b) => {
      b.add(sphereGeo(0.15, 5, 8), { y: 0.13, sy: 0.8, color: '#ffffff' });
      b.add(sphereGeo(0.09, 4, 6), { x: 0.1, y: 0.18, z: 0.06, color: '#ffffff' });
    }),
    lump: mk(gl, (b) => b.add(sphereGeo(0.13, 5, 8), { y: 0.11, sy: 0.78, sx: 1.2, color: '#ffffff' })),
    cob: mk(gl, (b) => b.add(cylinderGeo(0.075, 0.34, 8), { y: 0.17, rx: 0.12, color: '#ffffff' })),
    stalk: mk(gl, (b) => {
      b.add(cylinderGeo(0.035, 0.36, 5), { y: 0.18, color: '#ffffff' });
      b.add(sphereGeo(0.07, 4, 6), { y: 0.38, sy: 1.6, color: '#ffffff' });
    }),
    cluster: mk(gl, (b) => {
      b.add(sphereGeo(0.075, 5, 7), { y: 0.09, color: '#ffffff' });
      b.add(sphereGeo(0.075, 5, 7), { x: 0.09, y: 0.16, color: '#ffffff' });
      b.add(sphereGeo(0.075, 5, 7), { x: -0.07, y: 0.17, z: 0.05, color: '#ffffff' });
    }),
    bucket: mk(gl, (b) => b.add(cylinderGeo(0.13, 0.24, 9, 0.15), { y: 0.12, color: '#ffffff' }))
  };
}

/** Plants, at every stage of their life. */
export function createCropMeshes(gl) {
  return {
    soil: mk(gl, (b) => b.add(roundBoxGeo(2.1, 0.18, 2.1, 0.05), { y: 0.09, color: '#ffffff' })),
    furrow: mk(gl, (b) => {
      for (let i = -1; i <= 1; i += 1) b.add(roundBoxGeo(1.8, 0.06, 0.24, 0.03), { y: 0.2, z: i * 0.55, color: '#ffffff' });
    }),
    sprout: mk(gl, (b) => {
      b.add(cylinderGeo(0.025, 0.16, 5), { y: 0.08, color: '#ffffff' });
      b.add(sphereGeo(0.07, 4, 6), { y: 0.18, sy: 0.5, color: '#ffffff' });
    }),
    bush: mk(gl, (b) => {
      b.add(sphereGeo(0.26, 6, 9), { y: 0.22, sy: 0.8, color: '#ffffff' });
      b.add(sphereGeo(0.16, 5, 7), { x: 0.18, y: 0.3, z: 0.1, color: '#ffffff' });
      b.add(sphereGeo(0.16, 5, 7), { x: -0.16, y: 0.28, z: -0.12, color: '#ffffff' });
    }),
    tuft: mk(gl, (b) => {
      for (let i = 0; i < 5; i += 1) {
        b.add(coneGeo(0.045, 0.34, 4), { x: Math.cos(i * 1.3) * 0.1, y: 0.17, z: Math.sin(i * 1.3) * 0.1, rz: Math.cos(i) * 0.3, color: '#ffffff' });
      }
    }),
    tall: mk(gl, (b) => {
      b.add(cylinderGeo(0.05, 0.9, 6), { y: 0.45, color: '#ffffff' });
      for (let i = 0; i < 4; i += 1) {
        b.add(roundBoxGeo(0.4, 0.03, 0.1, 0.01), { x: (i % 2 ? 0.2 : -0.2), y: 0.35 + i * 0.16, rz: (i % 2 ? -0.5 : 0.5), color: '#ffffff' });
      }
    }),
    vine: mk(gl, (b) => {
      b.add(cylinderGeo(0.04, 0.7, 5), { y: 0.35, color: '#ffffff' });
      b.add(sphereGeo(0.2, 5, 8), { y: 0.55, sy: 0.7, color: '#ffffff' });
      b.add(sphereGeo(0.14, 4, 7), { x: 0.16, y: 0.4, color: '#ffffff' });
    }),
    cactus: mk(gl, (b) => {
      b.add(roundBoxGeo(0.24, 0.8, 0.24, 0.11), { y: 0.4, color: '#ffffff' });
      b.add(roundBoxGeo(0.16, 0.34, 0.16, 0.07), { x: 0.22, y: 0.52, color: '#ffffff' });
    }),
    ground: mk(gl, (b) => {
      b.add(sphereGeo(0.3, 6, 9), { y: 0.2, sy: 0.62, color: '#ffffff' });
      b.add(sphereGeo(0.14, 4, 7), { x: 0.3, y: 0.12, sy: 0.7, color: '#ffffff' });
    }),
    fruit: mk(gl, (b) => b.add(sphereGeo(0.1, 5, 8), { color: '#ffffff' })),
    driedOut: mk(gl, (b) => b.add(coneGeo(0.1, 0.2, 5), { y: 0.1, rz: 0.5, color: '#ffffff' }))
  };
}

/** Effects, markers and other odds and ends. */
export function createFxMeshes(gl) {
  return {
    coin: mk(gl, (b) => b.add(cylinderGeo(0.12, 0.04, 10), { rx: Math.PI / 2, color: '#ffffff' })),
    star: mk(gl, (b) => {
      for (let i = 0; i < 4; i += 1) b.add(roundBoxGeo(0.24, 0.07, 0.07, 0.02), { rz: i * 0.785, color: '#ffffff' });
    }),
    cube: mk(gl, (b) => b.add(roundBoxGeo(0.14, 0.14, 0.14, 0.04), { color: '#ffffff' })),
    drop: mk(gl, (b) => b.add(sphereGeo(0.06, 4, 6), { sy: 1.5, color: '#ffffff' })),
    marker: mk(gl, (b) => {
      b.add(coneGeo(0.22, 0.4, 6), { y: 0.2, rx: Math.PI, color: '#ffffff' });
    }),
    ring: mk(gl, (b) => b.add(discGeo(0.9, 18), { color: '#ffffff' })),
    puddle: mk(gl, (b) => b.add(discGeo(0.4, 10), { color: '#ffffff' })),
    litter: mk(gl, (b) => b.add(roundBoxGeo(0.22, 0.05, 0.18, 0.02), { y: 0.03, ry: 0.6, color: '#ffffff' })),
    plane: mk(gl, (b) => b.add(planeGeo(1, 1), { color: '#ffffff' }))
  };
}
