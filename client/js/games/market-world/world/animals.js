// ==========================================================
// Market World - livestock.
//
// Small baked models with a hop, a wander and a little "ready" bubble
// when there is something to collect.
// ==========================================================
import { MeshBuilder } from '../engine/geometry.js';
import { Mesh } from '../engine/renderer.js';
import { rand } from '../engine/math.js';
import { ANIMALS } from '../data/catalog.js';

function chicken(b) {
  b.ball({ y: 0.32, r: 0.24, rings: 6, seg: 9, sx: 1.15, color: '#f6f1e6' });
  b.ball({ x: 0, y: 0.56, z: 0.2, r: 0.15, rings: 6, seg: 8, color: '#fbf7ee' });
  b.cone({ y: 0.56, z: 0.36, r: 0.06, h: 0.14, rx: Math.PI / 2, color: '#f0a83a' });
  b.box({ y: 0.7, z: 0.19, w: 0.06, h: 0.12, d: 0.16, color: '#e05a3a' });
  b.cone({ y: 0.4, z: -0.3, r: 0.12, h: 0.24, rx: -1.1, color: '#efe6d6' });
  b.cyl({ x: -0.08, y: 0.09, z: 0.02, r: 0.03, h: 0.18, seg: 5, color: '#f0a83a' });
  b.cyl({ x: 0.08, y: 0.09, z: 0.02, r: 0.03, h: 0.18, seg: 5, color: '#f0a83a' });
}

function cow(b) {
  b.box({ y: 0.72, w: 0.72, h: 0.6, d: 1.15, bevel: 0.22, color: '#f4f2ee' });
  b.ball({ x: 0.2, y: 0.85, z: 0.15, r: 0.22, rings: 5, seg: 8, color: '#4a4038' });
  b.ball({ x: -0.24, y: 0.6, z: -0.3, r: 0.18, rings: 5, seg: 8, color: '#4a4038' });
  b.box({ y: 0.86, z: 0.68, w: 0.42, h: 0.4, d: 0.42, bevel: 0.14, color: '#f4f2ee' });
  b.box({ y: 0.78, z: 0.88, w: 0.3, h: 0.22, d: 0.12, bevel: 0.06, color: '#e8b0b0' });
  b.cone({ x: -0.2, y: 1.08, z: 0.6, r: 0.06, h: 0.14, color: '#e0d8c8' });
  b.cone({ x: 0.2, y: 1.08, z: 0.6, r: 0.06, h: 0.14, color: '#e0d8c8' });
  for (const [x, z] of [[-0.24, 0.4], [0.24, 0.4], [-0.24, -0.4], [0.24, -0.4]]) {
    b.cyl({ x, y: 0.21, z, r: 0.09, h: 0.42, seg: 6, color: '#4a4038' });
  }
  b.cyl({ y: 0.8, z: -0.66, r: 0.04, h: 0.5, rx: 0.5, seg: 5, color: '#4a4038' });
}

function goat(b) {
  b.box({ y: 0.6, w: 0.5, h: 0.44, d: 0.9, bevel: 0.18, color: '#d9cfc0' });
  b.box({ y: 0.76, z: 0.56, w: 0.3, h: 0.32, d: 0.34, bevel: 0.12, color: '#e2d9cc' });
  b.cone({ x: -0.11, y: 0.98, z: 0.5, r: 0.05, h: 0.24, rx: -0.5, color: '#6d6255' });
  b.cone({ x: 0.11, y: 0.98, z: 0.5, r: 0.05, h: 0.24, rx: -0.5, color: '#6d6255' });
  b.box({ y: 0.6, z: 0.72, w: 0.12, h: 0.18, d: 0.1, color: '#efe9de' });
  for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) {
    b.cyl({ x, y: 0.19, z, r: 0.06, h: 0.38, seg: 6, color: '#6d6255' });
  }
}

function sheep(b) {
  b.ball({ y: 0.62, r: 0.42, rings: 7, seg: 10, sx: 1.1, sz: 1.3, color: '#efe9de' });
  b.ball({ x: 0.2, y: 0.82, z: 0.25, r: 0.2, rings: 5, seg: 8, color: '#f6f2ea' });
  b.ball({ x: -0.22, y: 0.72, z: -0.3, r: 0.2, rings: 5, seg: 8, color: '#f6f2ea' });
  b.box({ y: 0.7, z: 0.56, w: 0.26, h: 0.3, d: 0.3, bevel: 0.11, color: '#3f3a33' });
  b.ball({ x: -0.16, y: 0.82, z: 0.56, r: 0.08, rings: 4, seg: 6, color: '#3f3a33' });
  b.ball({ x: 0.16, y: 0.82, z: 0.56, r: 0.08, rings: 4, seg: 6, color: '#3f3a33' });
  for (const [x, z] of [[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.28], [0.18, -0.28]]) {
    b.cyl({ x, y: 0.16, z, r: 0.06, h: 0.34, seg: 6, color: '#3f3a33' });
  }
}

const BUILDERS = { chicken, cow, goat, sheep };

export function createAnimalMeshes(gl) {
  const out = {};
  Object.entries(BUILDERS).forEach(([id, fn]) => {
    const b = new MeshBuilder();
    fn(b);
    out[id] = new Mesh(gl, b.data());
  });
  return out;
}

/** Runtime animals: purely decorative, driven by the pen's saved state. */
export class Herd {
  constructor() {
    this.byPen = new Map();
  }

  sync(layout, pens) {
    const wanted = new Set();
    pens.forEach((pen, i) => {
      if (!pen || !pen.animal) return;
      wanted.add(i);
      let group = this.byPen.get(i);
      const spot = layout.pens[i];
      if (!spot) return;
      const count = 3;
      if (!group || group.type !== pen.animal) {
        group = { type: pen.animal, members: [] };
        for (let m = 0; m < count; m += 1) {
          group.members.push({
            x: spot.x + rand(-1.2, 1.2), z: spot.z + rand(-1.2, 1.2),
            tx: spot.x, tz: spot.z, yaw: rand(0, 6.28), hop: rand(0, 6.28), wait: rand(0, 3)
          });
        }
        this.byPen.set(i, group);
      }
      group.spot = spot;
    });
    [...this.byPen.keys()].forEach((k) => { if (!wanted.has(k)) this.byPen.delete(k); });
  }

  update(dt) {
    this.byPen.forEach((group) => {
      const spot = group.spot;
      if (!spot) return;
      group.members.forEach((m) => {
        m.hop += dt * 6;
        m.wait -= dt;
        if (m.wait <= 0) {
          m.tx = spot.x + rand(-1.4, 1.4);
          m.tz = spot.z + rand(-1.4, 1.4);
          m.wait = rand(1.5, 5);
        }
        const dx = m.tx - m.x; const dz = m.tz - m.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.1) {
          const step = Math.min(d, dt * 0.9);
          m.x += (dx / d) * step;
          m.z += (dz / d) * step;
          m.yaw = Math.atan2(dx, dz);
          m.moving = 1;
        } else m.moving = 0;
      });
    });
  }

  draw(renderer, meshes, shadowMesh) {
    this.byPen.forEach((group) => {
      const mesh = meshes[group.type];
      if (!mesh) return;
      const scale = group.type === 'cow' ? 1 : 0.9;
      group.members.forEach((m) => {
        const hop = m.moving ? Math.abs(Math.sin(m.hop)) * 0.07 : 0;
        renderer.draw(shadowMesh, { x: m.x, y: 0.02, z: m.z, s: 0.8 * scale }, [0.25, 0.3, 0.32], 0.25);
        renderer.draw(mesh, { x: m.x, y: hop, z: m.z, ry: m.yaw, s: scale });
      });
    });
  }
}

export { ANIMALS };
