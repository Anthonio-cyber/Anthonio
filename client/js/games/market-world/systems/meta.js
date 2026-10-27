// ==========================================================
// Market World - the long game.
//
// Marketing, special events, missions, achievements, daily rewards and
// the requirements that guard every new city.
// ==========================================================
import {
  CAMPAIGNS, campaignById, MARKETING_LEVELS, EVENTS, MISSIONS,
  ACHIEVEMENTS, DAILY_REWARDS
} from '../data/progress.js';
import { LOCATIONS, locationById, REQUIREMENT_LABELS } from '../data/locations.js';
import { DEPARTMENTS } from '../data/catalog.js';
import { currentLocation, newLocationState } from './state.js';
import { spend, addXp, addGems, adjustReputation } from './sim.js';
import { rand, pick } from '../engine/math.js';

// ---- Marketing ------------------------------------------------------
export function marketingBoost(g) {
  return (g.state.campaigns || []).reduce((a, c) => a + (campaignById(c.id)?.boost || 0), 0);
}

export function availableCampaigns(g) {
  return CAMPAIGNS.filter((c) => c.level <= g.state.marketingLevel);
}

export function startCampaign(g, id) {
  const def = campaignById(id);
  if (!def) return { ok: false };
  if (def.level > g.state.marketingLevel) return { ok: false, msg: 'Upgrade the marketing department first.' };
  const running = g.state.campaigns.find((c) => c.id === id);
  if (running) return { ok: false, msg: 'That campaign is already running.' };
  if (!spend(g, def.cost)) return { ok: false, msg: 'Not enough cash.' };
  g.state.campaigns.push({ id, left: def.duration, total: def.duration });
  g.state.stats.campaigns += 1;
  g.progressMission('campaign', g.state.stats.campaigns);
  addXp(g, 40 + def.level * 25);
  return { ok: true, def };
}

export function upgradeMarketing(g) {
  const next = MARKETING_LEVELS[g.state.marketingLevel];
  if (!next) return { ok: false, msg: 'Marketing is already global.' };
  if (!spend(g, next.cost)) return { ok: false, msg: 'Not enough cash.' };
  g.state.marketingLevel += 1;
  addXp(g, 120 * g.state.marketingLevel);
  return { ok: true, next };
}

export function tickCampaigns(g, dt) {
  const list = g.state.campaigns;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    list[i].left -= dt;
    if (list[i].left <= 0) {
      const def = campaignById(list[i].id);
      list.splice(i, 1);
      g.notify(`${def ? def.name : 'Campaign'} has finished. Traffic is back to normal.`, 'info');
    }
  }
}

// ---- Special events --------------------------------------------------
export const eventDef = (id) => EVENTS.find((e) => e.id === id);

export function eventTraffic(g) {
  if (!g.state.event) return 0;
  const def = eventDef(g.state.event.id);
  return def ? def.traffic : 0;
}

export function tickEvents(g, dt) {
  const s = g.state;
  if (s.event) {
    s.event.left -= dt;
    if (s.event.left <= 0) {
      const def = eventDef(s.event.id);
      s.event = null;
      s.nextEventIn = rand(240, 420);
      g.notify(`${def ? def.name : 'The event'} is over.`, 'info');
      g.onEventChange();
    }
    return;
  }
  s.nextEventIn -= dt;
  if (s.nextEventIn > 0) return;
  if (s.player.level < 4) { s.nextEventIn = 120; return; }
  const def = pick(EVENTS);
  s.event = { id: def.id, left: def.duration, total: def.duration };
  g.notify(`${def.name}! ${def.blurb}`, 'event');
  g.onEventChange();
}

// ---- Missions --------------------------------------------------------
export function currentMission(g) {
  return MISSIONS[g.state.missionIndex] || null;
}

export function missionProgress(g) {
  const m = currentMission(g);
  if (!m) return { done: 0, target: 0, pct: 1 };
  const done = g.state.missionProgress[m.id] || 0;
  const target = typeof m.target === 'number' ? m.target : 1;
  return { done, target, pct: Math.min(1, done / target) };
}

/**
 * Missions count either progress made since the mission started (harvests,
 * campaigns) or an absolute figure the player has to reach (level, stage).
 */
export function progressMission(g, type, amount) {
  const m = currentMission(g);
  if (!m || m.type !== type) return;
  const absolute = ['level', 'stage', 'rep', 'location', 'deptcount', 'hire', 'vehicle', 'campaign'].includes(type);
  const key = m.id;
  const before = g.state.missionProgress[key] || 0;
  const value = absolute ? Math.max(before, amount) : before + amount;
  g.state.missionProgress[key] = value;
  const target = typeof m.target === 'number' ? m.target : 1;
  if (value >= target) completeMission(g, m);
}

export function checkMissionState(g) {
  const m = currentMission(g);
  if (!m) return;
  const s = g.state;
  switch (m.type) {
    case 'level': progressMission(g, 'level', s.player.level); break;
    case 'stage': progressMission(g, 'stage', currentLocation(s).stage); break;
    case 'rep': progressMission(g, 'rep', currentLocation(s).reputation); break;
    case 'location': progressMission(g, 'location', s.unlocked.length); break;
    case 'deptcount': progressMission(g, 'deptcount', DEPARTMENTS.filter((d) => s.player.level >= d.level).length); break;
    case 'dept': {
      const open = DEPARTMENTS.find((d) => d.id === m.target && s.player.level >= d.level);
      if (open) completeMission(g, m);
      break;
    }
    case 'hire': progressMission(g, 'hire', currentLocation(s).staff.length); break;
    case 'vehicle': progressMission(g, 'vehicle', s.vehicles.length); break;
    default: break;
  }
}

function completeMission(g, m) {
  const s = g.state;
  if (m.cash) s.player.cash += m.cash;
  if (m.gems) s.player.gems += m.gems;
  if (m.xp) addXp(g, m.xp);
  s.missionIndex += 1;
  g.onMissionComplete(m);
  checkMissionState(g);
}

export function recordSale(g, itemId, count) {
  const m = currentMission(g);
  if (m && m.type === 'sellitem' && m.item === itemId) progressMission(g, 'sellitem', count);
}

// ---- Achievements -----------------------------------------------------
export function achievementValue(g, stat) {
  const s = g.state;
  switch (stat) {
    case 'served': return s.stats.served;
    case 'harvested': return s.stats.harvested;
    case 'stocked': return s.stats.stocked;
    case 'earned': return s.stats.earned;
    case 'produced': return s.stats.produced;
    case 'campaigns': return s.stats.campaigns;
    case 'level': return s.player.level;
    case 'locations': return s.unlocked.length;
    case 'staff': return Object.values(s.locations).reduce((a, l) => a + l.staff.length, 0);
    case 'reputation': return currentLocation(s).reputation;
    default: return 0;
  }
}

export function checkAchievements(g) {
  ACHIEVEMENTS.forEach((a) => {
    if (g.state.achievements.includes(a.id)) return;
    if (achievementValue(g, a.stat) >= a.target) {
      g.state.achievements.push(a.id);
      addGems(g, a.gems);
      g.onAchievement(a);
    }
  });
}

// ---- Daily rewards -----------------------------------------------------
const DAY = 24 * 60 * 60 * 1000;

export function dailyStatus(g) {
  const d = g.state.daily;
  const now = Date.now();
  const last = d.lastClaim || 0;
  const days = last ? Math.floor((startOfDay(now) - startOfDay(last)) / DAY) : Infinity;
  return {
    ready: days >= 1,
    day: days === 1 || days === Infinity ? Math.min(7, (d.day % 7) + 1) : Math.min(7, (d.day % 7) + 1),
    streakBroken: days > 1 && Number.isFinite(days)
  };
}

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function claimDaily(g) {
  const status = dailyStatus(g);
  if (!status.ready) return { ok: false, msg: 'Come back tomorrow for the next reward.' };
  const dayIndex = status.streakBroken ? 0 : g.state.daily.day % 7;
  const reward = DAILY_REWARDS[dayIndex];
  const s = g.state;
  if (reward.cash) s.player.cash += reward.cash;
  if (reward.gems) s.player.gems += reward.gems;
  if (reward.token) s.player.tokens += reward.token;
  if (reward.seeds) {
    // Seed packs are handed over as free stock of the cheapest crops.
    s.seeds.free = (s.seeds.free || 0) + reward.seeds;
  }
  s.daily.day = dayIndex + 1;
  s.daily.lastClaim = Date.now();
  return { ok: true, reward, day: dayIndex + 1 };
}

// ---- Locations ----------------------------------------------------------
export function requirementRows(g, location) {
  const req = location.requires;
  if (!req) return [];
  const s = g.state;
  const rows = [];
  Object.entries(req).forEach(([key, value]) => {
    let have = 0;
    switch (key) {
      case 'storeLevel': have = s.player.level; break;
      case 'cash': have = s.player.cash; break;
      case 'served': have = s.stats.served; break;
      case 'reputation': have = Math.max(...Object.values(s.locations).map((l) => l.reputation)); break;
      case 'department': have = DEPARTMENTS.find((d) => d.id === value && s.player.level >= d.level) ? value : '-'; break;
      case 'departments': have = DEPARTMENTS.filter((d) => s.player.level >= d.level).length; break;
      case 'locations': have = s.unlocked.length; break;
      default: have = 0;
    }
    const met = key === 'department' ? have === value : have >= value;
    rows.push({
      key,
      label: REQUIREMENT_LABELS[key] ? REQUIREMENT_LABELS[key](value) : `${key}: ${value}`,
      met,
      have,
      need: value
    });
  });
  return rows;
}

export function canUnlock(g, locationId) {
  const loc = locationById(locationId);
  return requirementRows(g, loc).every((r) => r.met);
}

export function unlockLocation(g, locationId) {
  const s = g.state;
  if (s.unlocked.includes(locationId)) return { ok: false, msg: 'Already open.' };
  const loc = locationById(locationId);
  if (!canUnlock(g, locationId)) return { ok: false, msg: 'You have not met the requirements yet.' };
  // The cash requirement is also the price of the land.
  const price = loc.requires && loc.requires.cash ? Math.round(loc.requires.cash * 0.6) : 0;
  if (price && !spend(g, price)) return { ok: false, msg: 'Not enough cash left to buy the land.' };
  s.unlocked.push(locationId);
  s.locations[locationId] = newLocationState(locationId);
  addXp(g, 2000);
  adjustReputation(g, 0.1);
  g.progressMission('location', s.unlocked.length);
  return { ok: true, loc, price };
}

export function travelTo(g, locationId) {
  const s = g.state;
  if (!s.unlocked.includes(locationId)) return { ok: false, msg: 'That location is locked.' };
  if (s.location === locationId) return { ok: false, msg: 'You are already here.' };
  s.location = locationId;
  if (!s.locations[locationId]) s.locations[locationId] = newLocationState(locationId);
  return { ok: true, loc: locationById(locationId) };
}

export { LOCATIONS, MISSIONS, ACHIEVEMENTS, DAILY_REWARDS, CAMPAIGNS, MARKETING_LEVELS, EVENTS };
