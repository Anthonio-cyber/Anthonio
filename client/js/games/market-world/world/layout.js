// ==========================================================
// Market World - where everything physically sits.
//
// One function works out the plan of the whole property from the
// expansion stage. The 3D builder, the player, the shoppers and the
// staff all read the same plan, so the world and the simulation can
// never disagree about where a shelf is.
// ==========================================================
import { expansionFor } from '../data/locations.js';

export function buildLayout(stage) {
  const exp = expansionFor(stage);
  const w = exp.width;
  const d = exp.depth;
  const halfW = w / 2;
  const halfD = d / 2;

  const layout = {
    stage,
    exp,
    store: { w, d, halfW, halfD, wallH: 3.4 },
    door: { x: 0, z: halfD, width: Math.min(4.2, w * 0.3) },
    shelves: [],
    checkouts: [],
    machines: [],
    plots: [],
    pens: [],
    parking: [],
    trees: [],
    storage: { x: -halfW + 2.2, z: -halfD + 2.2, w: 4, d: 3.4 },
    well: { x: -halfW - 6.5, z: 2.5 },
    roadZ: halfD + 13,
    dock: { x: halfW + 3.5, z: -halfD + 3 }
  };

  // ---- Checkouts: a row just inside the front doors ----------------
  const tillSpan = Math.min(w - 4, exp.checkouts * 3.2);
  for (let i = 0; i < exp.checkouts; i += 1) {
    const t = exp.checkouts === 1 ? 0.5 : i / (exp.checkouts - 1);
    const x = -tillSpan / 2 + t * tillSpan;
    layout.checkouts.push({
      index: i,
      x,
      z: halfD - 3.2,
      ry: 0,
      // Where the shopper stands to pay, and where the queue lines up behind.
      pay: { x, z: halfD - 4.6 },
      queueDir: { x: 0, z: 1 }
    });
  }

  // ---- Shelves: aisles filling the back of the shop ----------------
  const aisleTop = -halfD + 2.4;
  const aisleBottom = halfD - 6.4;
  const rows = Math.max(1, Math.round((aisleBottom - aisleTop) / 3.6));
  const perRow = Math.ceil(exp.shelves / rows);
  let placed = 0;
  for (let r = 0; r < rows && placed < exp.shelves; r += 1) {
    const z = aisleTop + (rows === 1 ? (aisleBottom - aisleTop) / 2 : (r / (rows - 1)) * (aisleBottom - aisleTop));
    const count = Math.min(perRow, exp.shelves - placed);
    const span = Math.min(w - 4.5, count * 3.4);
    for (let c = 0; c < count; c += 1) {
      const t = count === 1 ? 0.5 : c / (count - 1);
      const x = -span / 2 + t * span;
      layout.shelves.push({
        index: placed,
        x,
        z,
        ry: 0,
        // Shoppers and stockers stand on the near side of the shelf.
        stand: { x, z: z + 1.5 }
      });
      placed += 1;
    }
  }

  // ---- Farm: a field to the west of the shop -----------------------
  const plotCols = Math.min(6, Math.ceil(Math.sqrt(exp.plots)));
  const plotRows = Math.ceil(exp.plots / plotCols);
  const plotSize = 2.4;
  const fieldW = plotCols * plotSize;
  const fieldD = plotRows * plotSize;
  const fieldX = -halfW - 6.5 - fieldW / 2;
  const fieldZ = -fieldD / 2 + 2;
  layout.field = { x: fieldX, z: fieldZ + fieldD / 2 - plotSize / 2, w: fieldW + 1.2, d: fieldD + 1.2, cols: plotCols, rows: plotRows };
  for (let i = 0; i < exp.plots; i += 1) {
    const c = i % plotCols;
    const r = Math.floor(i / plotCols);
    layout.plots.push({
      index: i,
      x: fieldX - fieldW / 2 + plotSize / 2 + c * plotSize,
      z: fieldZ + r * plotSize,
      size: plotSize
    });
  }

  // ---- Animal pens: north of the field -----------------------------
  const penCols = Math.min(3, Math.max(1, exp.pens));
  for (let i = 0; i < exp.pens; i += 1) {
    const c = i % penCols;
    const r = Math.floor(i / penCols);
    layout.pens.push({
      index: i,
      x: fieldX - fieldW / 2 + 2.2 + c * 5.2,
      z: fieldZ - fieldD / 2 - 7.5 - r * 5.2,
      size: 4.4
    });
  }

  // ---- Processing yard: behind the shop ----------------------------
  for (let i = 0; i < exp.machineSlots; i += 1) {
    const c = i % 3;
    const r = Math.floor(i / 3);
    layout.machines.push({
      index: i,
      x: -halfW + 3 + c * 4.6,
      z: -halfD - 5 - r * 5,
      ry: Math.PI,
      stand: { x: -halfW + 3 + c * 4.6, z: -halfD - 3.2 - r * 5 }
    });
  }

  // ---- Car park and street trees -----------------------------------
  for (let i = 0; i < exp.parking; i += 1) {
    const c = i % 4;
    const r = Math.floor(i / 4);
    layout.parking.push({ x: -6 + c * 4, z: halfD + 5 + r * 5.5 });
  }
  // Trees go in the spare ground around the property, never on the field,
  // the yard or the car park.
  const treeCount = 8 + stage * 2;
  const fieldEdge = fieldX - fieldW / 2;
  for (let i = 0; i < treeCount; i += 1) {
    const r1 = ((i * 37) % 11) / 10;
    const r2 = ((i * 53) % 13) / 12;
    let x; let z;
    if (i % 3 === 0) {                       // east of the shop
      x = halfW + 8 + r1 * 9;
      z = -halfD - 8 + r2 * (d + 18);
    } else if (i % 3 === 1) {                // the far side of the field
      x = fieldEdge - 5 - r1 * 7;
      z = -halfD - 10 + r2 * (d + 20);
    } else {                                 // behind the yard
      x = -6 + r1 * (halfW + 14);
      z = -halfD - 13 - r2 * 8;
    }
    layout.trees.push({ x, z, scale: 0.8 + ((i * 13) % 7) / 10 });
  }

  // Customers arrive from either end of the road and leave the same way.
  layout.spawnPoints = [
    { x: -halfW - 16, z: layout.roadZ },
    { x: halfW + 16, z: layout.roadZ }
  ];
  layout.entrance = { x: 0, z: halfD + 1.6 };
  layout.insideDoor = { x: 0, z: halfD - 1.4 };
  return layout;
}

/**
 * Keeps a walker on sensible ground: outside the walls, or inside them,
 * but never through them. The doorway is the one gap in the front wall,
 * and anybody lined up with it may walk straight in or out.
 */
export function collide(layout, from, to, radius = 0.45) {
  const s = layout.store;
  const out = { x: to.x, z: to.z };
  const doorHalf = Math.max(0.4, layout.door.width / 2 - radius);

  // The doorway corridor: free movement in and out, as long as they are
  // lined up with the doors and close enough to the front wall.
  if (Math.abs(out.x) <= doorHalf && Math.abs(out.z - s.halfD) < 2.2) {
    return out;
  }

  const wasInside = from.x > -s.halfW && from.x < s.halfW && from.z > -s.halfD && from.z < s.halfD;
  if (wasInside) {
    out.x = Math.max(-s.halfW + radius, Math.min(s.halfW - radius, out.x));
    out.z = Math.max(-s.halfD + radius, Math.min(s.halfD - radius, out.z));
    return out;
  }

  // Outside: push back out of the walls by the shortest route.
  const ex = s.halfW + radius;
  const ez = s.halfD + radius;
  if (out.x > -ex && out.x < ex && out.z > -ez && out.z < ez) {
    const right = ex - out.x;
    const left = out.x + ex;
    const back = out.z + ez;
    const front = ez - out.z;
    const smallest = Math.min(right, left, back, front);
    if (smallest === front) out.z = ez;
    else if (smallest === back) out.z = -ez;
    else if (smallest === right) out.x = ex;
    else out.x = -ex;
  }
  return out;
}

/** True when a straight walk from a to b would cut through the building. */
function crossesStore(a, b, ex, ez) {
  let t0 = 0; let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, a.x + ex) && clip(dx, ex - a.x)
    && clip(-dz, a.z + ez) && clip(dz, ez - a.z);
}

/** Walks round the outside of the building instead of straight at it. */
function aroundStore(layout, from, to) {
  const margin = 1.5;
  const ex = layout.store.halfW + margin;
  const ez = layout.store.halfD + margin;
  if (!crossesStore(from, to, ex, ez)) return [to];
  const corners = [
    { x: ex, z: ez }, { x: -ex, z: ez }, { x: -ex, z: -ez }, { x: ex, z: -ez }
  ];
  const nearestTo = (p) => {
    let best = 0; let bestD = Infinity;
    corners.forEach((c, i) => {
      const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };
  const finish = nearestTo(to);
  let bestPath = null;
  let bestLength = Infinity;
  for (let start = 0; start < 4; start += 1) {
    // A hair smaller, so a leg that merely touches a corner still counts as clear.
    if (crossesStore(from, corners[start], ex - 0.25, ez - 0.25)) continue;
    for (const step of [1, -1]) {
      const list = [];
      let i = start;
      for (let guard = 0; guard < 4; guard += 1) {
        list.push(corners[i]);
        if (i === finish) break;
        i = (i + step + 4) % 4;
      }
      let total = 0;
      let prev = from;
      list.forEach((c) => { total += Math.hypot(c.x - prev.x, c.z - prev.z); prev = c; });
      total += Math.hypot(to.x - prev.x, to.z - prev.z);
      if (total < bestLength) { bestLength = total; bestPath = list; }
    }
  }
  if (!bestPath) return [to];
  return [...bestPath, to];
}

/**
 * A walking route from one point to another. Anything that crosses the
 * front wall goes through the doors, and anything outside walks round
 * the building rather than into it.
 */
export function routeTo(layout, from, target) {
  const s = layout.store;
  const inside = (p) => p.x > -s.halfW && p.x < s.halfW && p.z > -s.halfD && p.z < s.halfD;
  const insideFrom = inside(from);
  const insideTo = inside(target);
  const entrance = { x: layout.entrance.x, z: layout.entrance.z };
  const insideDoor = { x: layout.insideDoor.x, z: layout.insideDoor.z };
  if (insideFrom && insideTo) return [target];
  if (!insideFrom && !insideTo) return aroundStore(layout, from, target);
  if (insideTo) return [...aroundStore(layout, from, entrance), insideDoor, target];
  return [insideDoor, entrance, ...aroundStore(layout, entrance, target)];
}
