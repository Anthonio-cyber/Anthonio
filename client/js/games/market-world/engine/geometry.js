// ==========================================================
// Market World - procedural geometry.
//
// The whole game is modelled from code: there is not a single
// downloaded model or texture anywhere. Small primitives are merged
// into bigger meshes with per-vertex colour, so a whole shop building
// or a shelf full of produce costs exactly one draw call.
// ==========================================================
import { rgb } from './math.js';

/** A raw primitive: flat arrays that a builder copies and transforms. */
function prim(positions, normals, indices) {
  return { positions, normals, indices };
}

export function boxGeo(w = 1, h = 1, d = 1) {
  const x = w / 2, y = h / 2, z = d / 2;
  const p = []; const n = []; const i = [];
  const faces = [
    [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
    [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
    [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]],
    [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]],
    [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
    [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]]
  ];
  faces.forEach((f, fi) => {
    for (let v = 0; v < 4; v += 1) { p.push(...f[v]); n.push(...f[4]); }
    const b = fi * 4;
    i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return prim(p, n, i);
}

/**
 * A box with its edges cut off. Everything in the game uses this instead
 * of a hard box: soft edges are what make the art style read as friendly.
 */
export function roundBoxGeo(w = 1, h = 1, d = 1, bevel = 0.08) {
  const b = Math.min(bevel, w / 2.5, h / 2.5, d / 2.5);
  const x = w / 2, y = h / 2, z = d / 2;
  const p = []; const n = []; const idx = [];
  const quad = (a, bb, c, dd, nor) => {
    const base = p.length / 3;
    [a, bb, c, dd].forEach((v) => { p.push(v[0], v[1], v[2]); n.push(nor[0], nor[1], nor[2]); });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const ix = x - b, iy = y - b, iz = z - b;
  // Six flat faces, inset by the bevel.
  quad([-ix, -iy, z], [ix, -iy, z], [ix, iy, z], [-ix, iy, z], [0, 0, 1]);
  quad([ix, -iy, -z], [-ix, -iy, -z], [-ix, iy, -z], [ix, iy, -z], [0, 0, -1]);
  quad([x, -iy, iz], [x, -iy, -iz], [x, iy, -iz], [x, iy, iz], [1, 0, 0]);
  quad([-x, -iy, -iz], [-x, -iy, iz], [-x, iy, iz], [-x, iy, -iz], [-1, 0, 0]);
  quad([-ix, y, iz], [ix, y, iz], [ix, y, -iz], [-ix, y, -iz], [0, 1, 0]);
  quad([-ix, -y, -iz], [ix, -y, -iz], [ix, -y, iz], [-ix, -y, iz], [0, -1, 0]);
  // Twelve bevel strips, one per edge, with an averaged normal.
  const s = 0.7071;
  quad([-ix, -y, iz], [ix, -y, iz], [ix, -iy, z], [-ix, -iy, z], [0, -s, s]);
  quad([-ix, iy, z], [ix, iy, z], [ix, y, iz], [-ix, y, iz], [0, s, s]);
  quad([-ix, -iy, -z], [ix, -iy, -z], [ix, -y, -iz], [-ix, -y, -iz], [0, -s, -s]);
  quad([-ix, y, -iz], [ix, y, -iz], [ix, iy, -z], [-ix, iy, -z], [0, s, -s]);
  quad([x, -iy, iz], [ix, -iy, z], [ix, iy, z], [x, iy, iz], [s, 0, s]);
  quad([-ix, -iy, z], [-x, -iy, iz], [-x, iy, iz], [-ix, iy, z], [-s, 0, s]);
  quad([ix, -iy, -z], [x, -iy, -iz], [x, iy, -iz], [ix, iy, -z], [s, 0, -s]);
  quad([-x, -iy, -iz], [-ix, -iy, -z], [-ix, iy, -z], [-x, iy, -iz], [-s, 0, -s]);
  quad([x, iy, iz], [ix, y, iz], [ix, y, -iz], [x, iy, -iz], [s, s, 0]);
  quad([-ix, y, iz], [-x, iy, iz], [-x, iy, -iz], [-ix, y, -iz], [-s, s, 0]);
  quad([ix, -y, iz], [x, -iy, iz], [x, -iy, -iz], [ix, -y, -iz], [s, -s, 0]);
  quad([-x, -iy, iz], [-ix, -y, iz], [-ix, -y, -iz], [-x, -iy, -iz], [-s, -s, 0]);
  // Corner patches, kept as simple triangles.
  const corners = [
    [[ix, y, iz], [x, iy, iz], [ix, iy, z], [s, s, s]],
    [[-ix, y, iz], [-ix, iy, z], [-x, iy, iz], [-s, s, s]],
    [[ix, y, -iz], [ix, iy, -z], [x, iy, -iz], [s, s, -s]],
    [[-ix, y, -iz], [-x, iy, -iz], [-ix, iy, -z], [-s, s, -s]],
    [[ix, -y, iz], [ix, -iy, z], [x, -iy, iz], [s, -s, s]],
    [[-ix, -y, iz], [-x, -iy, iz], [-ix, -iy, z], [-s, -s, s]],
    [[ix, -y, -iz], [x, -iy, -iz], [ix, -iy, -z], [s, -s, -s]],
    [[-ix, -y, -iz], [-ix, -iy, -z], [-x, -iy, -iz], [-s, -s, -s]]
  ];
  corners.forEach((c) => {
    const base = p.length / 3;
    for (let v = 0; v < 3; v += 1) { p.push(...c[v]); n.push(...c[3]); }
    idx.push(base, base + 1, base + 2);
  });
  return prim(p, n, idx);
}

export function cylinderGeo(radius = 0.5, height = 1, segments = 12, topRadius = null) {
  const rt = topRadius === null ? radius : topRadius;
  const p = []; const n = []; const idx = [];
  const y = height / 2;
  for (let s = 0; s < segments; s += 1) {
    const a0 = (s / segments) * Math.PI * 2;
    const a1 = ((s + 1) / segments) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const base = p.length / 3;
    p.push(c0 * radius, -y, s0 * radius, c1 * radius, -y, s1 * radius, c1 * rt, y, s1 * rt, c0 * rt, y, s0 * rt);
    const slope = (radius - rt) / height;
    for (const [cc, ss] of [[c0, s0], [c1, s1], [c1, s1], [c0, s0]]) n.push(cc, slope, ss);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  for (const [yy, r, ny] of [[y, rt, 1], [-y, radius, -1]]) {
    const centre = p.length / 3;
    p.push(0, yy, 0); n.push(0, ny, 0);
    for (let s = 0; s <= segments; s += 1) {
      const a = (s / segments) * Math.PI * 2;
      p.push(Math.cos(a) * r, yy, Math.sin(a) * r); n.push(0, ny, 0);
    }
    for (let s = 0; s < segments; s += 1) {
      if (ny > 0) idx.push(centre, centre + 1 + s, centre + 2 + s);
      else idx.push(centre, centre + 2 + s, centre + 1 + s);
    }
  }
  return prim(p, n, idx);
}

export function coneGeo(radius = 0.5, height = 1, segments = 12) {
  return cylinderGeo(radius, height, segments, 0.001);
}

export function sphereGeo(radius = 0.5, rings = 8, segments = 12) {
  const p = []; const n = []; const idx = [];
  for (let r = 0; r <= rings; r += 1) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s <= segments; s += 1) {
      const theta = (s / segments) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      p.push(nx * radius, ny * radius, nz * radius); n.push(nx, ny, nz);
    }
  }
  for (let r = 0; r < rings; r += 1) {
    for (let s = 0; s < segments; s += 1) {
      const a = r * (segments + 1) + s;
      const b = a + segments + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return prim(p, n, idx);
}

/** A flat horizontal disc, used for the soft shadow under everything alive. */
export function discGeo(radius = 0.5, segments = 16) {
  const p = [0, 0, 0]; const n = [0, 1, 0]; const idx = [];
  for (let s = 0; s <= segments; s += 1) {
    const a = (s / segments) * Math.PI * 2;
    p.push(Math.cos(a) * radius, 0, Math.sin(a) * radius); n.push(0, 1, 0);
  }
  for (let s = 0; s < segments; s += 1) idx.push(0, s + 1, s + 2);
  return prim(p, n, idx);
}

export function planeGeo(w = 1, d = 1) {
  const x = w / 2, z = d / 2;
  return prim([-x, 0, z, x, 0, z, x, 0, -z, -x, 0, -z], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3]);
}

/**
 * Collects transformed primitives into one interleaved buffer.
 * Vertex layout: position(3) normal(3) colour(3).
 */
export class MeshBuilder {
  constructor() {
    this.verts = [];
    this.indices = [];
    this.count = 0;
  }

  /** opts: { x, y, z, rx, ry, rz, sx, sy, sz, color } */
  add(geo, opts = {}) {
    const {
      x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0,
      sx = 1, sy = 1, sz = 1, color = '#ffffff'
    } = opts;
    const c = rgb(color);
    const cx = Math.cos(rx), sxr = Math.sin(rx);
    const cy = Math.cos(ry), syr = Math.sin(ry);
    const cz = Math.cos(rz), szr = Math.sin(rz);
    const m00 = cy * cz + syr * sxr * szr, m01 = cx * szr, m02 = -syr * cz + cy * sxr * szr;
    const m10 = -cy * szr + syr * sxr * cz, m11 = cx * cz, m12 = syr * szr + cy * sxr * cz;
    const m20 = syr * cx, m21 = -sxr, m22 = cy * cx;
    const base = this.count;
    const pos = geo.positions; const nor = geo.normals;
    for (let v = 0; v < pos.length; v += 3) {
      const px = pos[v] * sx, py = pos[v + 1] * sy, pz = pos[v + 2] * sz;
      this.verts.push(
        m00 * px + m10 * py + m20 * pz + x,
        m01 * px + m11 * py + m21 * pz + y,
        m02 * px + m12 * py + m22 * pz + z
      );
      const nx = nor[v], ny = nor[v + 1], nz = nor[v + 2];
      const tx = m00 * nx + m10 * ny + m20 * nz;
      const ty = m01 * nx + m11 * ny + m21 * nz;
      const tz = m02 * nx + m12 * ny + m22 * nz;
      const len = Math.hypot(tx, ty, tz) || 1;
      this.verts.push(tx / len, ty / len, tz / len, c[0], c[1], c[2]);
      this.count += 1;
    }
    for (let i = 0; i < geo.indices.length; i += 1) this.indices.push(geo.indices[i] + base);
    return this;
  }

  /** Convenience wrappers so world building code stays readable. */
  box(o) { return this.add(roundBoxGeo(o.w, o.h, o.d, o.bevel ?? 0.06), o); }
  hardBox(o) { return this.add(boxGeo(o.w, o.h, o.d), o); }
  cyl(o) { return this.add(cylinderGeo(o.r, o.h, o.seg ?? 12, o.rTop ?? null), o); }
  cone(o) { return this.add(coneGeo(o.r, o.h, o.seg ?? 10), o); }
  ball(o) { return this.add(sphereGeo(o.r, o.rings ?? 8, o.seg ?? 12), o); }
  slab(o) { return this.add(planeGeo(o.w, o.d), o); }

  isEmpty() { return this.count === 0; }

  data() {
    return {
      verts: new Float32Array(this.verts),
      indices: this.count > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices)
    };
  }
}
