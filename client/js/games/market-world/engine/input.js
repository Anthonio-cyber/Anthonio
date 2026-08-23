// ==========================================================
// Market World - input.
//
// One class handles the lot: a thumb stick on the left of the screen,
// a drag anywhere else to swing the camera, pinch to zoom, a tap to
// interact, and the usual WASD / arrow keys on a laptop.
// ==========================================================
import { clamp } from './math.js';

export class Input {
  constructor(surface, camera) {
    this.surface = surface;
    this.camera = camera;
    this.move = { x: 0, y: 0 };          // -1..1 on each axis, already normalised
    this.keys = new Set();
    this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.drag = { id: null, x: 0, y: 0, moved: 0 };
    this.pinch = null;
    this.onTap = null;
    this.onAction = null;
    this.enabled = true;
    this.stickEl = null;
    this.stickKnob = null;
    this.listeners = [];
    this.bind();
  }

  attachStick(zone, knob) {
    this.stickEl = zone;
    this.stickKnob = knob;
  }

  on(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    this.listeners.push([target, type, handler, opts]);
  }

  bind() {
    const s = this.surface;
    this.on(s, 'touchstart', (e) => this.touchStart(e), { passive: false });
    this.on(s, 'touchmove', (e) => this.touchMove(e), { passive: false });
    this.on(s, 'touchend', (e) => this.touchEnd(e), { passive: false });
    this.on(s, 'touchcancel', (e) => this.touchEnd(e), { passive: false });
    this.on(s, 'mousedown', (e) => this.mouseDown(e));
    this.on(window, 'mousemove', (e) => this.mouseMove(e));
    this.on(window, 'mouseup', (e) => this.mouseUp(e));
    this.on(s, 'wheel', (e) => {
      e.preventDefault();
      this.camera.setDistance(this.camera.distance + Math.sign(e.deltaY) * 1.4);
    }, { passive: false });
    this.on(s, 'contextmenu', (e) => e.preventDefault());
    this.on(window, 'keydown', (e) => this.keyDown(e));
    this.on(window, 'keyup', (e) => { this.keys.delete(e.key.toLowerCase()); this.syncKeys(); });
    this.on(window, 'blur', () => { this.keys.clear(); this.syncKeys(); });
  }

  destroy() {
    this.listeners.forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    this.listeners = [];
  }

  keyDown(e) {
    if (!this.enabled) return;
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)
        && e.target === document.body) e.preventDefault();
    if (k === ' ' || k === 'enter' || k === 'e') {
      if (this.onAction) this.onAction();
      return;
    }
    this.keys.add(k);
    this.syncKeys();
  }

  syncKeys() {
    const k = this.keys;
    let x = 0; let y = 0;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    this.keyMove = { x, y };
  }

  inStickZone(clientX, clientY) {
    if (!this.stickEl) return false;
    const r = this.stickEl.getBoundingClientRect();
    const pad = 26;
    return clientX >= r.left - pad && clientX <= r.right + pad
      && clientY >= r.top - pad && clientY <= r.bottom + pad;
  }

  startStick(id, x, y) {
    const r = this.stickEl.getBoundingClientRect();
    this.stick.active = true;
    this.stick.id = id;
    this.stick.ox = r.left + r.width / 2;
    this.stick.oy = r.top + r.height / 2;
    this.updateStick(x, y);
  }

  updateStick(x, y) {
    const radius = 52;
    let dx = x - this.stick.ox;
    let dy = y - this.stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx = dx / len * radius; dy = dy / len * radius; }
    this.stick.x = dx; this.stick.y = dy;
    this.move.x = dx / radius;
    this.move.y = dy / radius;
    if (this.stickKnob) this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (this.stickEl) this.stickEl.classList.add('is-active');
  }

  releaseStick() {
    this.stick.active = false;
    this.stick.id = null;
    this.move.x = 0; this.move.y = 0;
    if (this.stickKnob) this.stickKnob.style.transform = 'translate(0px, 0px)';
    if (this.stickEl) this.stickEl.classList.remove('is-active');
  }

  touchStart(e) {
    if (!this.enabled) return;
    for (const t of e.changedTouches) {
      if (!this.stick.active && this.inStickZone(t.clientX, t.clientY)) {
        e.preventDefault();
        this.startStick(t.identifier, t.clientX, t.clientY);
      } else if (this.drag.id === null) {
        this.drag.id = t.identifier;
        this.drag.x = t.clientX; this.drag.y = t.clientY; this.drag.moved = 0;
      } else if (this.pinch === null) {
        const first = [...e.touches].find((x) => x.identifier === this.drag.id);
        if (first) {
          this.pinch = { a: this.drag.id, b: t.identifier, start: Math.hypot(first.clientX - t.clientX, first.clientY - t.clientY), dist: this.camera.distance };
        }
      }
    }
  }

  touchMove(e) {
    if (!this.enabled) return;
    for (const t of e.changedTouches) {
      if (this.stick.active && t.identifier === this.stick.id) {
        e.preventDefault();
        this.updateStick(t.clientX, t.clientY);
      } else if (t.identifier === this.drag.id && !this.pinch) {
        const dx = t.clientX - this.drag.x;
        const dy = t.clientY - this.drag.y;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        this.orbit(dx, dy);
        this.drag.x = t.clientX; this.drag.y = t.clientY;
      }
    }
    if (this.pinch) {
      const a = [...e.touches].find((t) => t.identifier === this.pinch.a);
      const b = [...e.touches].find((t) => t.identifier === this.pinch.b);
      if (a && b) {
        e.preventDefault();
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        this.camera.setDistance(this.pinch.dist * (this.pinch.start / Math.max(1, d)));
      }
    }
  }

  touchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.stick.id) this.releaseStick();
      if (this.pinch && (t.identifier === this.pinch.a || t.identifier === this.pinch.b)) this.pinch = null;
      if (t.identifier === this.drag.id) {
        if (this.drag.moved < 9 && this.onTap && this.enabled) this.onTap(t.clientX, t.clientY);
        this.drag.id = null;
      }
    }
  }

  mouseDown(e) {
    if (!this.enabled) return;
    if (this.inStickZone(e.clientX, e.clientY)) {
      this.startStick('mouse', e.clientX, e.clientY);
      return;
    }
    this.drag.id = 'mouse';
    this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.moved = 0;
  }

  mouseMove(e) {
    if (this.stick.active && this.stick.id === 'mouse') { this.updateStick(e.clientX, e.clientY); return; }
    if (this.drag.id !== 'mouse') return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    this.orbit(dx, dy);
    this.drag.x = e.clientX; this.drag.y = e.clientY;
  }

  mouseUp(e) {
    if (this.stick.id === 'mouse') this.releaseStick();
    if (this.drag.id === 'mouse') {
      if (this.drag.moved < 6 && this.onTap && this.enabled) this.onTap(e.clientX, e.clientY);
      this.drag.id = null;
    }
  }

  orbit(dx, dy) {
    this.camera.yaw -= dx * 0.006;
    this.camera.pitch = clamp(this.camera.pitch + dy * 0.004, 0.35, 1.32);
  }

  /** Movement for this frame, already rotated into camera space. */
  axis() {
    let x = this.move.x;
    let y = this.move.y;
    const km = this.keyMove;
    if (km && (km.x || km.y)) { x = km.x; y = km.y; }
    const len = Math.hypot(x, y);
    if (len < 0.12) return { x: 0, z: 0, power: 0 };
    const power = Math.min(1, len);
    const nx = x / len; const ny = y / len;
    const yaw = this.camera.yaw;
    const cos = Math.cos(yaw); const sin = Math.sin(yaw);
    // Screen up on the stick means "away from the camera", whichever way it faces.
    return { x: (nx * cos + ny * sin) * power, z: (ny * cos - nx * sin) * power, power };
  }
}
