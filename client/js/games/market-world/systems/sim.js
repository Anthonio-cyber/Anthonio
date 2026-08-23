// ==========================================================
// Market World - the simulation.
//
// Growing, feeding, producing, stocking and selling. Everything the
// player can do by hand lives here as a plain function, which is what
// lets the staff do exactly the same jobs later on without a second
// implementation drifting out of step.
// ==========================================================
import {
  CROPS, ANIMALS, MACHINES, RECIPES, item, departmentOf, STORAGE_TIERS
} from '../data/catalog.js';
import { UPGRADES, xpForLevel, LEVEL_REWARDS, STAFF_TYPES, STAFF_LEVELS, VEHICLES } from '../data/progress.js';
import { expansionFor, LOCATIONS } from '../data/locations.js';
import {
  currentLocation, addStock, takeStock, storageSpace, storageCap, storageUsed,
  carryCapacity, growthMultiplier, yieldMultiplier, machineSpeed, seedPrice,
  shelfCapacity, syncToStage, basePrice
} from './state.js';

export const recipeById = (id) => RECIPES.find((r) => r.id === id);

// ---- Money and experience ------------------------------------------
export function earn(g, amount, reason = '') {
  const value = Math.round(amount);
  g.state.player.cash += value;
  g.state.stats.earned += Math.max(0, value);
  if (reason) g.bump(reason);
  return value;
}

export function spend(g, amount) {
  if (g.state.player.cash < amount) return false;
  g.state.player.cash -= Math.round(amount);
  g.state.stats.spent += Math.round(amount);
  return true;
}

export function addXp(g, amount) {
  const p = g.state.player;
  p.xp += Math.round(amount);
  let levelled = false;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level += 1;
    levelled = true;
    const reward = LEVEL_REWARDS[p.level];
    if (reward) {
      if (reward.cash) p.cash += reward.cash;
      if (reward.gems) p.gems += reward.gems;
    }
    g.onLevelUp(p.level, reward);
  }
  return levelled;
}

export function addGems(g, n) {
  g.state.player.gems += n;
}

export function spendGems(g, n) {
  if (g.state.player.gems < n) return false;
  g.state.player.gems -= n;
  return true;
}

/** Gems buy time, never anything you could not earn by playing. */
export function rushMachine(g, slotIndex) {
  const loc = currentLocation(g.state);
  const machine = loc.machines[slotIndex];
  if (!machine || !machine.queue.length) return { ok: false, msg: 'Nothing is being made here.' };
  if (!spendGems(g, 2)) return { ok: false, msg: 'You need 2 gems for that.' };
  machine.queue.forEach((job) => { job.t = job.total; });
  return { ok: true };
}

export function rushField(g) {
  const loc = currentLocation(g.state);
  const growing = loc.plots.filter((p) => p.crop && !p.ready);
  if (!growing.length) return { ok: false, msg: 'Nothing is growing out there.' };
  if (!spendGems(g, 5)) return { ok: false, msg: 'You need 5 gems for that.' };
  growing.forEach((p) => { p.water = 1; p.t = CROPS[p.crop].grow; p.ready = true; });
  return { ok: true, count: growing.length };
}

export function exchangeGems(g, count = 1) {
  if (!spendGems(g, count)) return { ok: false, msg: 'Not enough gems.' };
  const cash = count * 2500;
  earn(g, cash);
  return { ok: true, cash };
}

// ---- Farming --------------------------------------------------------
export function plotState(plot) {
  if (!plot.crop) return 'empty';
  if (plot.ready) return 'ready';
  if (plot.water <= 0.02) return 'thirsty';
  return 'growing';
}

/** 0 to 4: seed, sprout, young, mature, harvestable. */
export function plotStage(plot) {
  if (!plot.crop) return -1;
  if (plot.ready) return 4;
  const def = CROPS[plot.crop];
  const t = plot.t / def.grow;
  if (t < 0.12) return 0;
  if (t < 0.4) return 1;
  if (t < 0.72) return 2;
  return 3;
}

export function canPlant(g, cropId) {
  const price = seedPrice(g.state, cropId);
  return g.state.player.cash >= price;
}

export function plant(g, index, cropId) {
  const loc = currentLocation(g.state);
  const plot = loc.plots[index];
  if (!plot || plot.crop) return { ok: false, msg: 'That plot is already planted.' };
  if (g.state.player.level < CROPS[cropId].unlock) return { ok: false, msg: 'That seed is not unlocked yet.' };
  const price = seedPrice(g.state, cropId);
  if (!spend(g, price)) return { ok: false, msg: 'Not enough cash for seeds.' };
  plot.crop = cropId;
  plot.t = 0;
  plot.water = 1;
  plot.ready = false;
  g.state.stats.planted += 1;
  g.progressMission('plant', 1);
  addXp(g, 2);
  return { ok: true, cost: price };
}

export function water(g, index) {
  const loc = currentLocation(g.state);
  const plot = loc.plots[index];
  if (!plot || !plot.crop || plot.ready) return { ok: false, msg: 'Nothing here needs water.' };
  if (plot.water > 0.85) return { ok: false, msg: 'That plant has plenty of water.' };
  plot.water = 1;
  g.state.stats.watered += 1;
  g.progressMission('water', 1);
  addXp(g, 1);
  return { ok: true };
}

export function harvest(g, index) {
  const loc = currentLocation(g.state);
  const plot = loc.plots[index];
  if (!plot || !plot.crop || !plot.ready) return { ok: false, msg: 'That crop is not ready yet.' };
  const def = CROPS[plot.crop];
  const amount = Math.max(1, Math.round(def.yield * yieldMultiplier(g.state)));
  const cropId = plot.crop;
  plot.crop = null; plot.t = 0; plot.water = 0; plot.ready = false;
  g.state.stats.harvested += amount;
  g.progressMission('harvest', amount);
  addXp(g, 5 + amount * 2);
  return { ok: true, item: def.item, amount, cropId };
}

export function tickFarm(g, dt) {
  const s = g.state;
  const loc = currentLocation(s);
  const growMul = growthMultiplier(s);
  const sprinklers = (s.upgrades.sprinkler || 0) * 4;   // plots kept wet on their own
  const harvesters = (s.upgrades.harvester || 0) * 3;
  let autoHarvested = 0;
  for (let i = 0; i < loc.plots.length; i += 1) {
    const plot = loc.plots[i];
    if (!plot.crop) continue;
    const def = CROPS[plot.crop];
    if (i < sprinklers) plot.water = 1;
    if (plot.ready) {
      if (i < harvesters && autoHarvested < 2) {
        const res = harvest(g, i);
        if (res.ok) {
          const stored = addStock(s, res.item, res.amount);
          if (stored > 0) g.onAutoHarvest(i, res.item, stored);
          autoHarvested += 1;
        }
      }
      continue;
    }
    const thirsty = plot.water <= 0.02;
    plot.t += dt * growMul * (thirsty ? 0.2 : 1);
    // Moisture is used up over the crop's life, once per "water" requirement.
    plot.water = Math.max(0, plot.water - dt / (def.grow / Math.max(1, def.water)));
    if (plot.t >= def.grow) { plot.ready = true; plot.t = def.grow; g.onCropReady(i); }
  }
}

// ---- Animals --------------------------------------------------------
export function buyAnimal(g, penIndex, animalId) {
  const loc = currentLocation(g.state);
  const pen = loc.pens[penIndex];
  if (!pen) return { ok: false, msg: 'No pen there.' };
  if (pen.animal) return { ok: false, msg: 'That pen is taken.' };
  const def = ANIMALS[animalId];
  if (g.state.player.level < def.unlock) return { ok: false, msg: `${def.name}s unlock at level ${def.unlock}.` };
  if (!spend(g, def.cost)) return { ok: false, msg: 'Not enough cash.' };
  pen.animal = animalId;
  pen.feed = 1;
  pen.t = 0;
  pen.ready = 0;
  return { ok: true };
}

export function feedAnimals(g, penIndex) {
  const loc = currentLocation(g.state);
  const pen = loc.pens[penIndex];
  if (!pen || !pen.animal) return { ok: false, msg: 'Nothing to feed.' };
  if (pen.feed > 0.8) return { ok: false, msg: 'They are not hungry yet.' };
  const cost = ANIMALS[pen.animal].feed;
  if (!spend(g, cost)) return { ok: false, msg: 'Not enough cash for feed.' };
  pen.feed = 1;
  addXp(g, 2);
  return { ok: true, cost };
}

export function collectAnimal(g, penIndex) {
  const loc = currentLocation(g.state);
  const pen = loc.pens[penIndex];
  if (!pen || !pen.animal || pen.ready <= 0) return { ok: false, msg: 'Nothing to collect yet.' };
  const def = ANIMALS[pen.animal];
  const amount = pen.ready;
  pen.ready = 0;
  g.state.stats.collected += amount;
  g.progressMission('collect', amount);
  addXp(g, 2 + amount);
  return { ok: true, item: def.item, amount };
}

export function tickAnimals(g, dt) {
  const loc = currentLocation(g.state);
  loc.pens.forEach((pen, i) => {
    if (!pen.animal) return;
    const def = ANIMALS[pen.animal];
    pen.feed = Math.max(0, pen.feed - dt / (def.interval * 2.2));
    if (pen.feed <= 0.02) return;         // hungry animals stop producing
    if (pen.ready >= def.amount * 3) return;
    pen.t += dt;
    if (pen.t >= def.interval) {
      pen.t = 0;
      pen.ready += def.amount;
      g.onAnimalReady(i);
    }
  });
}

// ---- Processing -----------------------------------------------------
export function buildMachine(g, slotIndex, machineId) {
  const s = g.state;
  const loc = currentLocation(s);
  const exp = expansionFor(loc.stage);
  if (slotIndex >= exp.machineSlots) return { ok: false, msg: 'Expand the store for another machine pad.' };
  if (loc.machines[slotIndex]) return { ok: false, msg: 'That pad already has a machine.' };
  const def = MACHINES[machineId];
  if (s.player.level < def.unlock) return { ok: false, msg: `${def.name} unlocks at level ${def.unlock}.` };
  if (!spend(g, def.cost)) return { ok: false, msg: 'Not enough cash.' };
  loc.machines[slotIndex] = { type: machineId, queue: [], out: {} };
  g.progressMission('machine', 1);
  addXp(g, 60);
  return { ok: true, def };
}

export function startRecipe(g, slotIndex, recipeId) {
  const s = g.state;
  const loc = currentLocation(s);
  const machine = loc.machines[slotIndex];
  if (!machine) return { ok: false, msg: 'No machine there.' };
  const recipe = recipeById(recipeId);
  if (!recipe || recipe.machine !== machine.type) return { ok: false, msg: 'That machine cannot make this.' };
  if (recipe.unlock && s.player.level < recipe.unlock) return { ok: false, msg: 'Not unlocked yet.' };
  const slots = MACHINES[machine.type].slots;
  if (machine.queue.length >= slots) return { ok: false, msg: 'That machine is busy.' };
  const missing = Object.entries(recipe.inputs).find(([id, n]) => (loc.storage[id] || 0) < n);
  if (missing) return { ok: false, msg: `Not enough ${item(missing[0]).name} in the store room.` };
  Object.entries(recipe.inputs).forEach(([id, n]) => takeStock(s, id, n));
  machine.queue.push({ recipe: recipeId, t: 0, total: recipe.time });
  return { ok: true, recipe };
}

export function collectMachine(g, slotIndex) {
  const loc = currentLocation(g.state);
  const machine = loc.machines[slotIndex];
  if (!machine) return { ok: false, msg: 'No machine there.' };
  const entries = Object.entries(machine.out).filter(([, n]) => n > 0);
  if (!entries.length) return { ok: false, msg: 'Nothing ready to collect.' };
  const [id, count] = entries[0];
  machine.out[id] -= count;
  if (machine.out[id] <= 0) delete machine.out[id];
  return { ok: true, item: id, amount: count };
}

export function machineOutputCount(machine) {
  return Object.values(machine.out || {}).reduce((a, b) => a + b, 0);
}

export function tickMachines(g, dt) {
  const s = g.state;
  const loc = currentLocation(s);
  const speed = machineSpeed(s);
  loc.machines.forEach((machine, i) => {
    if (!machine || !machine.queue.length) return;
    const job = machine.queue[0];
    job.t += dt * speed;
    if (job.t < job.total) return;
    const recipe = recipeById(job.recipe);
    machine.queue.shift();
    if (!recipe) return;
    if (machineOutputCount(machine) >= 40) {
      // The tray is full: the goods wait in the machine rather than vanish.
      machine.queue.unshift({ ...job, t: job.total });
      return;
    }
    machine.out[recipe.output] = (machine.out[recipe.output] || 0) + recipe.amount;
    s.stats.produced += recipe.amount;
    g.progressMission('produce', recipe.amount);
    addXp(g, 4 + recipe.amount);
    g.onProduced(i, recipe.output, recipe.amount);
  });
}

// ---- Carrying and the store room -------------------------------------
export function carryCount(g) {
  return g.carry ? g.carry.count : 0;
}

export function carryRoom(g) {
  return carryCapacity(g.state) - carryCount(g);
}

export function pickUp(g, id, amount) {
  if (g.carry && g.carry.item !== id) return { ok: false, msg: `Your hands are full of ${item(g.carry.item).name}.` };
  const room = carryRoom(g);
  if (room <= 0) return { ok: false, msg: 'You cannot carry any more.' };
  const taken = Math.min(room, amount);
  g.carry = { item: id, count: (g.carry ? g.carry.count : 0) + taken };
  return { ok: true, taken, left: amount - taken };
}

export function depositCarry(g) {
  if (!g.carry) return { ok: false, msg: 'You are not carrying anything.' };
  const stored = addStock(g.state, g.carry.item, g.carry.count);
  if (stored <= 0) return { ok: false, msg: 'The store room is full. Upgrade it or sell some stock.' };
  const id = g.carry.item;
  g.carry.count -= stored;
  if (g.carry.count <= 0) g.carry = null;
  return { ok: true, item: id, amount: stored };
}

export function withdraw(g, id, amount) {
  const room = carryRoom(g);
  if (room <= 0) return { ok: false, msg: 'You cannot carry any more.' };
  if (g.carry && g.carry.item !== id) return { ok: false, msg: 'Put down what you are carrying first.' };
  const want = Math.min(room, amount);
  const taken = takeStock(g.state, id, want);
  if (taken <= 0) return { ok: false, msg: `No ${item(id).name} in the store room.` };
  g.carry = { item: id, count: (g.carry ? g.carry.count : 0) + taken };
  return { ok: true, amount: taken };
}

// ---- Shelves ---------------------------------------------------------
export function shelfSpace(g, index) {
  const loc = currentLocation(g.state);
  const shelf = loc.shelves[index];
  if (!shelf || !shelf.item) return 0;
  return Math.max(0, shelfCapacity(g.state) - shelf.count);
}

export function assignShelf(g, index, itemId) {
  const loc = currentLocation(g.state);
  const shelf = loc.shelves[index];
  if (!shelf) return { ok: false, msg: 'No shelf there.' };
  if (shelf.count > 0 && shelf.item !== itemId) {
    // Whatever was on the shelf goes back to the store room.
    addStock(g.state, shelf.item, shelf.count);
    shelf.count = 0;
  }
  shelf.item = itemId;
  return { ok: true };
}

/** Fills a shelf from whatever the player is carrying. */
export function stockShelf(g, index) {
  const loc = currentLocation(g.state);
  const shelf = loc.shelves[index];
  if (!shelf) return { ok: false, msg: 'No shelf there.' };
  if (!shelf.item) return { ok: false, msg: 'Choose what this shelf sells first.' };
  if (!g.carry || g.carry.item !== shelf.item) {
    // Try the store room instead, if the player is standing empty handed.
    const space = shelfSpace(g, index);
    if (space <= 0) return { ok: false, msg: 'That shelf is full.' };
    const pulled = takeStock(g.state, shelf.item, space);
    if (pulled <= 0) return { ok: false, msg: `Fetch some ${item(shelf.item).name} first.` };
    shelf.count += pulled;
    g.state.stats.stocked += pulled;
    g.progressMission('stock', pulled);
    addXp(g, pulled);
    return { ok: true, amount: pulled, fromStore: true };
  }
  const space = shelfSpace(g, index);
  if (space <= 0) return { ok: false, msg: 'That shelf is full.' };
  const moved = Math.min(space, g.carry.count);
  shelf.count += moved;
  g.carry.count -= moved;
  if (g.carry.count <= 0) g.carry = null;
  g.state.stats.stocked += moved;
  g.progressMission('stock', moved);
  addXp(g, moved);
  return { ok: true, amount: moved };
}

export function shelvesWithItem(g, itemId) {
  const loc = currentLocation(g.state);
  const out = [];
  loc.shelves.forEach((s, i) => { if (s.item === itemId && s.count > 0) out.push(i); });
  return out;
}

// ---- Buying stock in ---------------------------------------------------
export function wholesaleCost(g, id, count) {
  const def = item(id);
  const unit = def.cost || Math.round(def.value * 0.45);
  // Running your own vehicles cuts what the supplier charges to deliver.
  return Math.round(unit * count * (1 - fleetDiscount(g.state)));
}

export function buyWholesale(g, id, count) {
  const def = item(id);
  if (def.kind !== 'supplied') return { ok: false, msg: 'You have to make that one yourself.' };
  const space = storageSpace(g.state);
  if (space <= 0) return { ok: false, msg: 'The store room is full.' };
  const amount = Math.min(count, space);
  const cost = wholesaleCost(g, id, amount);
  if (!spend(g, cost)) return { ok: false, msg: 'Not enough cash.' };
  addStock(g.state, id, amount);
  return { ok: true, amount, cost };
}

// ---- Expansions, storage and staff --------------------------------------
export function upgradeStage(g) {
  const s = g.state;
  const loc = currentLocation(s);
  const next = expansionFor(loc.stage + 1);
  if (loc.stage >= 5) return { ok: false, msg: 'This store is already a Mega Market.' };
  if (s.player.level < next.level) return { ok: false, msg: `Reach level ${next.level} first.` };
  if (!spend(g, next.cost)) return { ok: false, msg: 'Not enough cash for the building work.' };
  loc.stage += 1;
  syncToStage(loc);
  g.progressMission('stage', loc.stage);
  addXp(g, 400 * loc.stage);
  return { ok: true, expansion: next };
}

export function upgradeStorage(g) {
  const s = g.state;
  const loc = currentLocation(s);
  const next = STORAGE_TIERS[loc.storageTier + 1];
  if (!next) return { ok: false, msg: 'The distribution centre is the largest there is.' };
  if (!spend(g, next.cost)) return { ok: false, msg: 'Not enough cash.' };
  loc.storageTier += 1;
  addXp(g, 80);
  return { ok: true, tier: next };
}

export function buyUpgrade(g, id) {
  const s = g.state;
  const def = UPGRADES[id];
  const level = s.upgrades[id] || 0;
  if (level >= def.max) return { ok: false, msg: 'Already at the top level.' };
  if (s.player.level < def.unlock) return { ok: false, msg: `Unlocks at level ${def.unlock}.` };
  const cost = Math.round(def.base * Math.pow(def.scale, level));
  if (!spend(g, cost)) return { ok: false, msg: 'Not enough cash.' };
  s.upgrades[id] = level + 1;
  g.progressMission('upgrade', 1);
  addXp(g, 30 + level * 20);
  return { ok: true, level: level + 1, cost };
}

export function hireStaff(g, type) {
  const s = g.state;
  const loc = currentLocation(s);
  const exp = expansionFor(loc.stage);
  const def = STAFF_TYPES[type];
  if (s.player.level < def.unlock) return { ok: false, msg: `${def.name}s unlock at level ${def.unlock}.` };
  if (loc.staff.length >= exp.staffSlots) return { ok: false, msg: 'No room for more staff. Expand the store.' };
  if (!spend(g, def.hire)) return { ok: false, msg: 'Not enough cash to hire.' };
  const member = {
    id: `${type}-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`,
    type,
    level: 1,
    name: def.name
  };
  loc.staff.push(member);
  s.stats.hires += 1;
  g.progressMission('hire', loc.staff.length);
  addXp(g, 40);
  return { ok: true, member };
}

export function upgradeStaff(g, staffId) {
  const loc = currentLocation(g.state);
  const member = loc.staff.find((m) => m.id === staffId);
  if (!member) return { ok: false, msg: 'That worker has left.' };
  const next = STAFF_LEVELS[member.level];
  if (!next) return { ok: false, msg: 'Already fully trained.' };
  if (!spend(g, next.cost)) return { ok: false, msg: 'Not enough cash.' };
  member.level += 1;
  addXp(g, 25 * member.level);
  return { ok: true, level: member.level };
}

export function fireStaff(g, staffId) {
  const loc = currentLocation(g.state);
  const idx = loc.staff.findIndex((m) => m.id === staffId);
  if (idx < 0) return { ok: false };
  loc.staff.splice(idx, 1);
  return { ok: true };
}

export function salaryPerMinute(g) {
  const loc = currentLocation(g.state);
  return loc.staff.reduce((sum, m) => sum + STAFF_TYPES[m.type].salary * (1 + (m.level - 1) * 0.35), 0);
}

export function buyVehicle(g, id) {
  const s = g.state;
  const def = VEHICLES.find((v) => v.id === id);
  if (!def) return { ok: false };
  if (s.vehicles.includes(id)) return { ok: false, msg: 'You already run one of those.' };
  if (s.player.level < def.unlock) return { ok: false, msg: `Unlocks at level ${def.unlock}.` };
  if (!spend(g, def.cost)) return { ok: false, msg: 'Not enough cash.' };
  s.vehicles.push(id);
  g.progressMission('vehicle', s.vehicles.length);
  addXp(g, 120);
  return { ok: true, def };
}

// ---- Delivery runs ---------------------------------------------------
export function fleet(s) {
  return (s.vehicles || []).map((id) => VEHICLES.find((v) => v.id === id)).filter(Boolean);
}

export function fleetDiscount(s) {
  return Math.min(0.2, fleet(s).length * 0.05);
}

/**
 * Owned vehicles run a round trip on their own: farm and yard to the
 * warehouse, warehouse to the shop. It is what turns a pile of finished
 * goods behind the building into stock the shelves can actually use.
 */
export function tickDelivery(g, dt) {
  const s = g.state;
  const list = fleet(s);
  if (!list.length) return;
  const best = list.reduce((a, b) => (b.capacity > a.capacity ? b : a));
  g.deliveryTimer = (g.deliveryTimer ?? 20) - dt * best.speed;
  if (g.deliveryTimer > 0) return;
  g.deliveryTimer = 42;
  const loc = currentLocation(s);
  let space = Math.min(best.capacity, storageSpace(s));
  let moved = 0;
  loc.machines.forEach((machine) => {
    if (!machine || space <= 0) return;
    Object.keys(machine.out || {}).forEach((id) => {
      if (space <= 0) return;
      const take = Math.min(machine.out[id], space);
      machine.out[id] -= take;
      if (machine.out[id] <= 0) delete machine.out[id];
      addStock(s, id, take);
      space -= take;
      moved += take;
    });
  });
  loc.pens.forEach((pen) => {
    if (!pen.animal || pen.ready <= 0 || space <= 0) return;
    const take = Math.min(pen.ready, space);
    pen.ready -= take;
    addStock(s, ANIMALS[pen.animal].item, take);
    space -= take;
    moved += take;
  });
  if (moved > 0) g.onDelivery(moved);
}

export function openCheckout(g, index) {
  const loc = currentLocation(g.state);
  const exp = expansionFor(loc.stage);
  if (index >= exp.checkouts) return { ok: false, msg: 'Expand the store for another till.' };
  loc.checkoutsOpen = Math.max(loc.checkoutsOpen, index + 1);
  return { ok: true };
}

// ---- Prices, demand and reputation --------------------------------------
export function demandFor(g, itemId) {
  const s = g.state;
  let demand = 1;
  const dept = departmentOf(itemId);
  if (s.event) {
    const ev = g.eventDef(s.event.id);
    if (ev && dept && ev.demand[dept.id]) demand += ev.demand[dept.id];
  }
  const loc = LOCATIONS.find((l) => l.id === s.location);
  if (loc) {
    if (loc.specials.includes(itemId)) demand += 0.35;
    if (loc.drinkBonus && dept && dept.id === 'drinks') demand += loc.drinkBonus;
    if (loc.dairyBonus && dept && dept.id === 'dairy') demand += loc.dairyBonus;
  }
  return demand;
}

export function sellPrice(g, itemId) {
  const base = basePrice(g.state, itemId);
  let price = base * (0.9 + 0.25 * Math.min(2, demandFor(g, itemId)));
  if (g.state.event) {
    const ev = g.eventDef(g.state.event.id);
    if (ev && ev.priceMul) price *= ev.priceMul;
  }
  return Math.max(1, Math.round(price));
}

export function reputationStars(g) {
  return currentLocation(g.state).reputation;
}

export function adjustReputation(g, delta) {
  const loc = currentLocation(g.state);
  loc.reputation = Math.max(0.5, Math.min(5, loc.reputation + delta));
}

/** 0-100 shopper satisfaction, worked out from the state of the shop. */
export function satisfaction(g) {
  const s = g.state;
  const loc = currentLocation(s);
  const exp = expansionFor(loc.stage);
  const stocked = loc.shelves.filter((sh) => sh.item && sh.count > 0).length;
  const usable = Math.max(1, loc.shelves.filter((sh) => sh.item).length);
  const availability = stocked / usable;                       // 0..1
  // Variety counts different products, not departments: a well stocked
  // greengrocer should still feel like a good shop to walk into.
  const distinct = new Set(loc.shelves.filter((sh) => sh.item && sh.count > 0).map((sh) => sh.item)).size;
  const variety = Math.min(1, distinct / 6);
  const queueLoad = Math.min(1, g.averageQueue() / 5);
  const cleanliness = 1 - Math.min(1, loc.dirt / 100);
  const space = Math.min(1, exp.shelves / 12);
  const staffing = Math.min(1, loc.staff.length / Math.max(1, exp.staffSlots * 0.6));
  const score = availability * 34 + variety * 14 + (1 - queueLoad) * 22
    + cleanliness * 12 + space * 8 + staffing * 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function tickReputation(g, dt) {
  const loc = currentLocation(g.state);
  const target = 0.5 + (satisfaction(g) / 100) * 4.5;
  // Reputation is quicker to earn than to lose, so one bad patch while
  // the shelves are empty does not undo an hour of good work.
  const rate = target > loc.reputation ? 0.05 : 0.018;
  loc.reputation += (target - loc.reputation) * Math.min(1, dt * rate);
  // Mess builds up while people shop, and cleaners work it back down.
  const cleaners = loc.staff.filter((m) => m.type === 'cleaner').length;
  const robots = (g.state.upgrades.cleaning || 0) * UPGRADES.cleaning.per;
  loc.dirt = Math.max(0, loc.dirt - dt * (cleaners * 2.2 + robots * 1.5));
}

export function payrollTick(g, dt) {
  const perMinute = salaryPerMinute(g);
  if (perMinute <= 0) return;
  g.wageBucket = (g.wageBucket || 0) + (perMinute / 60) * dt;
  if (g.wageBucket >= 1) {
    const due = Math.floor(g.wageBucket);
    g.wageBucket -= due;
    g.state.player.cash = Math.max(0, g.state.player.cash - due);
    g.state.stats.spent += due;
  }
}

export { storageCap, storageUsed, storageSpace, currentLocation, item, addStock, takeStock, machineSpeed, carryCapacity, shelfCapacity };
