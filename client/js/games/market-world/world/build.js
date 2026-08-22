// ==========================================================
// Market World - building the place.
//
// Turns the layout plan plus the save game into a handful of merged
// meshes. It is called again whenever the world genuinely changes - a
// new shelf, a new machine, an expansion - and that rebuild is what
// makes an upgrade show up as an actual building rather than a number.
// ==========================================================
import { MeshBuilder } from '../engine/geometry.js';
import { Mesh } from '../engine/renderer.js';
import { mixHex } from '../engine/math.js';
import { MACHINES, ANIMALS, departmentOf, item } from '../data/catalog.js';

function fence(b, x, z, size, color, postColor) {
  const half = size / 2;
  const posts = 5;
  for (let i = 0; i < posts; i += 1) {
    const t = i / (posts - 1);
    for (const [px, pz] of [[x - half + t * size, z - half], [x - half + t * size, z + half],
      [x - half, z - half + t * size], [x + half, z - half + t * size]]) {
      b.box({ x: px, y: 0.45, z: pz, w: 0.14, h: 0.9, d: 0.14, color: postColor });
    }
  }
  for (const rail of [0.35, 0.7]) {
    b.box({ x, y: rail, z: z - half, w: size, h: 0.09, d: 0.09, color });
    b.box({ x, y: rail, z: z + half, w: size, h: 0.09, d: 0.09, color });
    b.box({ x: x - half, y: rail, z, w: 0.09, h: 0.09, d: size, color });
    b.box({ x: x + half, y: rail, z, w: 0.09, h: 0.09, d: size, color });
  }
}

function tree(b, x, z, scale, palette) {
  const h = 1.6 * scale;
  b.cyl({ x, y: h / 2, z, r: 0.16 * scale, h, seg: 7, color: palette.trunk });
  b.ball({ x, y: h + 0.5 * scale, z, r: 0.85 * scale, rings: 6, seg: 9, color: palette.tree });
  b.ball({ x: x + 0.5 * scale, y: h + 0.15 * scale, z: z + 0.2 * scale, r: 0.55 * scale, rings: 5, seg: 8, color: mixHex(palette.tree, '#ffffff', 0.1) });
  b.ball({ x: x - 0.4 * scale, y: h + 0.3 * scale, z: z - 0.3 * scale, r: 0.5 * scale, rings: 5, seg: 8, color: mixHex(palette.tree, '#000000', 0.1) });
}

function lamp(b, x, z, palette) {
  b.cyl({ x, y: 1.7, z, r: 0.09, h: 3.4, seg: 7, color: '#5d646e' });
  b.box({ x, y: 3.5, z, w: 0.5, h: 0.2, d: 0.5, color: palette.trim });
  b.ball({ x, y: 3.35, z, r: 0.18, rings: 5, seg: 8, color: '#fff3c4' });
}

/** The shop itself: floor, walls, roof, doors, sign and awning. */
function addBuilding(b, roofB, layout, palette, state, loc) {
  const s = layout.store;
  const wallH = s.wallH;
  const wall = palette.building;
  const trim = palette.trim;
  const inner = mixHex(wall, '#ffffff', 0.35);

  // Floor and a strip of pavement all the way round.
  b.box({ x: 0, y: -0.06, z: 0, w: s.w + 2.4, h: 0.12, d: s.d + 2.4, bevel: 0.05, color: '#c9c6bd' });
  b.box({ x: 0, y: 0.03, z: 0, w: s.w, h: 0.12, d: s.d, bevel: 0.02, color: '#efe9dd' });
  // Aisle markings so the interior does not read as one flat slab.
  for (let i = -2; i <= 2; i += 1) {
    b.box({ x: i * (s.w / 5), y: 0.09, z: 0, w: 0.12, h: 0.02, d: s.d - 1.2, color: '#e2dbcc' });
  }

  const t = 0.3;
  // Back and side walls.
  b.box({ x: 0, y: wallH / 2, z: -s.halfD, w: s.w, h: wallH, d: t, color: wall });
  b.box({ x: -s.halfW, y: wallH / 2, z: 0, w: t, h: wallH, d: s.d, color: wall });
  b.box({ x: s.halfW, y: wallH / 2, z: 0, w: t, h: wallH, d: s.d, color: wall });
  // Front wall, with a gap for the doors.
  const gap = layout.door.width;
  const sideW = (s.w - gap) / 2;
  b.box({ x: -(gap / 2 + sideW / 2), y: wallH / 2, z: s.halfD, w: sideW, h: wallH, d: t, color: wall });
  b.box({ x: (gap / 2 + sideW / 2), y: wallH / 2, z: s.halfD, w: sideW, h: wallH, d: t, color: wall });
  b.box({ x: 0, y: wallH - 0.3, z: s.halfD, w: gap, h: 0.6, d: t, color: wall });
  // Shop windows either side of the door.
  const winW = Math.min(3.2, sideW * 0.7);
  for (const side of [-1, 1]) {
    b.box({ x: side * (gap / 2 + sideW / 2), y: 1.75, z: s.halfD + 0.02, w: winW, h: 1.5, d: 0.12, color: '#bcdcf0' });
    b.box({ x: side * (gap / 2 + sideW / 2), y: 1.0, z: s.halfD + 0.04, w: winW, h: 0.12, d: 0.1, color: trim });
  }
  // Sliding doors, left open during trading hours.
  for (const side of [-1, 1]) {
    b.box({ x: side * (gap / 2 - 0.35), y: 1.3, z: s.halfD, w: 0.7, h: 2.6, d: 0.12, color: '#cfe6f2' });
  }

  // Roof slab with a coloured parapet. It lives in its own mesh so the
  // game can lift it off while the player is inside the shop.
  roofB.box({ x: 0, y: wallH + 0.18, z: 0, w: s.w + 0.9, h: 0.36, d: s.d + 0.9, bevel: 0.12, color: palette.roof });
  roofB.box({ x: 0, y: wallH + 0.5, z: -s.halfD - 0.2, w: s.w + 0.9, h: 0.35, d: 0.25, color: mixHex(palette.roof, '#000000', 0.15) });
  for (let v = -1; v <= 1; v += 1) {
    roofB.box({ x: v * (s.w / 3.2), y: wallH + 0.6, z: -s.halfD + 2.2, w: 1.1, h: 0.6, d: 1.1, bevel: 0.1, color: '#b9c0c8' });
  }

  // Shop sign over the doors, with the brand mark beside it.
  const signW = Math.min(s.w * 0.62, 9);
  b.box({ x: 0, y: wallH + 0.95, z: s.halfD - 0.1, w: signW, h: 1.1, d: 0.35, bevel: 0.14, color: trim });
  b.box({ x: 0, y: wallH + 0.95, z: s.halfD + 0.1, w: signW - 0.5, h: 0.7, d: 0.12, color: '#ffffff' });
  b.ball({ x: -signW / 2 + 0.7, y: wallH + 0.95, z: s.halfD + 0.2, r: 0.28, rings: 6, seg: 9, color: '#7ec850' });
  b.cone({ x: -signW / 2 + 0.7, y: wallH + 1.35, z: s.halfD + 0.2, r: 0.14, h: 0.3, color: '#4f9c3f' });

  // Striped awning above the windows.
  const stripes = Math.max(4, Math.round(s.w / 1.2));
  for (let i = 0; i < stripes; i += 1) {
    const x = -s.w / 2 + (i + 0.5) * (s.w / stripes);
    b.box({
      x, y: 2.85, z: s.halfD + 0.75, w: s.w / stripes - 0.04, h: 0.14, d: 1.6,
      rx: -0.22, color: i % 2 ? '#ffffff' : trim
    });
  }

  // The store room in the back corner, and its roller door.
  const st = layout.storage;
  b.box({ x: st.x, y: 1.1, z: st.z, w: st.w, h: 2.2, d: st.d, bevel: 0.08, color: mixHex(wall, '#000000', 0.12) });
  b.box({ x: st.x, y: 1.0, z: st.z + st.d / 2 + 0.02, w: st.w - 0.7, h: 1.8, d: 0.1, color: '#9aa4b2' });
  b.box({ x: st.x, y: 2.3, z: st.z, w: st.w + 0.3, h: 0.2, d: st.d + 0.3, color: trim });
  // Pallets of stock stacked against it.
  for (let i = 0; i < 3; i += 1) {
    b.box({ x: st.x - 1.2 + i * 1.2, y: 0.28, z: st.z + st.d / 2 + 0.9, w: 0.9, h: 0.5, d: 0.8, color: mixHex('#c8a06a', inner, 0.2) });
  }

  // Delivery dock on the side, once there is a vehicle to use it.
  if (state.vehicles && state.vehicles.length) {
    b.box({ x: layout.dock.x, y: 0.5, z: layout.dock.z, w: 3.2, h: 1, d: 4, bevel: 0.1, color: '#b9b2a4' });
    b.box({ x: layout.dock.x, y: 1.6, z: layout.dock.z - 2.2, w: 3.4, h: 1.2, d: 0.3, color: trim });
  }
  void loc;
}

function addShelf(b, shelf, data, palette) {
  const dept = data && data.item ? departmentOf(data.item) : null;
  const trim = dept ? dept.color : palette.trim;
  const x = shelf.x; const z = shelf.z;
  b.box({ x, y: 0.12, z, w: 2.6, h: 0.24, d: 1.1, bevel: 0.05, color: '#8d8577' });
  b.box({ x, y: 0.9, z: z - 0.42, w: 2.6, h: 1.8, d: 0.14, color: '#e6e2d8' });
  for (const tier of [0.55, 1.05, 1.55]) {
    b.box({ x, y: tier, z, w: 2.5, h: 0.09, d: 1.0, bevel: 0.03, color: '#f2efe6' });
  }
  b.box({ x: x - 1.28, y: 0.95, z, w: 0.12, h: 1.9, d: 1.06, color: '#cfc9bb' });
  b.box({ x: x + 1.28, y: 0.95, z, w: 0.12, h: 1.9, d: 1.06, color: '#cfc9bb' });
  // Category board on top, coloured for the department it belongs to.
  b.box({ x, y: 2.05, z, w: 2.4, h: 0.3, d: 0.12, bevel: 0.05, color: trim });
}

function addCheckout(b, till, palette, open) {
  const x = till.x; const z = till.z;
  b.box({ x, y: 0.5, z, w: 2.2, h: 1, d: 0.9, bevel: 0.08, color: palette.trim });
  b.box({ x, y: 1.03, z, w: 2.3, h: 0.12, d: 1.0, bevel: 0.04, color: '#efe9dd' });
  b.box({ x: x + 0.7, y: 1.28, z: z - 0.1, w: 0.5, h: 0.4, d: 0.34, bevel: 0.06, color: '#3f4a5c' });
  b.box({ x: x + 0.7, y: 1.3, z: z + 0.08, w: 0.4, h: 0.28, d: 0.06, color: open ? '#8ff0a4' : '#5c6470' });
  b.box({ x: x - 0.6, y: 1.1, z, w: 0.9, h: 0.05, d: 0.7, color: '#d6d0c2' });
  // Lit number board so an open till is obvious from across the shop.
  b.cyl({ x, y: 2.1, z, r: 0.05, h: 1.6, seg: 6, color: '#9aa4b2' });
  b.box({ x, y: 2.55, z, w: 0.5, h: 0.5, d: 0.1, bevel: 0.06, color: open ? '#4fd07a' : '#c04a4a' });
}

function addMachine(b, slot, machineType, palette) {
  const def = MACHINES[machineType];
  const color = def ? def.color : '#9aa4b2';
  const x = slot.x; const z = slot.z;
  b.box({ x, y: 0.2, z, w: 3.4, h: 0.4, d: 3.4, bevel: 0.08, color: '#a8a196' });
  b.box({ x, y: 1.2, z, w: 2.4, h: 1.6, d: 2, bevel: 0.14, color });
  b.box({ x, y: 2.2, z: z - 0.2, w: 1.2, h: 0.6, d: 1.2, bevel: 0.1, color: mixHex(color, '#ffffff', 0.25) });
  b.cyl({ x: x + 0.9, y: 2.5, z: z - 0.4, r: 0.22, h: 1.2, seg: 8, color: '#8d8577' });
  b.box({ x, y: 1.35, z: z + 1.02, w: 0.9, h: 0.6, d: 0.1, color: '#2f3542' });
  b.ball({ x: x - 0.6, y: 1.55, z: z + 1.05, r: 0.09, rings: 5, seg: 7, color: '#8ff0a4' });
  // Output tray, where finished goods pile up waiting to be collected.
  b.box({ x, y: 0.55, z: z + 1.5, w: 1.6, h: 0.3, d: 0.9, bevel: 0.06, color: mixHex(color, '#000000', 0.2) });
  void palette;
}

function addPen(b, pen, animalType, palette) {
  const size = pen.size;
  b.box({ x: pen.x, y: 0.04, z: pen.z, w: size + 0.4, h: 0.1, d: size + 0.4, color: mixHex(palette.ground, '#c8a06a', 0.4) });
  fence(b, pen.x, pen.z, size, '#b48a5c', '#8a6540');
  if (!animalType) return;
  const def = ANIMALS[animalType];
  // A shelter that matches whatever lives here.
  b.box({ x: pen.x - size / 2 + 0.9, y: 0.6, z: pen.z - size / 2 + 0.9, w: 1.5, h: 1.2, d: 1.4, bevel: 0.1, color: '#e0c9a6' });
  b.box({ x: pen.x - size / 2 + 0.9, y: 1.35, z: pen.z - size / 2 + 0.9, w: 1.8, h: 0.25, d: 1.7, color: def ? def.accent : '#c04a2a' });
  b.box({ x: pen.x + size / 2 - 1, y: 0.22, z: pen.z + size / 2 - 1, w: 1.1, h: 0.35, d: 0.6, bevel: 0.06, color: '#a8845c' });
}

function addField(b, layout, palette) {
  const f = layout.field;
  b.box({ x: f.x, y: 0.02, z: f.z, w: f.w + 1.6, h: 0.1, d: f.d + 1.6, color: mixHex(palette.soil, '#000000', 0.15) });
  layout.plots.forEach((plot) => {
    b.box({ x: plot.x, y: 0.08, z: plot.z, w: plot.size - 0.2, h: 0.16, d: plot.size - 0.2, bevel: 0.04, color: palette.soil });
    b.box({ x: plot.x, y: 0.17, z: plot.z, w: plot.size - 0.5, h: 0.04, d: plot.size - 0.5, color: mixHex(palette.soil, '#000000', 0.2) });
  });
  // The well, which is where watering comes from.
  const w = layout.well;
  b.cyl({ x: w.x, y: 0.45, z: w.z, r: 0.85, h: 0.9, seg: 12, color: '#9aa4b2' });
  b.cyl({ x: w.x, y: 0.92, z: w.z, r: 0.72, h: 0.1, seg: 12, color: '#5fa8d8' });
  b.box({ x: w.x - 0.75, y: 1.5, z: w.z, w: 0.14, h: 1.6, d: 0.14, color: '#7a5836' });
  b.box({ x: w.x + 0.75, y: 1.5, z: w.z, w: 0.14, h: 1.6, d: 0.14, color: '#7a5836' });
  b.box({ x: w.x, y: 2.3, z: w.z, w: 2.1, h: 0.2, d: 1.5, rx: 0, bevel: 0.06, color: palette.roof });
}

function addStreet(b, layout, palette, decorLevel) {
  const roadZ = layout.roadZ;
  const span = Math.max(70, layout.store.w * 3.4);
  b.box({ x: 0, y: 0.01, z: roadZ, w: span, h: 0.06, d: 7, color: palette.road });
  for (let i = -Math.floor(span / 6); i <= Math.floor(span / 6); i += 1) {
    b.box({ x: i * 6, y: 0.05, z: roadZ, w: 2.4, h: 0.03, d: 0.2, color: '#f0eadc' });
  }
  b.box({ x: 0, y: 0.05, z: roadZ - 4.2, w: span, h: 0.12, d: 2.2, color: '#cdc7ba' });
  // Car park bays.
  if (layout.parking.length) {
    const minX = Math.min(...layout.parking.map((p) => p.x)) - 2.2;
    const maxX = Math.max(...layout.parking.map((p) => p.x)) + 2.2;
    const minZ = Math.min(...layout.parking.map((p) => p.z)) - 2.6;
    const maxZ = Math.max(...layout.parking.map((p) => p.z)) + 2.6;
    b.box({ x: (minX + maxX) / 2, y: 0.02, z: (minZ + maxZ) / 2, w: maxX - minX, h: 0.08, d: maxZ - minZ, color: '#8e8b84' });
    layout.parking.forEach((p) => {
      b.box({ x: p.x - 1.9, y: 0.07, z: p.z, w: 0.12, h: 0.03, d: 4.4, color: '#f0eadc' });
      b.box({ x: p.x + 1.9, y: 0.07, z: p.z, w: 0.12, h: 0.03, d: 4.4, color: '#f0eadc' });
    });
  }
  // Street furniture. More of it as the player spends on decoration.
  lamp(b, -layout.store.halfW - 4, roadZ - 5.5, palette);
  lamp(b, layout.store.halfW + 4, roadZ - 5.5, palette);
  if (decorLevel >= 1) {
    for (const side of [-1, 1]) {
      b.box({ x: side * (layout.store.halfW - 1.5), y: 0.35, z: layout.store.halfD + 2.4, w: 1.4, h: 0.7, d: 0.8, bevel: 0.1, color: '#b3785c' });
      b.ball({ x: side * (layout.store.halfW - 1.5), y: 0.85, z: layout.store.halfD + 2.4, r: 0.42, rings: 5, seg: 8, color: '#6fbf5a' });
      b.ball({ x: side * (layout.store.halfW - 1.8), y: 1.05, z: layout.store.halfD + 2.5, r: 0.14, rings: 4, seg: 6, color: '#f06a9a' });
    }
  }
  if (decorLevel >= 2) {
    b.box({ x: -layout.store.halfW - 3, y: 0.5, z: layout.store.halfD + 3.5, w: 2.2, h: 0.16, d: 0.7, color: '#c8a06a' });
    b.box({ x: -layout.store.halfW - 3, y: 0.9, z: layout.store.halfD + 3.15, w: 2.2, h: 0.7, d: 0.12, color: '#c8a06a' });
  }
  if (decorLevel >= 3) {
    for (let i = 0; i < 5; i += 1) {
      b.box({
        x: -6 + i * 3, y: 3.9, z: layout.store.halfD + 1.6, w: 1.4, h: 1.0, d: 0.08,
        color: i % 2 ? palette.trim : '#ffffff'
      });
    }
  }
  if (decorLevel >= 4) {
    b.cyl({ x: layout.store.halfW + 6, y: 0.3, z: layout.store.halfD + 6, r: 1.8, h: 0.6, seg: 14, color: '#b9c6cf' });
    b.cyl({ x: layout.store.halfW + 6, y: 0.62, z: layout.store.halfD + 6, r: 1.5, h: 0.1, seg: 14, color: '#6fc0e8' });
    b.cyl({ x: layout.store.halfW + 6, y: 1.1, z: layout.store.halfD + 6, r: 0.25, h: 1.2, seg: 8, color: '#b9c6cf' });
  }
}

/**
 * Builds the whole property. Returns the meshes plus a dispose(), so a
 * rebuild never leaks buffers on a phone.
 */
export function buildWorld(gl, layout, palette, state, loc) {
  const ground = new MeshBuilder();
  const structure = new MeshBuilder();
  const detail = new MeshBuilder();
  const roof = new MeshBuilder();

  // The ground plane, big enough that the fog swallows the edge.
  ground.hardBox({ x: 0, y: -0.6, z: 4, w: 240, h: 1, d: 240, color: palette.ground });
  ground.hardBox({ x: 0, y: -0.048, z: 0, w: 52 + layout.store.w, h: 0.1, d: 44 + layout.store.d, color: palette.ground2 });
  addField(ground, layout, palette);
  addStreet(ground, layout, palette, state.upgrades.decor || 0);

  addBuilding(structure, roof, layout, palette, state, loc);

  layout.shelves.forEach((shelf, i) => addShelf(detail, shelf, loc.shelves[i], palette));
  layout.checkouts.forEach((till, i) => addCheckout(detail, till, palette, i < loc.checkoutsOpen));
  layout.machines.forEach((slot, i) => {
    const m = loc.machines[i];
    if (m) addMachine(detail, slot, m.type, palette);
    else {
      // An empty concrete pad, so there is somewhere obvious to build.
      detail.box({ x: slot.x, y: 0.06, z: slot.z, w: 3.2, h: 0.12, d: 3.2, color: '#b0aca3' });
      detail.box({ x: slot.x, y: 0.2, z: slot.z, w: 2.4, h: 0.1, d: 2.4, color: mixHex('#b0aca3', '#ffffff', 0.3) });
    }
  });
  layout.pens.forEach((pen, i) => addPen(detail, pen, loc.pens[i] ? loc.pens[i].animal : null, palette));
  layout.trees.forEach((t) => tree(detail, t.x, t.z, t.scale, palette));

  return {
    ground: new Mesh(gl, ground.data()),
    structure: new Mesh(gl, structure.data()),
    detail: new Mesh(gl, detail.data()),
    roof: new Mesh(gl, roof.data()),
    dispose() {
      this.ground.dispose();
      this.structure.dispose();
      this.detail.dispose();
      this.roof.dispose();
    }
  };
}

/** Parked cars and delivery vans, drawn as their own small meshes. */
export function createVehicleMeshes(gl) {
  const car = new MeshBuilder();
  car.box({ y: 0.55, w: 1.9, h: 0.7, d: 4, bevel: 0.22, color: '#ffffff' });
  car.box({ y: 1.15, z: -0.2, w: 1.7, h: 0.62, d: 2, bevel: 0.24, color: '#cfe4f2' });
  for (const [x, z] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
    car.cyl({ x, y: 0.32, z, r: 0.32, h: 0.24, seg: 9, rz: Math.PI / 2, color: '#2f3542' });
  }
  const truck = new MeshBuilder();
  truck.box({ y: 0.9, z: -1.1, w: 2.4, h: 1.8, d: 4.2, bevel: 0.14, color: '#ffffff' });
  truck.box({ y: 0.75, z: 1.9, w: 2.2, h: 1.3, d: 2, bevel: 0.2, color: '#e6ecf2' });
  truck.box({ y: 1.1, z: 2.85, w: 2, h: 0.7, d: 0.14, color: '#bcdcf0' });
  for (const [x, z] of [[-1.15, 2.1], [1.15, 2.1], [-1.15, -1.4], [1.15, -1.4], [-1.15, -2.6], [1.15, -2.6]]) {
    truck.cyl({ x, y: 0.38, z, r: 0.38, h: 0.28, seg: 9, rz: Math.PI / 2, color: '#2f3542' });
  }
  return { car: new Mesh(gl, car.data()), truck: new Mesh(gl, truck.data()) };
}
