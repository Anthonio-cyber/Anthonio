// ==========================================================
// Market World - the people.
//
// Every character in the game - the player, the staff and every
// shopper - is the same little rig: a handful of shared meshes drawn
// with different colours and posed by code. Nobody's arms are keyframed;
// the poses are worked out from the action they are busy with, which is
// what lets a shopper reach for a shelf the instant they arrive at one.
// ==========================================================
import { MeshBuilder, roundBoxGeo, sphereGeo, cylinderGeo, coneGeo, discGeo } from '../engine/geometry.js';
import { Mesh } from '../engine/renderer.js';
import { mat4, multiply, compose, rgb, lerp, clamp, turnTowards } from '../engine/math.js';

/** Builds the shared body parts once. Everything is white so tints work. */
export function createCharacterMeshes(gl) {
  const make = (fn) => {
    const b = new MeshBuilder();
    fn(b);
    return new Mesh(gl, b.data());
  };
  return {
    head: make((b) => {
      b.add(roundBoxGeo(0.52, 0.5, 0.48, 0.16), { color: '#ffffff' });
    }),
    face: make((b) => {
      b.add(sphereGeo(0.055, 6, 8), { x: -0.13, y: 0.04, z: 0.24, color: '#2a2320' });
      b.add(sphereGeo(0.055, 6, 8), { x: 0.13, y: 0.04, z: 0.24, color: '#2a2320' });
      b.add(roundBoxGeo(0.16, 0.04, 0.05, 0.02), { y: -0.12, z: 0.23, color: '#c96a5a' });
    }),
    torso: make((b) => {
      b.add(roundBoxGeo(0.56, 0.66, 0.36, 0.14), { color: '#ffffff' });
    }),
    hips: make((b) => {
      b.add(roundBoxGeo(0.5, 0.24, 0.34, 0.09), { color: '#ffffff' });
    }),
    // Limbs hang from their pivot, so a rotation swings them properly.
    arm: make((b) => {
      b.add(cylinderGeo(0.1, 0.5, 8), { y: -0.25, color: '#ffffff' });
      b.add(sphereGeo(0.11, 5, 8), { y: -0.5, color: '#ffffff' });
    }),
    leg: make((b) => {
      b.add(cylinderGeo(0.12, 0.62, 8), { y: -0.31, color: '#ffffff' });
    }),
    shoe: make((b) => {
      b.add(roundBoxGeo(0.2, 0.14, 0.32, 0.05), { z: 0.04, color: '#ffffff' });
    }),
    hairShort: make((b) => {
      b.add(roundBoxGeo(0.56, 0.2, 0.52, 0.09), { y: 0.2, color: '#ffffff' });
      b.add(roundBoxGeo(0.56, 0.16, 0.14, 0.05), { y: 0.06, z: -0.2, color: '#ffffff' });
    }),
    hairBun: make((b) => {
      b.add(roundBoxGeo(0.56, 0.18, 0.52, 0.09), { y: 0.2, color: '#ffffff' });
      b.add(sphereGeo(0.17, 6, 9), { y: 0.36, z: -0.2, color: '#ffffff' });
    }),
    hairCurls: make((b) => {
      b.add(sphereGeo(0.32, 6, 10), { y: 0.2, sy: 0.7, color: '#ffffff' });
      b.add(sphereGeo(0.16, 5, 8), { x: -0.2, y: 0.24, z: 0.06, color: '#ffffff' });
      b.add(sphereGeo(0.16, 5, 8), { x: 0.2, y: 0.24, z: 0.06, color: '#ffffff' });
    }),
    hairPony: make((b) => {
      b.add(roundBoxGeo(0.56, 0.2, 0.52, 0.09), { y: 0.2, color: '#ffffff' });
      b.add(cylinderGeo(0.09, 0.42, 7), { y: 0.06, z: -0.3, rx: 0.5, color: '#ffffff' });
    }),
    hairBraids: make((b) => {
      b.add(roundBoxGeo(0.56, 0.2, 0.52, 0.09), { y: 0.2, color: '#ffffff' });
      b.add(cylinderGeo(0.07, 0.5, 6), { x: -0.28, y: -0.02, z: -0.06, color: '#ffffff' });
      b.add(cylinderGeo(0.07, 0.5, 6), { x: 0.28, y: -0.02, z: -0.06, color: '#ffffff' });
    }),
    cap: make((b) => {
      b.add(roundBoxGeo(0.56, 0.22, 0.52, 0.1), { y: 0.22, color: '#ffffff' });
      b.add(roundBoxGeo(0.44, 0.05, 0.24, 0.02), { y: 0.13, z: 0.3, color: '#ffffff' });
    }),
    glasses: make((b) => {
      b.add(roundBoxGeo(0.18, 0.16, 0.04, 0.03), { x: -0.13, y: 0.04, z: 0.26, color: '#ffffff' });
      b.add(roundBoxGeo(0.18, 0.16, 0.04, 0.03), { x: 0.13, y: 0.04, z: 0.26, color: '#ffffff' });
      b.add(roundBoxGeo(0.1, 0.03, 0.03, 0.01), { y: 0.04, z: 0.26, color: '#ffffff' });
    }),
    headband: make((b) => {
      b.add(roundBoxGeo(0.58, 0.09, 0.54, 0.04), { y: 0.14, color: '#ffffff' });
    }),
    apron: make((b) => {
      b.add(roundBoxGeo(0.46, 0.56, 0.06, 0.05), { z: 0.2, y: -0.06, color: '#ffffff' });
    }),
    backpack: make((b) => {
      b.add(roundBoxGeo(0.4, 0.44, 0.2, 0.07), { z: -0.27, color: '#ffffff' });
    }),
    crate: make((b) => {
      b.add(roundBoxGeo(0.42, 0.3, 0.34, 0.05), { color: '#ffffff' });
    }),
    basket: make((b) => {
      b.add(cylinderGeo(0.19, 0.22, 10), { color: '#ffffff' });
      b.add(cylinderGeo(0.2, 0.04, 10), { y: 0.12, color: '#ffffff' });
    }),
    can: make((b) => {
      b.add(cylinderGeo(0.11, 0.24, 9), { color: '#ffffff' });
      b.add(cylinderGeo(0.03, 0.26, 6), { x: 0.16, y: 0.06, rz: -0.9, color: '#ffffff' });
    }),
    shadow: make((b) => {
      b.add(discGeo(0.5, 14), { color: '#20303a' });
    }),
    spark: make((b) => {
      b.add(roundBoxGeo(0.16, 0.16, 0.16, 0.05), { color: '#ffffff' });
    }),
    drop: make((b) => {
      b.add(coneGeo(0.07, 0.18, 6), { rx: Math.PI, color: '#ffffff' });
    })
  };
}

const HAIR_MESH = {
  short: 'hairShort', bun: 'hairBun', curls: 'hairCurls',
  ponytail: 'hairPony', braids: 'hairBraids', cap: 'cap'
};

const WHITE = [1, 1, 1];

/** One person in the world. */
export class Actor {
  constructor(look, opts = {}) {
    this.look = look;
    this.x = opts.x || 0;
    this.y = 0;
    this.z = opts.z || 0;
    this.yaw = opts.yaw || 0;
    this.speed = opts.speed || 4.2;
    this.scale = opts.scale || 1;
    this.moving = 0;
    this.phase = Math.random() * 6.28;
    this.action = null;         // plant | water | harvest | stock | till | repair | cheer
    this.actionT = 0;
    this.carry = null;          // { id, count } shown as a crate in both hands
    this.carryStyle = opts.carryStyle || 'crate';
    this.bob = 0;
    this.stuckT = 0;
    this.tint = opts.tint || null;
    this.mood = 1;
    this.matrixRoot = mat4();
    this.matrixPart = mat4();
    this.matrixOut = mat4();
  }

  setAction(name, seconds = 1) {
    this.action = name;
    this.actionT = seconds;
    this.actionTotal = seconds;
  }

  faceTowards(x, z, dt, rate = 10) {
    const target = Math.atan2(x - this.x, z - this.z);
    this.yaw = turnTowards(this.yaw, target, rate * dt);
  }

  /** Steps towards a point. Returns true once it has arrived. */
  stepTo(target, dt, layout, collideFn, arrive = 0.4, speedMul = 1) {
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < arrive) { this.moving = Math.max(0, this.moving - dt * 4); return true; }
    const step = Math.min(dist, this.speed * speedMul * dt);
    const nx = this.x + (dx / dist) * step;
    const nz = this.z + (dz / dist) * step;
    const moved = collideFn ? collideFn(layout, this, { x: nx, z: nz }) : { x: nx, z: nz };
    const gained = Math.hypot(moved.x - this.x, moved.z - this.z);
    // Walking into a wall counts as being stuck, so whoever owns this
    // actor can work out a new way round instead of shuffling forever.
    if (gained < step * 0.4) this.stuckT += dt;
    else this.stuckT = 0;
    this.x = moved.x;
    this.z = moved.z;
    this.yaw = turnTowards(this.yaw, Math.atan2(dx, dz), 9 * dt);
    this.moving = Math.min(1, this.moving + dt * 6);
    return false;
  }

  update(dt) {
    this.phase += dt * (4 + this.moving * 7);
    if (this.actionT > 0) {
      this.actionT -= dt;
      if (this.actionT <= 0) { this.action = null; this.actionT = 0; }
    }
  }

  /** Works out every joint angle for this frame. */
  pose() {
    const swing = Math.sin(this.phase) * this.moving * 0.85;
    const p = {
      bob: Math.abs(Math.sin(this.phase)) * this.moving * 0.07 + Math.sin(this.phase * 0.35) * 0.012,
      lean: this.moving * 0.13,
      armL: -swing, armR: swing,
      armLZ: 0.08, armRZ: -0.08,
      legL: swing * 0.9, legR: -swing * 0.9,
      headTilt: 0,
      twist: 0,
      handItem: null
    };
    const a = this.action;
    if (!a) return p;
    const t = this.actionTotal ? 1 - this.actionT / this.actionTotal : 0;
    const pulse = Math.sin(t * Math.PI * 3);
    switch (a) {
      case 'plant':
        p.lean = 0.75; p.bob -= 0.16;
        p.armL = -1.9 - pulse * 0.3; p.armR = -1.9 - pulse * 0.3;
        p.legL = 0.35; p.legR = -0.2;
        break;
      case 'water':
        p.armR = -1.5; p.armRZ = -0.5; p.armL = -0.3;
        p.lean = 0.18 + pulse * 0.05;
        p.handItem = 'can';
        break;
      case 'harvest':
        p.lean = 0.62 + pulse * 0.12; p.bob -= 0.1;
        p.armL = -2.1 + pulse * 0.5; p.armR = -2.1 - pulse * 0.5;
        break;
      case 'stock':
        p.armL = -2.5 - pulse * 0.4; p.armR = -2.5 + pulse * 0.4;
        p.lean = -0.06;
        break;
      case 'till':
        p.armR = -1.6 + pulse * 0.8; p.armL = -1.1;
        p.lean = 0.05;
        break;
      case 'repair':
        p.armR = -2.4 + Math.abs(pulse) * 1.4; p.armL = -1.2;
        p.lean = 0.3;
        break;
      case 'cheer':
        p.armL = -3.0; p.armR = -3.0;
        p.bob += Math.abs(Math.sin(t * Math.PI * 4)) * 0.22;
        break;
      case 'feed':
        p.lean = 0.5; p.armL = -1.7; p.armR = -1.7 - pulse * 0.4;
        break;
      case 'pay':
        p.armR = -1.4 + pulse * 0.3;
        break;
      default: break;
    }
    return p;
  }

  /** Draws the whole figure. `detail` 0 is the cheap version for far away. */
  draw(renderer, meshes, detail = 1) {
    const look = this.look;
    const s = this.scale;
    const p = this.pose();
    const root = this.matrixRoot;
    compose(root, this.x, this.y + p.bob * s, this.z, 0, this.yaw, 0, s, s, s);

    const part = (mesh, lx, ly, lz, rx, ry, rz, sx, sy, sz, colorHex) => {
      compose(this.matrixPart, lx, ly, lz, rx, ry, rz, sx ?? 1, sy ?? 1, sz ?? 1);
      multiply(this.matrixOut, root, this.matrixPart);
      renderer.drawMatrix(mesh, this.matrixOut, colorHex ? rgb(colorHex) : WHITE, 1, 0);
    };

    // Shadow first, flat on the floor.
    renderer.draw(meshes.shadow, { x: this.x, y: 0.02, z: this.z, s: s * (0.9 + this.moving * 0.1) }, [0.25, 0.3, 0.32], 0.28);

    part(meshes.hips, 0, 0.82, 0, 0, 0, 0, 1, 1, 1, look.pants);
    part(meshes.torso, 0, 1.24, 0, p.lean * 0.5, 0, 0, 1, 1, 1, look.shirt);
    if (detail > 0 && look.accessory === 'apron') part(meshes.apron, 0, 1.24, 0, p.lean * 0.5, 0, 0, 1, 1, 1, '#f2ede2');
    if (detail > 0 && look.accessory === 'backpack') part(meshes.backpack, 0, 1.26, 0, p.lean * 0.5, 0, 0, 1, 1, 1, '#5a4a3a');

    part(meshes.arm, -0.36, 1.5, 0, p.armL, 0, p.armLZ, 1, 1, 1, look.skin);
    part(meshes.arm, 0.36, 1.5, 0, p.armR, 0, p.armRZ, 1, 1, 1, look.skin);
    part(meshes.leg, -0.15, 0.76, 0, p.legL, 0, 0, 1, 1, 1, look.pants);
    part(meshes.leg, 0.15, 0.76, 0, p.legR, 0, 0, 1, 1, 1, look.pants);
    if (detail > 0) {
      part(meshes.shoe, -0.15 - Math.sin(p.legL) * 0.02, 0.14 + Math.max(0, Math.sin(p.legL)) * 0.12, Math.sin(p.legL) * 0.55, 0, 0, 0, 1, 1, 1, look.shoes);
      part(meshes.shoe, 0.15 - Math.sin(p.legR) * 0.02, 0.14 + Math.max(0, Math.sin(p.legR)) * 0.12, Math.sin(p.legR) * 0.55, 0, 0, 0, 1, 1, 1, look.shoes);
    }

    const headY = 1.78 + p.lean * -0.06;
    const headTilt = p.lean * 0.6;
    part(meshes.head, 0, headY, p.lean * 0.14, headTilt, 0, 0, 1, 1, 1, look.skin);
    if (detail > 0) {
      part(meshes.face, 0, headY, p.lean * 0.14, headTilt, 0, 0, 1, 1, 1, '#ffffff');
      const hairMesh = meshes[HAIR_MESH[look.hairStyle] || 'hairShort'];
      part(hairMesh, 0, headY, p.lean * 0.14, headTilt, 0, 0, 1, 1, 1, look.hair);
      if (look.accessory === 'cap') part(meshes.cap, 0, headY + 0.02, p.lean * 0.14, headTilt, 0, 0, 1, 1, 1, look.shirt);
      if (look.accessory === 'glasses') part(meshes.glasses, 0, headY, p.lean * 0.14, headTilt, 0, 0, 1, 1, 1, '#2a2f38');
      if (look.accessory === 'headband') part(meshes.headband, 0, headY, p.lean * 0.14, headTilt, 0, 0, 1, 1, 1, '#e05a3a');
    }

    // Whatever they are holding.
    if (p.handItem === 'can') {
      part(meshes.can, 0.44, 1.12, 0.34, 0.4, 0, 0, 1, 1, 1, '#4fa4d8');
    }
    if (this.carry && this.carry.count > 0) {
      const mesh = this.carryStyle === 'basket' ? meshes.basket : meshes.crate;
      const stack = Math.min(3, Math.ceil(this.carry.count / 6));
      for (let i = 0; i < stack; i += 1) {
        part(mesh, 0, 1.14 + i * 0.28, 0.44, 0, 0, 0, 1, 1, 1, this.carry.color || '#c8a06a');
      }
    }
  }
}

/** Random shopper looks, so the crowd never looks copy-pasted. */
export function randomLook(palette) {
  const skins = ['#f3d0b0', '#e8b98d', '#c98d5f', '#9c6438', '#6d4326', '#4a2d1a'];
  const hairs = ['#2b2018', '#5a3a20', '#a5642a', '#d8b45c', '#8f4a3a', '#3f5f8f', '#c04a7a', '#e8e8e8'];
  const styles = ['short', 'bun', 'curls', 'ponytail', 'braids'];
  const shirts = palette || ['#e05a3a', '#4f8fd0', '#6f9f4a', '#d0a83a', '#7f5fd0', '#d0688f', '#3f4a5c', '#2f7d6a'];
  const pants = ['#3f4a5c', '#5c4a3f', '#2f3542', '#6f6f7a', '#4a5c3f'];
  const p = (list) => list[Math.floor(Math.random() * list.length)];
  return {
    skin: p(skins), hair: p(hairs), hairStyle: p(styles),
    shirt: p(shirts), pants: p(pants), shoes: p(['#3a3a3a', '#f2f2f2', '#c04a2a', '#2f5f8f']),
    accessory: Math.random() < 0.22 ? p(['cap', 'glasses', 'backpack']) : 'none'
  };
}

export { clamp, lerp };
