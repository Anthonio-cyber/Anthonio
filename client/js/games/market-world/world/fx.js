// ==========================================================
// Market World - the little rewards.
//
// Particles, flying coins and pop-up numbers. None of it changes the
// simulation; all of it is what makes harvesting a carrot feel good.
// ==========================================================
import { rgb, rand, clamp } from '../engine/math.js';

const MAX_PARTICLES = 160;
const MAX_LABELS = 22;

export class Effects {
  constructor(meshes, overlay) {
    this.meshes = meshes;
    this.overlay = overlay;
    this.particles = [];
    this.labels = [];
    this.pool = [];
    this.projected = { x: 0, y: 0, visible: false };
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.particles.push({ alive: false, mesh: 'cube', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, scale: 1, spin: 0, rot: 0, color: [1, 1, 1], gravity: -9, fade: true, target: null });
    }
  }

  spawn(opts) {
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      if (p.alive) continue;
      p.alive = true;
      p.mesh = opts.mesh || 'cube';
      p.x = opts.x; p.y = opts.y; p.z = opts.z;
      p.vx = opts.vx ?? rand(-1.4, 1.4);
      p.vy = opts.vy ?? rand(2.4, 4.6);
      p.vz = opts.vz ?? rand(-1.4, 1.4);
      p.life = opts.life ?? 0.9;
      p.max = p.life;
      p.scale = opts.scale ?? 1;
      p.spin = opts.spin ?? rand(-8, 8);
      p.rot = 0;
      p.color = typeof opts.color === 'string' ? rgb(opts.color) : (opts.color || [1, 1, 1]);
      p.gravity = opts.gravity ?? -9;
      p.target = opts.target || null;
      p.emissive = opts.emissive || 0;
      return p;
    }
    return null;
  }

  /** A handful of coloured chips bursting out of something. */
  burst(x, y, z, color, count = 8, opts = {}) {
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x, y, z, color,
        mesh: opts.mesh || 'cube',
        scale: opts.scale ?? rand(0.6, 1.2),
        life: opts.life ?? rand(0.5, 0.9),
        vy: opts.vy ?? rand(2.2, 4.4),
        ...opts
      });
    }
  }

  /** Coins that arc towards the player, the way money should. */
  coins(x, y, z, target, count = 5) {
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x: x + rand(-0.3, 0.3), y: y + rand(0, 0.4), z: z + rand(-0.3, 0.3),
        mesh: 'coin', color: '#f6cd45', scale: rand(0.9, 1.3), life: 0.75,
        vy: rand(3, 4.6), gravity: -6, target, emissive: 0.35
      });
    }
  }

  sparkle(x, y, z, color = '#fff3c4', count = 10) {
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x, y, z, mesh: 'star', color, scale: rand(0.5, 1.1), life: rand(0.5, 1),
        vy: rand(1.5, 3.5), gravity: -4, emissive: 0.5
      });
    }
  }

  confetti(x, y, z, count = 40) {
    const colors = ['#e05a3a', '#f6cd45', '#4fa4d8', '#7ec850', '#d0688f', '#ffffff'];
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x: x + rand(-1.5, 1.5), y, z: z + rand(-1.5, 1.5), mesh: 'cube',
        color: colors[i % colors.length], scale: rand(0.5, 1), life: rand(1.4, 2.4),
        vy: rand(4, 8), vx: rand(-3, 3), vz: rand(-3, 3), gravity: -7, spin: rand(-14, 14)
      });
    }
  }

  splash(x, y, z, count = 12) {
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x, y, z, mesh: 'drop', color: '#7fc8ef', scale: rand(0.7, 1.3),
        life: rand(0.35, 0.7), vy: rand(1.4, 3), gravity: -12
      });
    }
  }

  /** A number or word that floats up from a spot in the world. */
  label(text, x, y, z, kind = 'cash') {
    if (!this.overlay) return;
    if (this.labels.length >= MAX_LABELS) {
      const oldest = this.labels.shift();
      oldest.el.remove();
    }
    let el = this.pool.pop();
    if (!el) {
      el = document.createElement('div');
      el.className = 'mw-float';
    }
    el.textContent = text;
    el.dataset.kind = kind;
    el.style.opacity = '1';
    this.overlay.appendChild(el);
    this.labels.push({ el, x, y, z, life: 1.35, max: 1.35 });
  }

  update(dt, playerPos) {
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      if (p.target) {
        // Homing behaviour, used by coins flying into the player's pocket.
        const t = playerPos || p.target;
        const age = 1 - p.life / p.max;
        const pull = age * age * 24;
        p.vx += (t.x - p.x) * pull * dt;
        p.vy += (t.y + 1.2 - p.y) * pull * dt;
        p.vz += (t.z - p.z) * pull * dt;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;
      if (p.y < 0.05 && !p.target) { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
    }
    for (let i = this.labels.length - 1; i >= 0; i -= 1) {
      const l = this.labels[i];
      l.life -= dt;
      l.y += dt * 1.15;
      if (l.life <= 0) {
        l.el.remove();
        if (this.pool.length < MAX_LABELS) this.pool.push(l.el);
        this.labels.splice(i, 1);
      }
    }
  }

  draw(renderer) {
    renderer.beginTransparent();
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      if (!p.alive) continue;
      const alpha = clamp(p.life / p.max, 0, 1);
      renderer.draw(this.meshes[p.mesh] || this.meshes.cube,
        { x: p.x, y: p.y, z: p.z, ry: p.rot, rz: p.rot * 0.7, s: p.scale },
        p.color, Math.min(1, alpha * 1.6), p.emissive || 0);
    }
    renderer.endTransparent();
  }

  /** Pins the floating labels onto their world positions. */
  layout(renderer) {
    for (let i = 0; i < this.labels.length; i += 1) {
      const l = this.labels[i];
      renderer.project(l.x, l.y, l.z, this.projected);
      if (!this.projected.visible) { l.el.style.opacity = '0'; continue; }
      const t = l.life / l.max;
      l.el.style.transform = `translate(-50%, -50%) translate(${this.projected.x}px, ${this.projected.y}px) scale(${0.85 + (1 - t) * 0.25})`;
      l.el.style.opacity = String(clamp(t * 1.6, 0, 1));
    }
  }

  clearLabels() {
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];
  }
}
