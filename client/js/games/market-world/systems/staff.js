// ==========================================================
// Market World - the staff.
//
// Hired workers are real people in the world with the same rig as the
// player, doing the same jobs through the same functions. Hire a farmer
// and a farmer walks out to the field; you can stand and watch them work.
// ==========================================================
import { Actor } from '../world/character.js';
import { collide, routeTo } from '../world/layout.js';
import { STAFF_TYPES, STAFF_LEVELS } from '../data/progress.js';
import { CROPS, ANIMALS, item } from '../data/catalog.js';
import { rand, pick } from '../engine/math.js';
import {
  currentLocation, plant, water, harvest, collectAnimal, feedAnimals,
  collectMachine, machineOutputCount, shelfSpace, addXp
} from './sim.js';
import { addStock, takeStock, storageSpace, shelfCapacity, seedPrice } from './state.js';

const LOOK_BY_TYPE = {
  farmer:  { shirt: '#6f9f4a', pants: '#5c4a3f', accessory: 'cap' },
  stocker: { shirt: '#4f8fd0', pants: '#3f4a5c', accessory: 'apron' },
  cashier: { shirt: '#d0684f', pants: '#3f4a5c', accessory: 'apron' },
  cleaner: { shirt: '#7f6fd0', pants: '#2f3542', accessory: 'headband' },
  courier: { shirt: '#c9a24a', pants: '#5c4a3f', accessory: 'backpack' },
  manager: { shirt: '#3f4a5c', pants: '#2f3542', accessory: 'glasses' }
};

const SKINS = ['#f3d0b0', '#e8b98d', '#c98d5f', '#9c6438', '#6d4326', '#4a2d1a'];
const HAIRS = ['#2b2018', '#5a3a20', '#a5642a', '#d8b45c', '#3f5f8f', '#e8e8e8'];
const STYLES = ['short', 'bun', 'curls', 'ponytail', 'braids'];

function lookFor(type, seed) {
  const base = LOOK_BY_TYPE[type] || LOOK_BY_TYPE.stocker;
  const n = Math.abs(seed);
  return {
    skin: SKINS[n % SKINS.length],
    hair: HAIRS[(n >> 2) % HAIRS.length],
    hairStyle: STYLES[(n >> 4) % STYLES.length],
    shirt: base.shirt,
    pants: base.pants,
    shoes: '#3a3a3a',
    accessory: base.accessory
  };
}

const hashId = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
};

export class Staff {
  constructor(game) {
    this.g = game;
    this.workers = [];
  }

  setLayout(layout) {
    this.layout = layout;
    this.sync(true);
  }

  /** Keeps the world's workers matched to the ones in the save game. */
  sync(reposition = false) {
    const loc = currentLocation(this.g.state);
    const seen = new Set();
    loc.staff.forEach((member) => {
      seen.add(member.id);
      let w = this.workers.find((x) => x.id === member.id);
      if (!w) {
        const spawn = this.layout ? { x: rand(-3, 3), z: this.layout.store.halfD + 3 } : { x: 0, z: 0 };
        w = {
          id: member.id,
          member,
          actor: new Actor(lookFor(member.type, hashId(member.id)), { x: spawn.x, z: spawn.z }),
          job: 'idle',
          path: [],
          target: null,
          timer: 0,
          carry: null,
          till: -1
        };
        this.workers.push(w);
        this.g.onStaffArrive(w);
      } else {
        w.member = member;
      }
      if (reposition && this.layout) {
        w.path = [];
        w.job = 'idle';
      }
    });
    this.workers = this.workers.filter((w) => seen.has(w.id));
    // Cashiers claim tills in the order they were hired.
    let till = 0;
    this.workers.forEach((w) => {
      if (w.member.type === 'cashier') {
        w.till = till < this.layout.checkouts.length ? till : -1;
        till += 1;
      } else w.till = -1;
    });
  }

  managerBonus() {
    const managers = this.workers.filter((w) => w.member.type === 'manager');
    return 1 + managers.reduce((a, w) => a + 0.12 * STAFF_LEVELS[w.member.level - 1].efficiency, 0);
  }

  /** Which tills currently have somebody behind them. */
  mannedTills() {
    const out = new Set();
    this.workers.forEach((w) => {
      if (w.member.type === 'cashier' && w.till >= 0 && w.job === 'till') out.add(w.till);
    });
    return out;
  }

  cashierSpeed(tillIndex) {
    const w = this.workers.find((x) => x.member.type === 'cashier' && x.till === tillIndex && x.job === 'till');
    if (!w) return 0;
    return STAFF_LEVELS[w.member.level - 1].speed * this.managerBonus();
  }

  update(dt) {
    this.sync();
    const bonus = this.managerBonus();
    this.workers.forEach((w) => {
      const stats = STAFF_LEVELS[w.member.level - 1];
      w.actor.speed = 3.4 * stats.speed * bonus;
      this.stepWorker(w, dt, stats, bonus);
      w.actor.update(dt);
    });
  }

  walk(w, dt) {
    if (!w.path.length) return true;
    const arrived = w.actor.stepTo(w.path[0], dt, this.layout, collide, 0.45);
    if (arrived) { w.path.shift(); w.retries = 0; }
    if (w.actor.stuckT > 1.2) {
      // Caught on a wall: work out a fresh route, and give up on the job
      // altogether rather than shuffling on the spot forever.
      w.actor.stuckT = 0;
      w.retries = (w.retries || 0) + 1;
      if (w.retries > 3) {
        w.retries = 0;
        w.path = [];
        w.job = 'idle';
        return true;
      }
      const dest = w.dest || w.path[w.path.length - 1];
      if (dest) w.path = routeTo(this.layout, w.actor, dest);
    }
    return w.path.length === 0;
  }

  goTo(w, point) {
    w.dest = point;
    w.retries = 0;
    w.actor.stuckT = 0;
    w.path = routeTo(this.layout, w.actor, point);
  }

  stepWorker(w, dt, stats, bonus) {
    if (w.timer > 0) {
      w.timer -= dt;
      if (w.timer > 0) return;
    }
    if (w.path.length) {
      if (!this.walk(w, dt)) return;
    }
    switch (w.member.type) {
      case 'farmer': this.farmerJob(w, stats); break;
      case 'stocker': this.stockerJob(w, stats); break;
      case 'cashier': this.cashierJob(w); break;
      case 'cleaner': this.cleanerJob(w, dt, stats); break;
      case 'courier': this.courierJob(w, stats); break;
      case 'manager': this.managerJob(w); break;
      default: break;
    }
    void bonus;
  }

  // ---- Jobs ---------------------------------------------------------
  farmerJob(w, stats) {
    const g = this.g;
    const loc = currentLocation(g.state);
    const layout = this.layout;
    if (w.job === 'goHarvest' || w.job === 'goWater' || w.job === 'goPlant') {
      const index = w.target;
      const plot = loc.plots[index];
      if (!plot) { w.job = 'idle'; return; }
      if (w.job === 'goHarvest' && plot.ready) {
        const res = harvest(g, index);
        if (res.ok) {
          w.carry = { item: res.item, count: (w.carry ? w.carry.count : 0) + res.amount };
          w.actor.carry = { count: w.carry.count, color: item(res.item).color };
          g.fx.burst(plot.x || layout.plots[index].x, 0.8, layout.plots[index].z, item(res.item).color, 6);
          g.fx.label(`+${res.amount}`, layout.plots[index].x, 1.6, layout.plots[index].z, 'item');
        }
        w.actor.setAction('harvest', 1.1 / stats.speed);
        w.timer = 1.1 / stats.speed;
      } else if (w.job === 'goWater') {
        water(g, index);
        w.actor.setAction('water', 1 / stats.speed);
        w.timer = 1 / stats.speed;
        g.fx.splash(layout.plots[index].x, 0.5, layout.plots[index].z, 6);
      } else if (w.job === 'goPlant') {
        const cropId = g.preferredCrop();
        if (cropId) plant(g, index, cropId);
        w.actor.setAction('plant', 1.1 / stats.speed);
        w.timer = 1.1 / stats.speed;
      }
      w.job = 'idle';
      return;
    }
    if (w.job === 'goStore') {
      if (w.carry) {
        addStock(g.state, w.carry.item, w.carry.count);
        w.carry = null;
        w.actor.carry = null;
        w.actor.setAction('stock', 0.6);
        w.timer = 0.6;
      }
      w.job = 'idle';
      return;
    }
    // Nothing in progress: pick the most useful job in the field.
    const capacity = stats.capacity * 3;
    if (w.carry && w.carry.count >= capacity) {
      this.goTo(w, { x: layout.storage.x, z: layout.storage.z + 2 });
      w.job = 'goStore';
      return;
    }
    const readyIdx = loc.plots.findIndex((p) => p.ready);
    if (readyIdx >= 0 && (!w.carry || w.carry.count < capacity)) {
      this.goTo(w, layout.plots[readyIdx]);
      w.job = 'goHarvest'; w.target = readyIdx; return;
    }
    const dryIdx = loc.plots.findIndex((p) => p.crop && !p.ready && p.water < 0.25);
    if (dryIdx >= 0) {
      this.goTo(w, layout.plots[dryIdx]);
      w.job = 'goWater'; w.target = dryIdx; return;
    }
    const emptyIdx = loc.plots.findIndex((p) => !p.crop);
    const crop = this.g.preferredCrop();
    if (emptyIdx >= 0 && crop && g.state.player.cash > seedPrice(g.state, crop) * 4) {
      this.goTo(w, layout.plots[emptyIdx]);
      w.job = 'goPlant'; w.target = emptyIdx; return;
    }
    if (w.carry) {
      this.goTo(w, { x: layout.storage.x, z: layout.storage.z + 2 });
      w.job = 'goStore'; return;
    }
    this.idleWander(w, layout.field);
  }

  stockerJob(w, stats) {
    const g = this.g;
    const loc = currentLocation(g.state);
    const layout = this.layout;
    if (w.job === 'fetch') {
      const need = w.target;
      const pulled = takeStock(g.state, need.item, Math.min(stats.capacity * 4, need.space));
      if (pulled > 0) {
        w.carry = { item: need.item, count: pulled };
        w.actor.carry = { count: pulled, color: item(need.item).color };
        this.goTo(w, layout.shelves[need.shelf].stand);
        w.job = 'fill';
        w.actor.setAction('stock', 0.5);
        w.timer = 0.5;
      } else w.job = 'idle';
      return;
    }
    if (w.job === 'fill') {
      const need = w.target;
      const shelf = loc.shelves[need.shelf];
      if (shelf && w.carry && shelf.item === w.carry.item) {
        const space = Math.max(0, shelfCapacity(g.state) - shelf.count);
        const moved = Math.min(space, w.carry.count);
        shelf.count += moved;
        w.carry.count -= moved;
        g.state.stats.stocked += moved;
        g.progressMission('stock', moved);
        addXp(g, Math.round(moved * 0.5));
        g.fx.label(`+${moved}`, layout.shelves[need.shelf].x, 2.3, layout.shelves[need.shelf].z, 'item');
        g.audio.play('stock');
      }
      if (w.carry && w.carry.count > 0) addStock(g.state, w.carry.item, w.carry.count);
      w.carry = null;
      w.actor.carry = null;
      w.actor.setAction('stock', 1 / stats.speed);
      w.timer = 1 / stats.speed;
      w.job = 'idle';
      return;
    }
    if (w.carry && w.carry.count > 0) {
      addStock(g.state, w.carry.item, w.carry.count);
      w.carry = null;
      w.actor.carry = null;
    }
    // Find the emptiest shelf that the store room can actually refill.
    let best = null;
    loc.shelves.forEach((shelf, i) => {
      if (!shelf.item) return;
      const space = Math.max(0, shelfCapacity(g.state) - shelf.count);
      if (space < 3) return;
      const have = loc.storage[shelf.item] || 0;
      if (have <= 0) return;
      const score = space + (shelf.count === 0 ? 40 : 0);
      if (!best || score > best.score) best = { shelf: i, item: shelf.item, space: Math.min(space, have), score };
    });
    if (best) {
      this.goTo(w, { x: layout.storage.x, z: layout.storage.z + 2 });
      w.job = 'fetch';
      w.target = best;
      return;
    }
    this.idleWander(w, { x: 0, z: 0 });
  }

  cashierJob(w) {
    const layout = this.layout;
    if (w.till < 0) { this.idleWander(w, { x: 0, z: layout.store.halfD - 5 }); return; }
    const till = layout.checkouts[w.till];
    const spot = { x: till.x, z: till.z - 1.1 };
    const dist = Math.hypot(w.actor.x - spot.x, w.actor.z - spot.z);
    if (dist > 0.5) {
      this.goTo(w, spot);
      w.job = 'walk';
      return;
    }
    w.job = 'till';
    w.actor.yaw = Math.PI;
    const queue = this.g.customers.queues[w.till];
    if (queue && queue.length) {
      w.actor.setAction('till', 0.6);
      w.timer = 0.3;
    } else {
      w.timer = 0.5;
    }
  }

  cleanerJob(w, dt, stats) {
    const loc = currentLocation(this.g.state);
    const layout = this.layout;
    loc.dirt = Math.max(0, loc.dirt - dt * 0.6 * stats.efficiency);
    if (!w.path.length) {
      this.goTo(w, {
        x: rand(-layout.store.halfW + 1.5, layout.store.halfW - 1.5),
        z: rand(-layout.store.halfD + 1.5, layout.store.halfD - 2)
      });
      w.actor.setAction('repair', 1.4);
      w.timer = 0.8;
    }
  }

  courierJob(w, stats) {
    const g = this.g;
    const loc = currentLocation(g.state);
    const layout = this.layout;
    if (w.job === 'collectMachine') {
      const res = collectMachine(g, w.target);
      if (res.ok) {
        w.carry = { item: res.item, count: res.amount };
        w.actor.carry = { count: res.amount, color: item(res.item).color };
      }
      this.goTo(w, { x: layout.storage.x, z: layout.storage.z + 2 });
      w.job = 'deliver';
      w.actor.setAction('stock', 0.6);
      w.timer = 0.6;
      return;
    }
    if (w.job === 'collectPen') {
      const res = collectAnimal(g, w.target);
      if (res.ok) {
        w.carry = { item: res.item, count: res.amount };
        w.actor.carry = { count: res.amount, color: item(res.item).color };
        g.fx.burst(layout.pens[w.target].x, 1, layout.pens[w.target].z, item(res.item).color, 5);
      }
      this.goTo(w, { x: layout.storage.x, z: layout.storage.z + 2 });
      w.job = 'deliver';
      w.timer = 0.5;
      return;
    }
    if (w.job === 'feedPen') {
      feedAnimals(g, w.target);
      w.actor.setAction('feed', 1 / stats.speed);
      w.timer = 1 / stats.speed;
      w.job = 'idle';
      return;
    }
    if (w.job === 'deliver') {
      if (w.carry) {
        addStock(g.state, w.carry.item, w.carry.count);
        w.carry = null;
        w.actor.carry = null;
      }
      w.actor.setAction('stock', 0.5);
      w.timer = 0.5;
      w.job = 'idle';
      return;
    }
    if (w.carry) {
      // A job that was given up on halfway still leaves goods in their arms.
      this.goTo(w, { x: layout.storage.x, z: layout.storage.z + 2 });
      w.job = 'deliver';
      return;
    }
    const machineIdx = loc.machines.findIndex((m) => m && machineOutputCount(m) > 0);
    if (machineIdx >= 0 && storageSpace(g.state) > 0) {
      this.goTo(w, layout.machines[machineIdx].stand);
      w.job = 'collectMachine'; w.target = machineIdx; return;
    }
    const penIdx = loc.pens.findIndex((p) => p.animal && p.ready > 0);
    if (penIdx >= 0 && storageSpace(g.state) > 0) {
      this.goTo(w, { x: layout.pens[penIdx].x, z: layout.pens[penIdx].z + 1.5 });
      w.job = 'collectPen'; w.target = penIdx; return;
    }
    const hungry = loc.pens.findIndex((p) => p.animal && p.feed < 0.3);
    if (hungry >= 0) {
      this.goTo(w, { x: layout.pens[hungry].x, z: layout.pens[hungry].z + 1.5 });
      w.job = 'feedPen'; w.target = hungry; return;
    }
    this.idleWander(w, layout.dock);
  }

  managerJob(w) {
    const layout = this.layout;
    if (!w.path.length) {
      this.goTo(w, {
        x: rand(-layout.store.halfW + 2, layout.store.halfW - 2),
        z: rand(-layout.store.halfD + 2, layout.store.halfD - 3)
      });
      w.timer = rand(1.5, 3.5);
    }
  }

  idleWander(w, around) {
    if (w.path.length) return;
    this.goTo(w, { x: around.x + rand(-3, 3), z: around.z + rand(-3, 3) });
    w.timer = rand(0.8, 2.4);
  }

  // ---- Animals need somebody to look after them too -------------------
  penNeedsWork(loc) {
    return loc.pens.some((p) => p.animal && (p.ready > 0 || p.feed < 0.3));
  }

  draw(renderer, meshes, camera) {
    this.workers.forEach((w) => {
      const dx = w.actor.x - camera.focusX;
      const dz = w.actor.z - camera.focusZ;
      w.actor.draw(renderer, meshes, dx * dx + dz * dz > 900 ? 0 : 1);
    });
  }
}

export { STAFF_TYPES, ANIMALS, CROPS, pick };
