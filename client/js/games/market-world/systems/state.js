// ==========================================================
// Market World - the save game.
//
// One plain object holds the entire business empire. It is written to
// localStorage a few seconds after anything changes, and the shape is
// deliberately JSON-only so the same payload could later be posted to a
// server for cloud saves without touching this file.
// ==========================================================
import { CROPS, ANIMALS, MACHINES, DEPARTMENTS, STORAGE_TIERS, item } from '../data/catalog.js';
import { LOCATIONS, EXPANSIONS, expansionFor } from '../data/locations.js';
import { UPGRADES, xpForLevel, STAFF_LEVELS } from '../data/progress.js';

export const SAVE_KEY = 'mw-save-v1';
export const SAVE_VERSION = 1;

const SKIN_TONES = ['#f3d0b0', '#e8b98d', '#c98d5f', '#9c6438', '#6d4326', '#4a2d1a'];
const HAIR_COLORS = ['#2b2018', '#5a3a20', '#a5642a', '#d8b45c', '#8f4a3a', '#3f5f8f', '#c04a7a', '#e8e8e8'];
const CLOTH_COLORS = ['#e05a3a', '#4f8fd0', '#6f9f4a', '#d0a83a', '#7f5fd0', '#d0688f', '#3f4a5c', '#f2f2f2', '#2f7d6a', '#c9622a'];

export const LOOK_OPTIONS = {
  skin: SKIN_TONES,
  hair: HAIR_COLORS,
  hairStyle: ['short', 'bun', 'curls', 'ponytail', 'braids', 'cap'],
  shirt: CLOTH_COLORS,
  pants: CLOTH_COLORS,
  shoes: ['#3a3a3a', '#f2f2f2', '#c04a2a', '#2f5f8f', '#d0a83a', '#6f4a2a'],
  accessory: ['none', 'cap', 'glasses', 'headband', 'apron', 'backpack']
};

function emptyPlots(count) {
  return Array.from({ length: count }, () => ({ crop: null, t: 0, water: 0, ready: false }));
}

function emptyPens(count) {
  return Array.from({ length: count }, () => ({ animal: null, feed: 0, t: 0, ready: 0 }));
}

function emptyShelves(count) {
  const shelves = [];
  for (let i = 0; i < count; i += 1) {
    shelves.push({ item: i < 3 ? DEPARTMENTS[0].products[i] : null, count: 0, price: 1 });
  }
  return shelves;
}

export function newLocationState(locationId) {
  const exp = expansionFor(1);
  return {
    id: locationId,
    stage: 1,
    plots: emptyPlots(exp.plots),
    pens: emptyPens(exp.pens),
    machines: [],
    shelves: emptyShelves(exp.shelves),
    storageTier: 0,
    storage: {},
    staff: [],
    checkoutsOpen: 1,
    reputation: 3.5,
    served: 0,
    revenue: 0,
    dirt: 0,
    seenIntro: false
  };
}

export function newGame(name = 'Owner') {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    played: 0,
    player: {
      name,
      level: 1,
      xp: 0,
      cash: 350,
      gems: 5,
      tokens: 0,
      look: {
        skin: SKIN_TONES[1],
        hair: HAIR_COLORS[0],
        hairStyle: 'short',
        shirt: CLOTH_COLORS[0],
        pants: CLOTH_COLORS[6],
        shoes: '#3a3a3a',
        accessory: 'none'
      }
    },
    stats: {
      planted: 0, watered: 0, harvested: 0, stocked: 0, served: 0,
      earned: 0, spent: 0, produced: 0, campaigns: 0, collected: 0, hires: 0
    },
    location: 'sunny',
    unlocked: ['sunny'],
    locations: { sunny: newLocationState('sunny') },
    upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
    marketingLevel: 1,
    campaigns: [],
    event: null,
    nextEventIn: 220,
    missionIndex: 0,
    missionProgress: {},
    achievements: [],
    vehicles: [],
    daily: { day: 0, lastClaim: 0 },
    seeds: {},
    settings: { music: true, sfx: true, quality: 1 },
    tutorialStep: 0
  };
}

// ---- Save and load -------------------------------------------------
export function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return null;              // private browsing, or storage switched off
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return repair(data);
  } catch (err) {
    return null;
  }
}

let saveTimer = null;
export function saveGame(state, immediate = false) {
  const write = () => {
    try {
      state.lastSeen = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (err) {
      /* Out of space or storage blocked. The game carries on regardless. */
    }
    saveTimer = null;
  };
  if (immediate) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    write();
    return;
  }
  if (saveTimer) return;
  saveTimer = setTimeout(write, 2500);
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* nothing to do */ }
}

/** Fills in anything a future version might be missing, so a save never crashes the game. */
function repair(state) {
  const base = newGame();
  const merged = { ...base, ...state };
  merged.player = { ...base.player, ...(state.player || {}) };
  merged.player.look = { ...base.player.look, ...((state.player || {}).look || {}) };
  merged.stats = { ...base.stats, ...(state.stats || {}) };
  merged.settings = { ...base.settings, ...(state.settings || {}) };
  merged.upgrades = { ...base.upgrades, ...(state.upgrades || {}) };
  merged.daily = { ...base.daily, ...(state.daily || {}) };
  merged.locations = merged.locations || {};
  if (!merged.locations[merged.location]) merged.locations[merged.location] = newLocationState(merged.location);
  Object.keys(merged.locations).forEach((id) => {
    const fresh = newLocationState(id);
    const loc = { ...fresh, ...merged.locations[id] };
    loc.plots = Array.isArray(loc.plots) ? loc.plots : fresh.plots;
    loc.shelves = Array.isArray(loc.shelves) ? loc.shelves : fresh.shelves;
    loc.pens = Array.isArray(loc.pens) ? loc.pens : fresh.pens;
    loc.machines = Array.isArray(loc.machines) ? loc.machines : [];
    loc.staff = Array.isArray(loc.staff) ? loc.staff : [];
    loc.storage = loc.storage || {};
    merged.locations[id] = loc;
    syncToStage(loc);
  });
  if (!Array.isArray(merged.unlocked) || !merged.unlocked.length) merged.unlocked = ['sunny'];
  return merged;
}

/** Makes the arrays match whatever the building has been expanded to. */
export function syncToStage(loc) {
  const exp = expansionFor(loc.stage);
  while (loc.plots.length < exp.plots) loc.plots.push({ crop: null, t: 0, water: 0, ready: false });
  while (loc.pens.length < exp.pens) loc.pens.push({ animal: null, feed: 0, t: 0, ready: 0 });
  while (loc.shelves.length < exp.shelves) loc.shelves.push({ item: null, count: 0, price: 1 });
  loc.plots.length = exp.plots;
  loc.pens.length = exp.pens;
  loc.shelves.length = exp.shelves;
  loc.checkoutsOpen = Math.min(loc.checkoutsOpen || 1, exp.checkouts);
}

// ---- Handy readers used all over the game ---------------------------
export const currentLocation = (s) => s.locations[s.location];
export const expansion = (s) => expansionFor(currentLocation(s).stage);
export const upgradeLevel = (s, id) => s.upgrades[id] || 0;

export function upgradeValue(s, id) {
  const u = UPGRADES[id];
  return (s.upgrades[id] || 0) * u.per;
}

export function storageCap(s) {
  const loc = currentLocation(s);
  return STORAGE_TIERS[Math.min(loc.storageTier, STORAGE_TIERS.length - 1)].cap;
}

export function storageUsed(s) {
  const loc = currentLocation(s);
  return Object.values(loc.storage).reduce((a, b) => a + b, 0);
}

export function storageSpace(s) {
  return Math.max(0, storageCap(s) - storageUsed(s));
}

/** Adds to the store room, returning how many actually fitted. */
export function addStock(s, id, count) {
  const loc = currentLocation(s);
  const room = storageSpace(s);
  const taken = Math.max(0, Math.min(count, room));
  if (taken > 0) loc.storage[id] = (loc.storage[id] || 0) + taken;
  return taken;
}

export function takeStock(s, id, count) {
  const loc = currentLocation(s);
  const have = loc.storage[id] || 0;
  const taken = Math.min(have, count);
  if (taken <= 0) return 0;
  loc.storage[id] = have - taken;
  if (loc.storage[id] <= 0) delete loc.storage[id];
  return taken;
}

export function stockOf(s, id) {
  return currentLocation(s).storage[id] || 0;
}

export function shelfCapacity(s) {
  return 24 + (s.upgrades.shelfsize || 0) * UPGRADES.shelfsize.per;
}

export function carryCapacity(s) {
  return 6 + (s.upgrades.carry || 0) * UPGRADES.carry.per;
}

export function walkSpeed(s) {
  return 4.6 * (1 + (s.upgrades.boots || 0) * UPGRADES.boots.per);
}

export function actionSpeed(s) {
  return 1 + (s.upgrades.hands || 0) * UPGRADES.hands.per;
}

export function growthMultiplier(s) {
  const loc = LOCATIONS.find((l) => l.id === s.location);
  return (1 + (s.upgrades.growth || 0) * UPGRADES.growth.per) * (1 + (loc?.farmBonus || 0));
}

export function yieldMultiplier(s) {
  return 1 + (s.upgrades.yield || 0) * UPGRADES.yield.per;
}

export function machineSpeed(s) {
  return 1 + (s.upgrades.machines || 0) * UPGRADES.machines.per;
}

export function checkoutSpeed(s) {
  return 1 + (s.upgrades.till || 0) * UPGRADES.till.per;
}

export function seedPrice(s, cropId) {
  const base = CROPS[cropId].seed;
  return Math.max(1, Math.round(base * (1 - (s.upgrades.seeds || 0) * UPGRADES.seeds.per)));
}

export function staffStats(member) {
  const lv = STAFF_LEVELS[Math.min(member.level, STAFF_LEVELS.length) - 1];
  return lv;
}

export function unlockedDepartments(s) {
  return DEPARTMENTS.filter((d) => s.player.level >= d.level);
}

export function departmentOpen(s, id) {
  const d = DEPARTMENTS.find((x) => x.id === id);
  return !!d && s.player.level >= d.level;
}

export function availableProducts(s) {
  const out = [];
  unlockedDepartments(s).forEach((d) => d.products.forEach((p) => out.push(p)));
  return out;
}

export function availableCrops(s) {
  return Object.keys(CROPS).filter((id) => s.player.level >= CROPS[id].unlock);
}

export function availableAnimals(s) {
  return Object.keys(ANIMALS).filter((id) => s.player.level >= ANIMALS[id].unlock);
}

export function availableMachines(s) {
  return Object.keys(MACHINES).filter((id) => s.player.level >= MACHINES[id].unlock);
}

/** What one unit sells for here and now, before demand is applied. */
export function basePrice(s, id) {
  const loc = LOCATIONS.find((l) => l.id === s.location);
  const mul = loc ? loc.priceMul : 1;
  const special = loc && loc.specials.includes(id) ? 1.2 : 1;
  return Math.max(1, Math.round(item(id).value * mul * special));
}

export function levelProgress(s) {
  const need = xpForLevel(s.player.level);
  return { xp: s.player.xp, need, pct: Math.min(1, s.player.xp / need) };
}

export const EXPANSION_LIST = EXPANSIONS;
