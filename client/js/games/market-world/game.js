// ==========================================================
// Market World - the game itself.
//
// Owns the loop, the world, the player and every system, and exposes a
// small API that the interface layer drives. Nothing in here touches the
// DOM apart from the canvas: the HUD talks to this class, never the
// other way round.
// ==========================================================
import { Renderer, Camera } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { clamp, rand, rgb, dist2, mixHex } from './engine/math.js';
import { createCharacterMeshes, Actor } from './world/character.js';
import { createProductMeshes, createCropMeshes, createFxMeshes } from './world/props.js';
import { createAnimalMeshes, Herd } from './world/animals.js';
import { buildWorld, createVehicleMeshes } from './world/build.js';
import { buildLayout, collide } from './world/layout.js';
import { Effects } from './world/fx.js';
import { Customers } from './systems/customers.js';
import { Staff } from './systems/staff.js';
import * as sim from './systems/sim.js';
import * as meta from './systems/meta.js';
import {
  newGame, loadGame, saveGame, currentLocation, walkSpeed, actionSpeed,
  carryCapacity, availableCrops, shelfCapacity, syncToStage
} from './systems/state.js';
import { CROPS, ANIMALS, MACHINES, item, departmentOf } from './data/catalog.js';
import { locationById, expansionFor } from './data/locations.js';
import { UPGRADES } from './data/progress.js';

const REACH = {
  plot: 1.9, shelf: 2.0, till: 1.9, storage: 3.0, machine: 2.6, pen: 3.0, dock: 3.2
};

export class Game {
  constructor({ canvas, overlay, hooks = {} }) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.hooks = hooks;
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.audio = new Audio();
    this.gl = this.renderer.gl;

    this.meshes = {
      char: createCharacterMeshes(this.gl),
      product: createProductMeshes(this.gl),
      crop: createCropMeshes(this.gl),
      fx: createFxMeshes(this.gl),
      animal: createAnimalMeshes(this.gl),
      vehicle: createVehicleMeshes(this.gl)
    };
    this.fx = new Effects(this.meshes.fx, overlay);
    this.herd = new Herd();

    this.state = loadGame() || newGame();
    this.carry = null;
    this.selectedCrop = availableCrops(this.state)[0] || 'lettuce';
    this.customers = new Customers(this);
    this.staff = new Staff(this);
    this.player = new Actor(this.state.player.look, { x: 0, z: 8 });
    this.actionCooldown = 0;
    this.holding = false;
    this.running = false;
    this.paused = false;
    this.time = 0;
    this.fps = 60;
    this.frames = 0;
    this.fpsTimer = 0;
    this.nearby = null;
    this.saleLog = [];
    this.wageBucket = 0;
    this.autoSaveTimer = 0;

    this.input = new Input(canvas, this.camera);
    this.input.onAction = () => this.doPrimary();
    this.input.onTap = (x, y) => this.handleTap(x, y);

    this.rebuild(true);
    this.audio.playTheme(this.locationDef().theme);
  }

  // ---- Set-up ---------------------------------------------------------
  locationDef() { return locationById(this.state.location); }

  rebuild(initial = false) {
    const loc = currentLocation(this.state);
    syncToStage(loc);
    this.layout = buildLayout(loc.stage);
    if (this.world) this.world.dispose();
    const palette = this.locationDef().palette;
    this.world = buildWorld(this.gl, this.layout, palette, this.state, loc);
    this.renderer.setSky(palette.sky, palette.ground, palette.fog);
    this.customers.setLayout(this.layout);
    this.staff.setLayout(this.layout);
    this.herd.sync(this.layout, loc.pens);
    if (initial) {
      this.player.x = 0;
      this.player.z = this.layout.store.halfD + 4;
      this.camera.focusX = this.player.x;
      this.camera.focusZ = this.player.z;
    }
    this.parkedCars = this.layout.parking.map((p, i) => ({
      x: p.x, z: p.z, ry: 0, color: ['#e05a3a', '#4f8fd0', '#f2f2f2', '#6f9f4a', '#d0a83a'][i % 5], shown: false
    }));
    if (this.hooks.onWorldRebuilt) this.hooks.onWorldRebuilt();
  }

  resize(w, h) {
    this.renderer.resize(w, h);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (ts) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (ts - this.last) / 1000);
      this.last = ts;
      if (!this.paused) this.update(dt);
      this.render();
      this.frames += 1;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 1) { this.fps = this.frames / this.fpsTimer; this.frames = 0; this.fpsTimer = 0; }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    saveGame(this.state, true);
    this.input.destroy();
    this.audio.destroy();
    if (this.world) this.world.dispose();
    this.fx.clearLabels();
  }

  // ---- Hooks the systems call back into -------------------------------
  notify(text, kind = 'info') { if (this.hooks.onNotify) this.hooks.onNotify(text, kind); }
  bump(reason) { void reason; }

  onLevelUp(level, reward) {
    this.audio.play('levelup');
    this.fx.confetti(this.player.x, 1.5, this.player.z, 46);
    this.player.setAction('cheer', 1.2);
    this.camera.shake = 0.7;
    this.notify(`Level ${level}! ${reward && reward.note ? reward.note : 'New things have opened up.'}`, 'level');
    meta.checkMissionState(this);
    if (this.hooks.onLevelUp) this.hooks.onLevelUp(level, reward);
  }

  onMissionComplete(mission) {
    this.audio.play('reward');
    this.fx.sparkle(this.player.x, 2, this.player.z, '#f6cd45', 14);
    this.notify(`Mission complete: ${mission.text}`, 'mission');
  }

  onAchievement(a) {
    this.audio.play('unlock');
    this.notify(`Achievement unlocked: ${a.name} (+${a.gems} gems)`, 'achievement');
  }

  onCropReady(index) {
    const plot = this.layout.plots[index];
    if (plot) this.fx.sparkle(plot.x, 0.8, plot.z, '#b8f08a', 4);
  }

  onAnimalReady(index) {
    const pen = this.layout.pens[index];
    if (pen) this.fx.sparkle(pen.x, 1.4, pen.z, '#fff3c4', 5);
  }

  onProduced(index, itemId, amount) {
    const slot = this.layout.machines[index];
    if (!slot) return;
    this.fx.burst(slot.x, 1.8, slot.z + 1.4, item(itemId).color, 5, { scale: 0.7 });
    this.fx.label(`+${amount}`, slot.x, 2.6, slot.z, 'item');
    this.audio.play('machine');
  }

  onAutoHarvest(index, itemId, amount) {
    const plot = this.layout.plots[index];
    if (plot) {
      this.fx.burst(plot.x, 0.7, plot.z, item(itemId).color, 5);
      this.fx.label(`+${amount}`, plot.x, 1.5, plot.z, 'item');
    }
  }

  onDelivery(count) {
    // Send the truck out on a visible round trip.
    this.truckRun = { t: 0, duration: 7 };
    this.audio.play('truck');
    const dock = this.layout.dock;
    this.fx.label(`${count} delivered`, dock.x, 2.6, dock.z, 'item');
  }

  onStaffArrive(worker) {
    this.fx.sparkle(worker.actor.x, 1.6, worker.actor.z, '#bfe4ff', 10);
  }

  onEventChange() { if (this.hooks.onEventChange) this.hooks.onEventChange(); }

  progressMission(type, amount) { meta.progressMission(this, type, amount); }
  recordSale(itemId, count) {
    meta.recordSale(this, itemId, count);
    this.saleLog.push({ item: itemId, count, t: this.time });
    if (this.saleLog.length > 60) this.saleLog.shift();
  }
  eventDef(id) { return meta.eventDef(id); }
  marketingBoost() { return meta.marketingBoost(this); }
  eventTraffic() { return meta.eventTraffic(this); }
  averageQueue() { return this.customers.averageQueue(); }
  preferredCrop() {
    const crops = availableCrops(this.state);
    if (!crops.length) return null;
    return crops.includes(this.selectedCrop) ? this.selectedCrop : crops[crops.length - 1];
  }

  openTills() {
    const loc = currentLocation(this.state);
    const out = [];
    for (let i = 0; i < loc.checkoutsOpen; i += 1) out.push(i);
    return out;
  }

  /** Returns 0 if nobody is on the till, otherwise a speed multiplier. */
  tillIsManned(index) {
    const loc = currentLocation(this.state);
    if (index >= loc.checkoutsOpen) return 0;
    const cashier = this.staff.cashierSpeed(index);
    if (cashier) return cashier;
    const till = this.layout.checkouts[index];
    if (till && dist2(this.player.x, this.player.z, till.x, till.z - 1.1) < 3.2) {
      this.playerServing = true;
      return 1.1 * actionSpeed(this.state);
    }
    const selfCheckouts = (this.state.upgrades.selfcheck || 0);
    if (selfCheckouts > 0 && index >= loc.checkoutsOpen - selfCheckouts) return 0.75;
    return 0;
  }

  // ---- The loop -------------------------------------------------------
  update(dt) {
    this.time += dt;
    this.state.played += dt;
    this.playerServing = false;

    this.updatePlayer(dt);
    sim.tickFarm(this, dt);
    sim.tickAnimals(this, dt);
    sim.tickMachines(this, dt);
    sim.tickDelivery(this, dt);
    sim.tickReputation(this, dt);
    sim.payrollTick(this, dt);
    meta.tickCampaigns(this, dt);
    meta.tickEvents(this, dt);
    this.customers.update(dt);
    this.staff.update(dt);
    this.herd.sync(this.layout, currentLocation(this.state).pens);
    this.herd.update(dt);
    this.fx.update(dt, this.player);
    if (this.truckRun) {
      this.truckRun.t += dt;
      if (this.truckRun.t >= this.truckRun.duration) this.truckRun = null;
    }

    if (this.playerServing) this.player.setAction('till', 0.4);

    this.metaTimer = (this.metaTimer || 0) + dt;
    if (this.metaTimer > 1) {
      this.metaTimer = 0;
      meta.checkMissionState(this);
      meta.checkAchievements(this);
      if (this.hooks.onSlowTick) this.hooks.onSlowTick();
    }

    this.autoSaveTimer += dt;
    if (this.autoSaveTimer > 6) {
      this.autoSaveTimer = 0;
      saveGame(this.state);
    }

    this.nearby = this.findNearby();
    this.camera.update(dt, this.player.x, this.player.z, 0);
  }

  updatePlayer(dt) {
    const axis = this.input.axis();
    const speed = walkSpeed(this.state) * (this.carry ? 0.92 : 1);
    if (axis.power > 0) this.walkTarget = null;
    if (!axis.power && this.walkTarget && !this.player.action) {
      // Tap-to-walk, for anyone who would rather point than steer.
      const arrived = this.player.stepTo(this.walkTarget, dt, this.layout, collide, 0.5, 1);
      if (arrived) this.walkTarget = null;
    } else if (axis.power > 0 && !this.player.action) {
      const nx = this.player.x + axis.x * speed * dt;
      const nz = this.player.z + axis.z * speed * dt;
      const moved = collide(this.layout, this.player, { x: nx, z: nz }, 0.5);
      this.player.x = clamp(moved.x, -110, 110);
      this.player.z = clamp(moved.z, -110, 110);
      this.player.yaw = Math.atan2(axis.x, axis.z);
      this.player.moving = Math.min(1, this.player.moving + dt * 8);
    } else {
      this.player.moving = Math.max(0, this.player.moving - dt * 8);
    }
    this.player.speed = speed;
    this.player.look = this.state.player.look;
    this.player.carry = this.carry
      ? { count: this.carry.count, color: item(this.carry.item).color }
      : null;
    this.player.update(dt);

    if (this.actionCooldown > 0) this.actionCooldown -= dt;
    if (this.holding && this.actionCooldown <= 0) this.doPrimary();
  }

  // ---- Interaction -----------------------------------------------------
  findNearby() {
    const p = this.player;
    const loc = currentLocation(this.state);
    let best = null;
    const consider = (candidate, distance, reach) => {
      if (distance > reach * reach) return;
      if (!best || distance < best.distance) { candidate.distance = distance; best = candidate; }
    };

    this.layout.plots.forEach((plot, i) => {
      const data = loc.plots[i];
      if (!data) return;
      const d = dist2(p.x, p.z, plot.x, plot.z);
      const state = sim.plotState(data);
      let label = 'Plant';
      let action = 'plant';
      if (state === 'ready') { label = `Harvest ${CROPS[data.crop].name}`; action = 'harvest'; }
      else if (state === 'thirsty') { label = 'Water'; action = 'water'; }
      else if (state === 'growing') { label = data.water < 0.55 ? 'Water' : 'Growing'; action = data.water < 0.55 ? 'water' : null; }
      else { label = `Plant ${CROPS[this.preferredCrop()]?.name || 'seed'}`; action = 'plant'; }
      consider({ kind: 'plot', index: i, label, action, x: plot.x, z: plot.z, panel: 'farm' }, d, REACH.plot);
    });

    this.layout.shelves.forEach((shelf, i) => {
      const data = loc.shelves[i];
      const d = dist2(p.x, p.z, shelf.stand.x, shelf.stand.z);
      const name = data && data.item ? item(data.item).name : 'Empty shelf';
      const full = data && data.item && data.count >= shelfCapacity(this.state);
      consider({
        kind: 'shelf', index: i,
        label: !data || !data.item ? 'Choose products' : (full ? `${name} shelf full` : `Stock ${name}`),
        action: !data || !data.item ? null : (full ? null : 'stock'),
        x: shelf.x, z: shelf.z, panel: 'shelf'
      }, d, REACH.shelf);
    });

    this.layout.checkouts.forEach((till, i) => {
      const d = dist2(p.x, p.z, till.x, till.z - 1.1);
      const open = i < loc.checkoutsOpen;
      consider({
        kind: 'till', index: i,
        label: open ? `Serve at till ${i + 1}` : `Open till ${i + 1}`,
        action: open ? 'serve' : 'opentill',
        x: till.x, z: till.z, panel: 'store'
      }, d, REACH.till);
    });

    const st = this.layout.storage;
    consider({
      kind: 'storage', index: 0,
      label: this.carry ? `Put away ${item(this.carry.item).name}` : 'Store room',
      action: this.carry ? 'deposit' : null,
      x: st.x, z: st.z, panel: 'storage'
    }, dist2(p.x, p.z, st.x, st.z + 1.6), REACH.storage);

    this.layout.machines.forEach((slot, i) => {
      const machine = loc.machines[i];
      const d = dist2(p.x, p.z, slot.stand.x, slot.stand.z);
      let label = 'Build a machine';
      let action = null;
      if (machine) {
        const out = sim.machineOutputCount(machine);
        if (out > 0) { label = 'Collect goods'; action = 'collect'; }
        else if (machine.queue.length) label = `${MACHINES[machine.type].name} working`;
        else label = `Use the ${MACHINES[machine.type].name}`;
      }
      consider({ kind: 'machine', index: i, label, action, x: slot.x, z: slot.z, panel: 'machine' }, d, REACH.machine);
    });

    this.layout.pens.forEach((pen, i) => {
      const data = loc.pens[i];
      const d = dist2(p.x, p.z, pen.x, pen.z);
      let label = 'Buy an animal';
      let action = null;
      if (data && data.animal) {
        if (data.ready > 0) { label = `Collect ${item(ANIMALS[data.animal].item).name}`; action = 'collectpen'; }
        else if (data.feed < 0.4) { label = 'Feed the animals'; action = 'feed'; }
        else label = `${ANIMALS[data.animal].name} pen`;
      }
      consider({ kind: 'pen', index: i, label, action, x: pen.x, z: pen.z, panel: 'animals' }, d, REACH.pen);
    });

    if (this.state.vehicles.length) {
      const dock = this.layout.dock;
      consider({
        kind: 'dock', index: 0, label: 'Order supplies', action: null,
        x: dock.x, z: dock.z, panel: 'supply'
      }, dist2(p.x, p.z, dock.x, dock.z), REACH.dock);
    }

    return best;
  }

  /** The big round button, and the space bar. */
  doPrimary() {
    this.audio.unlock();
    if (this.actionCooldown > 0) return;
    const near = this.nearby;
    if (!near) return;
    if (!near.action) {
      if (this.hooks.onOpenPanel && near.panel) this.hooks.onOpenPanel(near.panel, near.index);
      return;
    }
    const speed = actionSpeed(this.state);
    switch (near.action) {
      case 'plant': this.actPlant(near.index, speed); break;
      case 'water': this.actWater(near.index, speed); break;
      case 'harvest': this.actHarvest(near.index, speed); break;
      case 'stock': this.actStock(near.index, speed); break;
      case 'deposit': this.actDeposit(speed); break;
      case 'collect': this.actCollectMachine(near.index, speed); break;
      case 'collectpen': this.actCollectPen(near.index, speed); break;
      case 'feed': this.actFeed(near.index, speed); break;
      case 'opentill': this.actOpenTill(near.index); break;
      case 'serve': this.actServe(near.index); break;
      default: break;
    }
  }

  fail(msg) {
    if (!msg) return;
    this.audio.play('error');
    this.notify(msg, 'warn');
  }

  faceTarget(near) {
    if (!near) return;
    this.player.yaw = Math.atan2(near.x - this.player.x, near.z - this.player.z);
  }

  actPlant(index, speed) {
    const crop = this.preferredCrop();
    if (!crop) return;
    const res = sim.plant(this, index, crop);
    if (!res.ok) { this.fail(res.msg); return; }
    const plot = this.layout.plots[index];
    this.faceTarget(plot);
    this.player.setAction('plant', 0.7 / speed);
    this.actionCooldown = 0.5 / speed;
    this.audio.play('plant');
    this.fx.burst(plot.x, 0.4, plot.z, '#8a6a44', 5, { scale: 0.6, life: 0.5, vy: 2 });
    this.fx.label(`-$${res.cost}`, plot.x, 1.2, plot.z, 'spend');
  }

  actWater(index, speed) {
    const res = sim.water(this, index);
    if (!res.ok) { this.fail(res.msg); return; }
    const plot = this.layout.plots[index];
    this.faceTarget(plot);
    this.player.setAction('water', 0.8 / speed);
    this.actionCooldown = (0.55 / speed) * (1 - (this.state.upgrades.watering || 0) * 0.1);
    this.audio.play('water');
    this.fx.splash(plot.x, 0.7, plot.z, 10);
  }

  actHarvest(index, speed) {
    const res = sim.harvest(this, index);
    if (!res.ok) { this.fail(res.msg); return; }
    const put = sim.pickUp(this, res.item, res.amount);
    const plot = this.layout.plots[index];
    this.faceTarget(plot);
    this.player.setAction('harvest', 0.75 / speed);
    this.actionCooldown = 0.55 / speed;
    this.audio.play('harvest');
    this.fx.burst(plot.x, 0.6, plot.z, item(res.item).color, 8, { mesh: 'cube' });
    if (put.ok && put.left > 0) {
      const stored = sim.addStock(this.state, res.item, put.left);
      this.fx.label(`+${res.amount} (${stored} to store room)`, plot.x, 1.6, plot.z, 'item');
    } else if (!put.ok) {
      const stored = sim.addStock(this.state, res.item, res.amount);
      this.fx.label(stored ? `+${stored} to store room` : 'Nowhere to put it', plot.x, 1.6, plot.z, stored ? 'item' : 'sad');
    } else {
      this.fx.label(`+${res.amount} ${item(res.item).name}`, plot.x, 1.6, plot.z, 'item');
    }
  }

  actStock(index, speed) {
    const res = sim.stockShelf(this, index);
    if (!res.ok) { this.fail(res.msg); return; }
    const shelf = this.layout.shelves[index];
    this.faceTarget(shelf);
    this.player.setAction('stock', 0.7 / speed);
    this.actionCooldown = 0.45 / speed;
    this.audio.play('stock');
    this.fx.label(`+${res.amount} on the shelf`, shelf.x, 2.4, shelf.z, 'item');
    this.fx.burst(shelf.x, 1.5, shelf.z, '#ffffff', 4, { scale: 0.4, life: 0.4, vy: 1.6 });
  }

  actDeposit(speed) {
    const res = sim.depositCarry(this);
    if (!res.ok) { this.fail(res.msg); return; }
    this.player.setAction('stock', 0.6 / speed);
    this.actionCooldown = 0.4 / speed;
    this.audio.play('stock');
    this.fx.label(`${res.amount} ${item(res.item).name} stored`, this.layout.storage.x, 2.4, this.layout.storage.z, 'item');
  }

  actCollectMachine(index, speed) {
    const res = sim.collectMachine(this, index);
    if (!res.ok) { this.fail(res.msg); return; }
    const put = sim.pickUp(this, res.item, res.amount);
    const slot = this.layout.machines[index];
    if (!put.ok || put.left > 0) sim.addStock(this.state, res.item, put.ok ? put.left : res.amount);
    this.faceTarget(slot);
    this.player.setAction('stock', 0.6 / speed);
    this.actionCooldown = 0.4 / speed;
    this.audio.play('pickup');
    this.fx.label(`+${res.amount} ${item(res.item).name}`, slot.x, 2.4, slot.z, 'item');
  }

  actCollectPen(index, speed) {
    const res = sim.collectAnimal(this, index);
    if (!res.ok) { this.fail(res.msg); return; }
    const put = sim.pickUp(this, res.item, res.amount);
    if (!put.ok || put.left > 0) sim.addStock(this.state, res.item, put.ok ? put.left : res.amount);
    const pen = this.layout.pens[index];
    this.faceTarget(pen);
    this.player.setAction('harvest', 0.7 / speed);
    this.actionCooldown = 0.45 / speed;
    this.audio.play('pickup');
    this.fx.burst(pen.x, 1, pen.z, item(res.item).color, 6);
    this.fx.label(`+${res.amount} ${item(res.item).name}`, pen.x, 1.8, pen.z, 'item');
  }

  actFeed(index, speed) {
    const res = sim.feedAnimals(this, index);
    if (!res.ok) { this.fail(res.msg); return; }
    const pen = this.layout.pens[index];
    this.faceTarget(pen);
    this.player.setAction('feed', 0.8 / speed);
    this.actionCooldown = 0.5 / speed;
    this.audio.play('plant');
    this.fx.label(`-$${res.cost}`, pen.x, 1.8, pen.z, 'spend');
  }

  actOpenTill(index) {
    const res = sim.openCheckout(this, index);
    if (!res.ok) { this.fail(res.msg); return; }
    this.audio.play('upgrade');
    this.rebuild();
    this.notify(`Till ${index + 1} is open.`, 'info');
  }

  actServe(index) {
    // Standing at the till is the action; this just nudges the queue along.
    const till = this.layout.checkouts[index];
    this.player.x = till.x;
    this.player.z = till.z - 1.2;
    this.player.yaw = Math.PI;
    this.player.setAction('till', 0.6);
    this.actionCooldown = 0.3;
  }

  handleTap(clientX, clientY) {
    this.audio.unlock();
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
    const hit = this.camera.screenToGround(nx, ny, rect.width / rect.height);
    if (!hit) return;
    this.walkTarget = hit;
    this.fx.spawn({
      x: hit.x, y: 0.3, z: hit.z, mesh: 'ring', color: '#ffffff',
      scale: 0.6, life: 0.5, vy: 0, gravity: 0, spin: 0
    });
  }

  // ---- Player-facing helpers used by the interface ----------------------
  setLook(look) {
    this.state.player.look = { ...this.state.player.look, ...look };
    this.player.look = this.state.player.look;
    saveGame(this.state);
  }

  travel(locationId) {
    const res = meta.travelTo(this, locationId);
    if (!res.ok) return res;
    this.customers.reset();
    this.staff.workers = [];
    this.carry = null;
    this.rebuild(true);
    this.audio.playTheme(this.locationDef().theme);
    this.audio.play('unlock');
    this.fx.confetti(this.player.x, 2, this.player.z, 30);
    saveGame(this.state, true);
    return res;
  }

  unlockLocation(id) {
    const res = meta.unlockLocation(this, id);
    if (res.ok) {
      this.audio.play('unlock');
      saveGame(this.state, true);
    }
    return res;
  }

  expandStore() {
    const res = sim.upgradeStage(this);
    if (!res.ok) return res;
    this.audio.play('build');
    this.camera.shake = 1.2;
    this.rebuild();
    this.fx.confetti(0, 4, this.layout.store.halfD, 60);
    this.notify(`The store is now a ${res.expansion.name}.`, 'level');
    saveGame(this.state, true);
    return res;
  }

  buildMachine(slot, machineId) {
    const res = sim.buildMachine(this, slot, machineId);
    if (res.ok) {
      this.audio.play('build');
      this.rebuild();
      const pad = this.layout.machines[slot];
      this.fx.confetti(pad.x, 2.5, pad.z, 24);
      this.camera.shake = 0.6;
    }
    return res;
  }

  buyAnimal(pen, animalId) {
    const res = sim.buyAnimal(this, pen, animalId);
    if (res.ok) {
      this.audio.play('build');
      this.rebuild();
      this.herd.sync(this.layout, currentLocation(this.state).pens);
    }
    return res;
  }

  assignShelf(index, itemId) {
    const res = sim.assignShelf(this, index, itemId);
    if (res.ok) {
      this.audio.play('click');
      this.rebuild();
    }
    return res;
  }

  buyUpgrade(id) {
    const res = sim.buyUpgrade(this, id);
    if (res.ok) {
      this.audio.play('upgrade');
      this.fx.sparkle(this.player.x, 2, this.player.z, '#f6cd45', 12);
      if (id === 'decor' || id === 'selfcheck') this.rebuild();
    }
    return res;
  }

  hire(type) {
    const res = sim.hireStaff(this, type);
    if (res.ok) {
      this.audio.play('reward');
      this.staff.sync();
    }
    return res;
  }

  buyVehicle(id) {
    const res = sim.buyVehicle(this, id);
    if (res.ok) {
      this.audio.play('truck');
      this.rebuild();
    }
    return res;
  }

  // ---- Drawing ---------------------------------------------------------
  render() {
    const r = this.renderer;
    r.beginFrame(this.camera);
    r.draw(this.world.ground, null);
    r.draw(this.world.structure, null);
    r.draw(this.world.detail, null);
    // The roof lifts off while the player is in the shop, so the aisles,
    // the shelves and the queue at the till stay in view.
    const s = this.layout.store;
    const inside = this.player.x > -s.halfW - 1 && this.player.x < s.halfW + 1
      && this.player.z > -s.halfD - 1 && this.player.z < s.halfD + 2.5;
    this.roofFade = clamp((this.roofFade ?? 1) + (inside ? -1 : 1) * (1 / 0.25) * 0.016, 0, 1);
    if (this.roofFade > 0.02) {
      if (this.roofFade > 0.98) {
        r.draw(this.world.roof, null);
      } else {
        r.beginTransparent();
        r.draw(this.world.roof, null, null, this.roofFade);
        r.endTransparent();
      }
    }
    this.drawCrops();
    this.drawShelfGoods();
    this.drawMachineState();
    this.drawVehicles();
    this.herd.draw(r, this.meshes.animal, this.meshes.char.shadow);
    this.customers.draw(r, this.meshes.char, this.camera);
    this.staff.draw(r, this.meshes.char, this.camera);
    this.player.draw(r, this.meshes.char, 1);
    this.drawMarkers();
    this.fx.draw(r);
    this.fx.layout(r);
  }

  drawCrops() {
    const r = this.renderer;
    const loc = currentLocation(this.state);
    const meshes = this.meshes.crop;
    const t = this.time;
    for (let i = 0; i < loc.plots.length; i += 1) {
      const data = loc.plots[i];
      const plot = this.layout.plots[i];
      if (!data || !plot || !data.crop) continue;
      const def = CROPS[data.crop];
      const stage = sim.plotStage(data);
      const thirsty = data.water <= 0.15;
      const growth = clamp(0.25 + (data.t / def.grow) * 0.85, 0.25, 1.1);
      const plantColor = thirsty ? mixHex(item(def.item).accent, '#8a7a3a', 0.55) : item(def.item).accent;
      const positions = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
      const count = stage <= 0 ? 2 : 4;
      for (let k = 0; k < count; k += 1) {
        const ox = positions[k][0] * 0.52;
        const oz = positions[k][1] * 0.52;
        const sway = Math.sin(t * 1.6 + i + k) * (thirsty ? 0.02 : 0.05);
        if (stage <= 1) {
          r.draw(meshes.sprout, {
            x: plot.x + ox, y: 0.18, z: plot.z + oz, rz: sway,
            s: (stage === 0 ? 0.7 : 1.1) * (0.8 + growth * 0.3)
          }, rgb(plantColor));
          continue;
        }
        const form = def.form;
        const mesh = meshes[form === 'bush' ? 'bush' : form === 'tuft' ? 'tuft' : form === 'tall' ? 'tall'
          : form === 'vine' ? 'vine' : form === 'cactus' ? 'cactus' : 'ground'];
        r.draw(mesh, {
          x: plot.x + ox, y: 0.18, z: plot.z + oz, rz: sway + (thirsty ? 0.16 : 0),
          s: growth * (stage >= 3 ? 1 : 0.8)
        }, rgb(plantColor));
        if (data.ready) {
          const bob = Math.sin(t * 3 + k) * 0.03;
          r.draw(meshes.fruit, {
            x: plot.x + ox + 0.12, y: 0.18 + def.height * 0.75 + bob, z: plot.z + oz,
            s: 1 + Math.sin(t * 4 + k) * 0.05
          }, rgb(item(def.item).color), 1, 0.08);
        }
      }
    }
  }

  drawShelfGoods() {
    const r = this.renderer;
    const loc = currentLocation(this.state);
    const cap = shelfCapacity(this.state);
    for (let i = 0; i < loc.shelves.length; i += 1) {
      const shelf = loc.shelves[i];
      const slot = this.layout.shelves[i];
      if (!shelf || !slot || !shelf.item || shelf.count <= 0) continue;
      const def = item(shelf.item);
      const mesh = this.meshes.product[def.shape] || this.meshes.product.box;
      const fill = clamp(shelf.count / cap, 0, 1);
      const perTier = 5;
      const total = Math.max(1, Math.round(fill * perTier * 3));
      const color = rgb(def.color);
      for (let n = 0; n < total; n += 1) {
        const tier = Math.floor(n / perTier);
        const slotIndex = n % perTier;
        const x = slot.x - 0.95 + slotIndex * 0.48;
        const y = 0.6 + tier * 0.5;
        const z = slot.z + (n % 2 ? 0.12 : -0.12);
        r.draw(mesh, { x, y, z, ry: (n * 0.7) % 1.4 }, color);
      }
    }
  }

  drawMachineState() {
    const r = this.renderer;
    const loc = currentLocation(this.state);
    for (let i = 0; i < loc.machines.length; i += 1) {
      const machine = loc.machines[i];
      const slot = this.layout.machines[i];
      if (!machine || !slot) continue;
      // Goods waiting in the output tray.
      const out = Object.entries(machine.out || {});
      let n = 0;
      out.forEach(([id, count]) => {
        const mesh = this.meshes.product[item(id).shape] || this.meshes.product.box;
        const show = Math.min(6, count);
        for (let k = 0; k < show; k += 1) {
          r.draw(mesh, {
            x: slot.x - 0.6 + ((n + k) % 4) * 0.4,
            y: 0.7 + Math.floor(((n + k) % 8) / 4) * 0.3,
            z: slot.z + 1.5
          }, rgb(item(id).color));
        }
        n += show;
      });
      // A little smoke while it is running.
      if (machine.queue.length && Math.random() < 0.08) {
        this.fx.spawn({
          x: slot.x + 0.9, y: 3.1, z: slot.z - 0.4, mesh: 'cube', color: '#e8eef2',
          scale: rand(0.8, 1.6), life: 1.1, vy: 1.2, vx: rand(-0.2, 0.2), vz: rand(-0.2, 0.2), gravity: 0.6
        });
      }
    }
  }

  drawVehicles() {
    const r = this.renderer;
    // A car appears in the car park for roughly every four shoppers inside.
    const shoppers = this.customers.count;
    const cars = Math.min(this.parkedCars.length, Math.ceil(shoppers / 4));
    for (let i = 0; i < cars; i += 1) {
      const c = this.parkedCars[i];
      r.draw(this.meshes.vehicle.car, { x: c.x, y: 0, z: c.z, ry: 0 }, rgb(c.color));
    }
    if (this.state.vehicles.length) {
      const dock = this.layout.dock;
      const run = this.truckRun;
      let z = dock.z;
      let ry = Math.PI / 2;
      if (run) {
        // Out to the road and back again.
        const t = run.t / run.duration;
        const wave = t < 0.5 ? t * 2 : (1 - t) * 2;
        z = dock.z + wave * (this.layout.roadZ - dock.z);
        ry = t < 0.5 ? 0 : Math.PI;
      }
      const colour = this.state.vehicles.includes('reefer') ? '#a7d8ef'
        : this.state.vehicles.includes('cargo') ? '#c9a24a' : '#e6ecf2';
      r.draw(this.meshes.vehicle.truck, { x: dock.x + 3.4, y: 0, z, ry }, rgb(colour));
    }
  }

  /** Bouncing arrows over anything that wants attention. */
  drawMarkers() {
    const r = this.renderer;
    const loc = currentLocation(this.state);
    const bob = Math.sin(this.time * 4) * 0.12;
    r.beginTransparent();
    const marker = (x, z, y, color) => {
      r.draw(this.meshes.fx.marker, { x, y: y + bob, z, s: 1 }, rgb(color), 0.92, 0.25);
    };
    loc.plots.forEach((plot, i) => {
      if (plot.ready) marker(this.layout.plots[i].x, this.layout.plots[i].z, 1.5, '#8ff0a4');
      else if (plot.crop && plot.water <= 0.15) marker(this.layout.plots[i].x, this.layout.plots[i].z, 1.5, '#6fc0e8');
    });
    loc.pens.forEach((pen, i) => {
      if (!pen.animal) return;
      if (pen.ready > 0) marker(this.layout.pens[i].x, this.layout.pens[i].z, 2.2, '#f6cd45');
      else if (pen.feed < 0.25) marker(this.layout.pens[i].x, this.layout.pens[i].z, 2.2, '#e0693a');
    });
    loc.machines.forEach((machine, i) => {
      if (machine && sim.machineOutputCount(machine) > 0) marker(this.layout.machines[i].x, this.layout.machines[i].z, 3.2, '#f6cd45');
    });
    loc.shelves.forEach((shelf, i) => {
      if (shelf.item && shelf.count === 0) marker(this.layout.shelves[i].x, this.layout.shelves[i].z, 2.9, '#e0693a');
    });
    if (this.nearby) {
      r.draw(this.meshes.fx.ring, {
        x: this.nearby.x, y: 0.06, z: this.nearby.z,
        s: 0.8 + Math.sin(this.time * 5) * 0.05
      }, rgb('#ffffff'), 0.22);
    }
    r.endTransparent();
  }
}

export { sim, meta, UPGRADES, departmentOf, expansionFor, carryCapacity };
