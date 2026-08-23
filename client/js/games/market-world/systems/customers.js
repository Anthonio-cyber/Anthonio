// ==========================================================
// Market World - the shoppers.
//
// They arrive from the street, look for what they came for, give up on
// an empty shelf, queue at the till, pay and go home. Every one of them
// is pooled and reused, and the crowd is capped, so a busy Mega Market
// still runs on a mid-range phone.
// ==========================================================
import { Actor, randomLook } from '../world/character.js';
import { collide, routeTo } from '../world/layout.js';
import { PERSONALITIES } from '../data/progress.js';
import { item, departmentOf } from '../data/catalog.js';
import { rand, randInt, pick, clamp } from '../engine/math.js';
import { currentLocation, sellPrice, adjustReputation, addXp, earn } from './sim.js';

const WEIGHT_TOTAL = PERSONALITIES.reduce((a, p) => a + p.weight, 0);

function rollPersonality(vipBias = 0) {
  if (vipBias > 0 && Math.random() < vipBias) return PERSONALITIES.find((p) => p.id === 'vip');
  let r = Math.random() * WEIGHT_TOTAL;
  for (const p of PERSONALITIES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PERSONALITIES[0];
}

export class Customers {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.spawnBucket = 0;
    this.queues = [];
    this.maxActive = 22;
  }

  setLayout(layout) {
    this.layout = layout;
    this.queues = layout.checkouts.map(() => []);
    // Anyone mid-shop when the building changed simply walks out.
    this.list.forEach((c) => { if (c.phase !== 'leaving') this.sendHome(c, false); });
  }

  get count() { return this.list.length; }

  averageQueue() {
    if (!this.queues.length) return 0;
    const total = this.queues.reduce((a, q) => a + q.length, 0);
    return total / this.queues.length;
  }

  /** Shoppers per minute, before anything is spent on marketing. */
  baseRate() {
    const g = this.g;
    const loc = currentLocation(g.state);
    const place = g.locationDef();
    const stage = g.layout.exp;
    const rep = loc.reputation / 5;
    let rate = 4 + stage.shelves * 1.6;
    rate *= place.trafficMul;
    rate *= 0.55 + rep * 0.9;
    // A shop with nothing on the shelves does not draw a crowd, which
    // also stops an empty start from wrecking a new player's reputation.
    const shelves = loc.shelves.filter((sh) => sh.item);
    const stocked = shelves.filter((sh) => sh.count > 0).length;
    rate *= 0.3 + 0.7 * (shelves.length ? stocked / shelves.length : 0);
    rate *= 1 + stage.trafficBonus;
    rate *= 1 + g.marketingBoost();
    rate *= 1 + g.eventTraffic();
    rate *= 1 + (g.state.upgrades.decor || 0) * 0.05;
    return rate;
  }

  update(dt) {
    const g = this.g;
    this.maxActive = g.state.settings.quality >= 1 ? 26 : 14;
    this.spawnBucket += (this.baseRate() / 60) * dt;
    while (this.spawnBucket >= 1) {
      this.spawnBucket -= 1;
      if (this.list.length < this.maxActive) this.spawn();
    }
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const c = this.list[i];
      this.step(c, dt);
      c.actor.update(dt);
      if (c.done) {
        this.detach(c);
        this.list.splice(i, 1);
      }
    }
  }

  spawn() {
    const g = this.g;
    const layout = this.layout;
    const start = pick(layout.spawnPoints);
    const vipBias = g.state.event && g.eventDef(g.state.event.id)?.vip ? g.eventDef(g.state.event.id).vip : 0;
    const person = rollPersonality(vipBias);
    const place = g.locationDef();
    const actor = new Actor(randomLook(), { x: start.x, z: start.z, speed: 3 * person.speed });
    actor.carryStyle = 'basket';
    const wanted = this.buildList(person);
    const c = {
      actor,
      person,
      phase: wanted.length ? 'toDoor' : 'turnAway',
      wanted,
      basket: [],
      target: null,
      path: [],
      waited: 0,
      patience: person.patience * (place.patienceMul || 1),
      till: -1,
      queueIndex: -1,
      timer: 0,
      done: false,
      spend: person.spend,
      home: start
    };
    if (!wanted.length) {
      // Nothing worth buying: they look through the window and move on.
      c.path = [{ x: rand(-4, 4), z: layout.store.halfD + 4 }, pick(layout.spawnPoints)];
      adjustReputation(this.g, -0.004);
    } else {
      c.path = routeTo(layout, actor, this.shelfStand(wanted[0].shelf));
    }
    this.list.push(c);
    if (Math.random() < 0.25) this.g.audio.play('customer');
    return c;
  }

  /** Picks a shopping list out of whatever is actually on the shelves. */
  buildList(person) {
    const loc = currentLocation(this.g.state);
    const stocked = [];
    loc.shelves.forEach((shelf, index) => {
      if (shelf.item && shelf.count > 0) stocked.push({ index, item: shelf.item });
    });
    if (!stocked.length) return [];
    const want = randInt(person.items[0], person.items[1]);
    const list = [];
    const usedDepts = new Set();
    for (let i = 0; i < want; i += 1) {
      let choice = pick(stocked);
      if (person.categories) {
        // Families deliberately spread across departments.
        const fresh = stocked.filter((s) => !usedDepts.has((departmentOf(s.item) || {}).id));
        if (fresh.length) choice = pick(fresh);
      }
      if (person.id === 'budget') {
        // Budget shoppers head for the cheapest thing on the shelves.
        const sorted = [...stocked].sort((a, b) => item(a.item).value - item(b.item).value);
        choice = sorted[randInt(0, Math.min(2, sorted.length - 1))];
      }
      usedDepts.add((departmentOf(choice.item) || {}).id);
      list.push({ shelf: choice.index, item: choice.item, count: randInt(1, person.id === 'big' ? 3 : 2) });
    }
    return list;
  }

  shelfStand(index) {
    const shelf = this.layout.shelves[index];
    if (!shelf) return this.layout.insideDoor;
    return { x: shelf.stand.x + rand(-0.7, 0.7), z: shelf.stand.z + rand(-0.2, 0.5) };
  }

  step(c, dt) {
    const g = this.g;
    const layout = this.layout;
    const a = c.actor;

    // Walking along the current path is shared by every phase.
    if (c.path && c.path.length) {
      const next = c.path[0];
      const arrived = a.stepTo(next, dt, layout, collide, 0.45);
      if (arrived) { c.path.shift(); c.retries = 0; }
      if (a.stuckT > 1.4) {
        // Snagged on a wall. Try the route again through the doors, and
        // after a few goes simply give up and go home.
        a.stuckT = 0;
        c.retries = (c.retries || 0) + 1;
        if (c.retries > 3) { this.detach(c); this.sendHome(c, false); return; }
        const dest = c.path[c.path.length - 1];
        if (dest) c.path = routeTo(layout, a, dest);
      }
      if (c.path.length) return;
    }

    switch (c.phase) {
      case 'turnAway':
        c.done = true;
        break;

      case 'toDoor': {
        const first = c.wanted[0];
        if (!first) { this.goToTill(c); break; }
        c.phase = 'atShelf';
        c.timer = 0.9;
        a.faceTowards(layout.shelves[first.shelf].x, layout.shelves[first.shelf].z, 1, 20);
        a.setAction('stock', 0.9);
        break;
      }

      case 'atShelf': {
        c.timer -= dt;
        if (c.timer > 0) break;
        const want = c.wanted.shift();
        const loc = currentLocation(g.state);
        const shelf = loc.shelves[want.shelf];
        if (shelf && shelf.item === want.item && shelf.count > 0) {
          const taken = Math.min(shelf.count, want.count);
          shelf.count -= taken;
          c.basket.push({ item: want.item, count: taken });
          a.carry = { item: want.item, count: c.basket.length, color: item(want.item).color };
          g.fx.burst(a.x, 1.3, a.z, item(want.item).color, 3, { scale: 0.5, life: 0.4, vy: 2 });
        } else {
          // The shelf was empty by the time they got there.
          c.disappointed = (c.disappointed || 0) + 1;
          adjustReputation(g, -0.01);
          g.fx.label('!', a.x, 2.2, a.z, 'sad');
        }
        if (c.wanted.length) {
          c.path = [this.shelfStand(c.wanted[0].shelf)];
          c.phase = 'toDoor';
        } else if (c.basket.length) {
          this.goToTill(c);
        } else {
          this.sendHome(c, true);
        }
        break;
      }

      case 'toTill': {
        c.phase = 'queue';
        break;
      }

      case 'queue': {
        const q = this.queues[c.till];
        if (!q) { this.goToTill(c); break; }
        const pos = q.indexOf(c);
        const till = layout.checkouts[c.till];
        const spot = {
          x: till.pay.x + (pos === 0 ? 0 : rand(-0.05, 0.05)),
          z: till.pay.z + pos * 1.25
        };
        a.stepTo(spot, dt, layout, collide, 0.3);
        if (pos === 0) a.faceTowards(till.x, till.z, dt, 8);
        c.waited += dt;
        // Patience runs out, and impatient shoppers walk out of a long queue.
        if (c.waited > c.patience) {
          this.abandon(c);
          break;
        }
        if (pos === 0) {
          const served = g.tillIsManned(c.till);
          if (served) {
            c.phase = 'paying';
            c.timer = 1.5 / served;
            a.setAction('pay', c.timer);
          }
        }
        break;
      }

      case 'paying': {
        c.timer -= dt;
        if (c.timer > 0) break;
        this.pay(c);
        break;
      }

      case 'leaving':
        c.done = true;
        break;

      default:
        c.done = true;
        break;
    }
  }

  goToTill(c) {
    const open = this.g.openTills();
    if (!open.length) { this.sendHome(c, true); return; }
    // Join whichever open till has the shortest line.
    let best = open[0];
    let bestLen = this.queues[best] ? this.queues[best].length : 99;
    open.forEach((i) => {
      const len = this.queues[i] ? this.queues[i].length : 99;
      if (len < bestLen) { best = i; bestLen = len; }
    });
    c.till = best;
    this.queues[best].push(c);
    c.phase = 'toTill';
    c.path = [{ x: this.layout.checkouts[best].pay.x, z: this.layout.checkouts[best].pay.z + this.queues[best].length * 1.25 }];
    c.waited = 0;
  }

  pay(c) {
    const g = this.g;
    const loc = currentLocation(g.state);
    let total = 0;
    let units = 0;
    c.basket.forEach((line) => {
      const price = sellPrice(g, line.item);
      total += price * line.count * c.spend;
      units += line.count;
      g.recordSale(line.item, line.count);
    });
    if (c.person.tip) total *= 1 + c.person.tip;
    const waitPenalty = clamp(1 - (c.waited / Math.max(1, c.patience)) * 0.25, 0.7, 1);
    total = Math.round(total * waitPenalty);
    earn(g, total);
    loc.served += 1;
    loc.revenue += total;
    g.state.stats.served += 1;
    g.progressMission('serve', 1);
    g.progressMission('earn', total);
    addXp(g, 6 + Math.round(units * 3));
    loc.dirt = Math.min(100, loc.dirt + 0.4 + units * 0.08);
    adjustReputation(g, c.waited < c.patience * 0.4 ? 0.006 : -0.002);

    const till = this.layout.checkouts[c.till];
    g.fx.coins(till.x, 1.4, till.z, g.player, Math.min(8, 3 + Math.round(units / 2)));
    g.fx.label(`+$${total.toLocaleString()}`, till.x, 2.1, till.z, 'cash');
    g.audio.play('checkout');
    g.audio.play('coin');

    c.actor.carry = null;
    c.basket = [];
    this.detach(c);
    this.sendHome(c, true);
  }

  abandon(c) {
    const g = this.g;
    adjustReputation(g, -0.05);
    currentLocation(g.state).dirt = Math.min(100, currentLocation(g.state).dirt + 1.5);
    g.fx.label('Left the queue', c.actor.x, 2.2, c.actor.z, 'sad');
    g.audio.play('error');
    // They abandon the basket, so the goods go back on the shelf.
    const loc = currentLocation(g.state);
    c.basket.forEach((line) => {
      const shelf = loc.shelves.find((s) => s.item === line.item);
      if (shelf) shelf.count += line.count;
    });
    c.basket = [];
    c.actor.carry = null;
    this.detach(c);
    this.sendHome(c, false);
  }

  detach(c) {
    if (c.till >= 0 && this.queues[c.till]) {
      const q = this.queues[c.till];
      const i = q.indexOf(c);
      if (i >= 0) q.splice(i, 1);
    }
    c.till = -1;
  }

  sendHome(c, happy) {
    c.phase = 'leaving';
    c.path = routeTo(this.layout, c.actor, c.home);
    c.actor.speed = 3.2 * c.person.speed * (happy ? 1 : 1.4);
  }

  draw(renderer, meshes, camera) {
    for (let i = 0; i < this.list.length; i += 1) {
      const a = this.list[i].actor;
      const dx = a.x - camera.focusX;
      const dz = a.z - camera.focusZ;
      const far = dx * dx + dz * dz > 900;
      a.draw(renderer, meshes, far ? 0 : 1);
    }
  }

  reset() {
    this.list = [];
    this.queues = this.queues.map(() => []);
  }
}
