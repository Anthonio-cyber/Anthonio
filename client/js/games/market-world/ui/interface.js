// ==========================================================
// Market World - the interface.
//
// Builds the heads-up display and every panel, and talks to the game
// through its public methods. Everything is thumb-sized, and every
// screen answers the same question: what can I do next, and what does
// it cost?
// ==========================================================
import {
  CROPS, ANIMALS, MACHINES, DEPARTMENTS, STORAGE_TIERS, ITEMS,
  item, recipesFor, departmentOf
} from '../data/catalog.js';
import { LOCATIONS, EXPANSIONS, expansionFor, locationById } from '../data/locations.js';
import {
  UPGRADES, upgradeCost, STAFF_TYPES, STAFF_LEVELS, CAMPAIGNS, MARKETING_LEVELS,
  MISSIONS, ACHIEVEMENTS, DAILY_REWARDS, VEHICLES
} from '../data/progress.js';
import {
  currentLocation, storageCap, storageUsed, availableCrops, shelfCapacity,
  levelProgress, seedPrice, LOOK_OPTIONS, clearSave, saveGame, carryCapacity
} from '../systems/state.js';
import * as sim from '../systems/sim.js';
import * as meta from '../systems/meta.js';

const money = (n) => `$${Math.round(n).toLocaleString()}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v) => `${Math.round(v * 100)}%`;
const timeLeft = (s) => {
  const total = Math.max(0, Math.round(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m ? `${m}m ${sec}s` : `${sec}s`;
};

const ITEM_ICON = {
  crop: '🌱', animal: '🥚', processed: '🏭', supplied: '📦'
};

const NAV = [
  { id: 'farm', icon: '🌱', label: 'Farm' },
  { id: 'store', icon: '🏪', label: 'Store' },
  { id: 'staff', icon: '👷', label: 'Staff' },
  { id: 'marketing', icon: '📢', label: 'Ads' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'more', icon: '☰', label: 'More' }
];

export function createInterface(root, game) {
  const dom = document.createElement('div');
  dom.className = 'mw-hud';
  dom.innerHTML = `
    <div class="mw-top">
      <div class="mw-chip mw-levelbox">
        <div style="display:flex;justify-content:space-between;width:100%">
          <span data-el="level">Level 1</span><small data-el="xp">0/0</small>
        </div>
        <div class="mw-xpbar"><span data-el="xpfill"></span></div>
      </div>
      <div class="mw-wallet">
        <span class="mw-chip mw-cash">💵 <span data-el="cash">0</span></span>
        <span class="mw-chip mw-gems">💎 <span data-el="gems">0</span></span>
      </div>
    </div>

    <div class="mw-mission" data-el="mission" hidden>
      <b data-el="mission-text"></b>
      <div class="mw-xpbar"><span data-el="mission-fill"></span></div>
      <small data-el="mission-progress"></small>
    </div>

    <div class="mw-stats">
      <span class="mw-chip" data-el="rep">⭐ 3.5</span>
      <span class="mw-chip" data-el="happy">😊 0%</span>
      <span class="mw-chip" data-el="where">Sunny Valley</span>
    </div>

    <div class="mw-event" data-el="events"></div>

    <div class="mw-prompt" data-el="prompt"></div>

    <div class="mw-side-btns">
      <button class="mw-round" data-el="btn-missions" title="Missions">🎯</button>
      <button class="mw-round" data-el="btn-daily" title="Daily reward">🎁</button>
      <button class="mw-round" data-el="btn-full" title="Full screen">⛶</button>
    </div>

    <div class="mw-stick" data-el="stick"><span class="mw-knob" data-el="knob"></span></div>
    <button class="mw-action" data-el="action">Walk up to something</button>

    <div class="mw-carry" data-el="carry">
      <span class="mw-swatch" data-el="carry-color"></span>
      <span data-el="carry-text"></span>
    </div>

    <nav class="mw-nav">
      ${NAV.map((n) => `<button data-nav="${n.id}"><span>${n.icon}</span><span>${n.label}</span></button>`).join('')}
    </nav>`;
  root.appendChild(dom);

  const sheet = document.createElement('div');
  sheet.className = 'mw-sheet';
  sheet.innerHTML = `
    <div class="mw-sheet-head">
      <div><h3 data-el="sheet-title">Panel</h3><p data-el="sheet-sub"></p></div>
      <button class="mw-close" data-close>✕</button>
    </div>
    <div class="mw-tabs" data-el="tabs" hidden></div>
    <div class="mw-sheet-body" data-el="sheet-body"></div>`;
  root.appendChild(sheet);

  const toasts = document.createElement('div');
  toasts.className = 'mw-toasts';
  root.appendChild(toasts);

  const $ = (name, scope = dom) => scope.querySelector(`[data-el="${name}"]`);
  const body = $('sheet-body', sheet);
  const tabsBar = $('tabs', sheet);

  game.input.attachStick($('stick'), $('knob'));

  let openPanel = null;
  let openIndex = 0;
  let openTab = null;

  // ---- Toasts -----------------------------------------------------
  function toast(text, kind = 'info') {
    const el = document.createElement('div');
    el.className = 'mw-toast';
    el.dataset.kind = kind;
    el.textContent = text;
    toasts.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 320);
    }, kind === 'warn' ? 2200 : 3400);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }

  function result(res, okText) {
    if (!res) return;
    if (res.ok) { if (okText) toast(okText, 'info'); }
    else if (res.msg) toast(res.msg, 'warn');
    refresh();
  }

  // ---- Panels ------------------------------------------------------
  function setPanel(name, index = 0, tab = null) {
    if (openPanel === name && openIndex === index && sheet.classList.contains('is-open') && !tab) {
      closePanel();
      return;
    }
    openPanel = name;
    openIndex = index;
    openTab = tab || defaultTab(name);
    sheet.classList.add('is-open');
    root.classList.add('mw-panel-open');
    game.audio.play('click');
    renderPanel();
    dom.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('is-open', b.dataset.nav === name));
  }

  function closePanel() {
    openPanel = null;
    sheet.classList.remove('is-open');
    root.classList.remove('mw-panel-open');
    dom.querySelectorAll('[data-nav]').forEach((b) => b.classList.remove('is-open'));
  }

  function defaultTab(name) {
    if (name === 'farm') return 'plant';
    if (name === 'store') return 'shelves';
    if (name === 'more') return 'missions';
    if (name === 'storage') return 'stock';
    return null;
  }

  const PANELS = {
    farm: panelFarm, animals: panelAnimals, machine: panelMachine, shelf: panelShelf,
    storage: panelStorage, store: panelStore, staff: panelStaff, marketing: panelMarketing,
    map: panelMap, upgrades: panelUpgrades, more: panelMore, supply: panelSupply
  };

  function renderPanel() {
    if (!openPanel) return;
    const fn = PANELS[openPanel];
    if (!fn) { closePanel(); return; }
    const out = fn();
    sheet.querySelector('[data-el="sheet-title"]').textContent = out.title;
    sheet.querySelector('[data-el="sheet-sub"]').textContent = out.sub || '';
    if (out.tabs && out.tabs.length) {
      tabsBar.hidden = false;
      tabsBar.innerHTML = out.tabs.map((t) => `<button data-tab="${t.id}" class="${t.id === openTab ? 'is-on' : ''}">${esc(t.label)}</button>`).join('');
    } else {
      tabsBar.hidden = true;
      tabsBar.innerHTML = '';
    }
    body.innerHTML = out.html;
    body.scrollTop = out.keepScroll ? body.scrollTop : 0;
  }

  // ---- Farm --------------------------------------------------------
  function panelFarm() {
    const s = game.state;
    const loc = currentLocation(s);
    const crops = availableCrops(s);
    const tabs = [
      { id: 'plant', label: 'Seeds' },
      { id: 'plots', label: 'Field' },
      { id: 'upgrades', label: 'Farm upgrades' }
    ];
    let html = '';
    if (openTab === 'plant') {
      html += '<p class="mw-note">Pick the seed you want to sow. Walk up to a plot and press the big button to plant it.</p>';
      html += '<div class="mw-grid">';
      Object.entries(CROPS).forEach(([id, def]) => {
        const locked = s.player.level < def.unlock;
        const on = game.selectedCrop === id;
        html += `<button class="mw-tile ${on ? 'is-on' : ''} ${locked ? 'is-locked' : ''}" data-crop="${id}" ${locked ? 'disabled' : ''}>
          <b>${esc(def.name)}</b>
          <span>${locked ? `Level ${def.unlock}` : `${money(seedPrice(s, id))} a seed`}</span>
          <span>${def.grow}s · ${def.yield} per plot</span>
          <span>Sells for ${money(sim.sellPrice(game, def.item))}</span>
        </button>`;
      });
      html += '</div>';
      void crops;
    } else if (openTab === 'plots') {
      const ready = loc.plots.filter((p) => p.ready).length;
      const dry = loc.plots.filter((p) => p.crop && p.water < 0.25).length;
      const empty = loc.plots.filter((p) => !p.crop).length;
      html += `<div class="mw-card"><div class="mw-icon">🌾</div><div class="mw-body">
        <h4>${loc.plots.length} plots</h4>
        <p>${ready} ready to harvest · ${dry} thirsty · ${empty} empty</p></div>
        <button class="mw-btn sm gold" data-rush-field>💎 5 Ripen all</button></div>`;
      html += '<div class="mw-list" style="margin-top:.6rem">';
      loc.plots.forEach((plot, i) => {
        const def = plot.crop ? CROPS[plot.crop] : null;
        const state = sim.plotState(plot);
        const grow = def ? Math.min(1, plot.t / def.grow) : 0;
        html += `<div class="mw-card"><div class="mw-icon">${plot.crop ? '🌿' : '⬜'}</div><div class="mw-body">
          <h4>Plot ${i + 1} · ${def ? esc(def.name) : 'Empty'}</h4>
          <div class="mw-bar ${state === 'thirsty' ? 'warn' : ''}"><span style="width:${pct(grow)}"></span></div>
          <div class="mw-meta"><span>${state === 'ready' ? 'Ready' : state === 'thirsty' ? 'Needs water' : state === 'empty' ? 'Nothing planted' : `Growing ${pct(grow)}`}</span>
          ${def ? `<span>💧 ${pct(plot.water)}</span>` : ''}</div>
        </div></div>`;
      });
      html += '</div>';
    } else {
      html += upgradeList('farm');
    }
    return { title: 'The Farm', sub: `${loc.plots.length} plots · store room ${storageUsed(s)}/${storageCap(s)}`, tabs, html };
  }

  // ---- Animals -----------------------------------------------------
  function panelAnimals() {
    const s = game.state;
    const loc = currentLocation(s);
    let html = '';
    if (!loc.pens.length) {
      html = '<div class="mw-empty">Expand the store to a Small Grocery to open the animal pens.</div>';
      return { title: 'Animals', sub: 'No pens yet', html };
    }
    html += '<div class="mw-list">';
    loc.pens.forEach((pen, i) => {
      if (pen.animal) {
        const def = ANIMALS[pen.animal];
        html += `<div class="mw-card"><div class="mw-icon">${pen.animal === 'chicken' ? '🐔' : pen.animal === 'cow' ? '🐄' : pen.animal === 'goat' ? '🐐' : '🐑'}</div>
          <div class="mw-body"><h4>Pen ${i + 1} · ${esc(def.name)}</h4>
          <p>Makes ${esc(item(def.item).name)} every ${def.interval}s</p>
          <div class="mw-bar ${pen.feed < 0.3 ? 'warn' : ''}"><span style="width:${pct(pen.feed)}"></span></div>
          <div class="mw-meta"><span>Ready: ${pen.ready}</span><span>Feed ${pct(pen.feed)}</span></div></div>
          <div style="display:flex;flex-direction:column;gap:.3rem">
          <button class="mw-btn sm" data-feed="${i}" ${pen.feed > 0.8 ? 'disabled' : ''}>Feed ${money(def.feed)}</button>
          <button class="mw-btn sm blue" data-collect-pen="${i}" ${pen.ready <= 0 ? 'disabled' : ''}>Collect</button></div></div>`;
      } else {
        html += `<div class="mw-card"><div class="mw-icon">➕</div><div class="mw-body">
          <h4>Pen ${i + 1} · empty</h4><p>Buy an animal to live here.</p>
          <div class="mw-grid" style="margin-top:.4rem">
          ${Object.entries(ANIMALS).map(([id, def]) => {
    const locked = s.player.level < def.unlock;
    return `<button class="mw-tile ${locked ? 'is-locked' : ''}" data-buy-animal="${id}" data-pen="${i}" ${locked ? 'disabled' : ''}>
              <b>${esc(def.name)}</b><span>${locked ? `Level ${def.unlock}` : money(def.cost)}</span>
              <span>${esc(item(def.item).name)}</span></button>`;
  }).join('')}
          </div></div></div>`;
      }
    });
    html += '</div>';
    return { title: 'Animals', sub: `${loc.pens.filter((p) => p.animal).length} of ${loc.pens.length} pens in use`, html };
  }

  // ---- Machines -----------------------------------------------------
  function panelMachine() {
    const s = game.state;
    const loc = currentLocation(s);
    const slot = openIndex;
    const machine = loc.machines[slot];
    let html = '';
    if (!machine) {
      html += '<p class="mw-note">Pick a machine for this pad. It gets built right there in the yard behind the shop.</p><div class="mw-grid">';
      Object.entries(MACHINES).forEach(([id, def]) => {
        const locked = s.player.level < def.unlock;
        const poor = s.player.cash < def.cost;
        html += `<button class="mw-tile ${locked ? 'is-locked' : ''}" data-build-machine="${id}" ${locked ? 'disabled' : ''}>
          <b>${esc(def.name)}</b><span>${locked ? `Level ${def.unlock}` : money(def.cost)}</span>
          <span>${recipesFor(id).length} recipes${poor && !locked ? ' · too costly' : ''}</span></button>`;
      });
      html += '</div>';
      return { title: `Machine pad ${slot + 1}`, sub: 'Nothing built here yet', html };
    }
    const def = MACHINES[machine.type];
    html += `<div class="mw-card"><div class="mw-icon">🏭</div><div class="mw-body"><h4>${esc(def.name)}</h4>
      <p>${machine.queue.length} of ${def.slots} slots busy · ${sim.machineOutputCount(machine)} finished goods waiting</p></div></div>`;
    if (machine.queue.length) {
      html += '<div class="mw-list" style="margin-top:.5rem">';
      machine.queue.forEach((job) => {
        const recipe = sim.recipeById(job.recipe);
        html += `<div class="mw-card"><div class="mw-icon">⏳</div><div class="mw-body">
          <h4>${esc(item(recipe.output).name)}</h4>
          <div class="mw-bar blue"><span style="width:${pct(job.t / job.total)}"></span></div>
          <div class="mw-meta"><span>${timeLeft((job.total - job.t) / sim.machineSpeed(game.state))} left</span></div></div></div>`;
      });
      html += '</div>';
    }
    html += '<p class="mw-note">Recipes take what they need from the store room.</p><div class="mw-list">';
    recipesFor(machine.type).forEach((recipe) => {
      const locked = recipe.unlock && s.player.level < recipe.unlock;
      const missing = Object.entries(recipe.inputs).filter(([id, n]) => (loc.storage[id] || 0) < n);
      html += `<div class="mw-card ${locked ? 'is-locked' : ''}"><div class="mw-icon">${ITEM_ICON[item(recipe.output).kind] || '📦'}</div>
        <div class="mw-body"><h4>${recipe.amount} × ${esc(item(recipe.output).name)}</h4>
        <p>${Object.entries(recipe.inputs).map(([id, n]) => `${n} ${esc(item(id).name)} (${loc.storage[id] || 0})`).join(' + ')}</p>
        <div class="mw-meta"><span>${recipe.time}s</span><span>Sells for ${money(sim.sellPrice(game, recipe.output))} each</span></div></div>
        <button class="mw-btn sm" data-recipe="${recipe.id}" ${locked || missing.length ? 'disabled' : ''}>Make</button></div>`;
    });
    html += '</div>';
    if (machine.queue.length) {
      html += `<button class="mw-btn gold" style="margin-top:.6rem;width:100%" data-rush-machine="${slot}">💎 2 · Finish this batch now</button>`;
    }
    if (sim.machineOutputCount(machine) > 0) {
      html += `<button class="mw-btn blue" style="margin-top:.6rem;width:100%" data-collect-machine="${slot}">Collect finished goods</button>`;
    }
    return { title: def.name, sub: `Machine pad ${slot + 1}`, html };
  }

  // ---- One shelf -----------------------------------------------------
  function panelShelf() {
    const s = game.state;
    const loc = currentLocation(s);
    const shelf = loc.shelves[openIndex];
    if (!shelf) return { title: 'Shelf', sub: '', html: '<div class="mw-empty">That shelf is gone.</div>' };
    const cap = shelfCapacity(s);
    let html = `<div class="mw-card"><div class="mw-icon">🛒</div><div class="mw-body">
      <h4>${shelf.item ? esc(item(shelf.item).name) : 'Nothing chosen'}</h4>
      <div class="mw-bar"><span style="width:${pct(shelf.count / cap)}"></span></div>
      <div class="mw-meta"><span>${shelf.count} / ${cap} on the shelf</span>
      <span>Store room: ${shelf.item ? (loc.storage[shelf.item] || 0) : 0}</span></div></div>
      <button class="mw-btn sm" data-fill-shelf="${openIndex}" ${!shelf.item ? 'disabled' : ''}>Fill</button></div>`;
    html += '<p class="mw-note">Choose what this shelf sells. Anything already on it goes back to the store room.</p>';
    DEPARTMENTS.forEach((dept) => {
      const open = s.player.level >= dept.level;
      html += `<h4 style="margin:.7rem 0 .35rem;font-size:.8rem;opacity:${open ? 1 : 0.5}">${esc(dept.name)}${open ? '' : ` · unlocks at level ${dept.level}`}</h4>`;
      html += '<div class="mw-grid">';
      dept.products.forEach((id) => {
        const def = item(id);
        const on = shelf.item === id;
        html += `<button class="mw-tile ${on ? 'is-on' : ''} ${open ? '' : 'is-locked'}" data-assign="${id}" ${open ? '' : 'disabled'}>
          <b>${esc(def.name)}</b><span>${money(sim.sellPrice(game, id))} each</span>
          <span>In store: ${loc.storage[id] || 0}</span></button>`;
      });
      html += '</div>';
    });
    return { title: `Shelf ${openIndex + 1}`, sub: 'Choose the product and keep it filled', html };
  }

  // ---- Store room and supplies ----------------------------------------
  function panelStorage() {
    const s = game.state;
    const loc = currentLocation(s);
    const tabs = [{ id: 'stock', label: 'Store room' }, { id: 'order', label: 'Order stock' }, { id: 'upgrade', label: 'Warehouse' }];
    let html = '';
    if (openTab === 'order') return { ...panelSupply(), tabs, title: 'Store room' };
    if (openTab === 'upgrade') {
      const tier = STORAGE_TIERS[loc.storageTier];
      const next = STORAGE_TIERS[loc.storageTier + 1];
      html += `<div class="mw-card"><div class="mw-icon">📦</div><div class="mw-body"><h4>${esc(tier.name)}</h4>
        <div class="mw-bar"><span style="width:${pct(storageUsed(s) / storageCap(s))}"></span></div>
        <div class="mw-meta"><span>${storageUsed(s)} / ${storageCap(s)} items</span></div></div></div>`;
      if (next) {
        html += `<div class="mw-card" style="margin-top:.5rem"><div class="mw-icon">⬆️</div><div class="mw-body">
          <h4>${esc(next.name)}</h4><p>Holds ${next.cap.toLocaleString()} items.</p></div>
          <button class="mw-btn" data-upgrade-storage>${money(next.cost)}</button></div>`;
      } else {
        html += '<p class="mw-note">This is the largest warehouse there is.</p>';
      }
      return { title: 'Store room', sub: tier.name, tabs, html };
    }
    const entries = Object.entries(loc.storage).filter(([, n]) => n > 0)
      .sort((a, b) => item(a[0]).name.localeCompare(item(b[0]).name));
    html += `<div class="mw-card"><div class="mw-icon">🏷️</div><div class="mw-body"><h4>${storageUsed(s)} / ${storageCap(s)} items</h4>
      <div class="mw-bar"><span style="width:${pct(storageUsed(s) / storageCap(s))}"></span></div></div>
      <button class="mw-btn sm blue" data-restock-all>Fill every shelf</button></div>`;
    if (!entries.length) {
      html += '<div class="mw-empty">Nothing in the store room yet. Harvest something, or order stock in.</div>';
    } else {
      html += '<div class="mw-list" style="margin-top:.6rem">';
      entries.forEach(([id, n]) => {
        const def = item(id);
        html += `<div class="mw-card"><div class="mw-icon" style="background:${def.color}33;color:${def.color}">${ITEM_ICON[def.kind] || '📦'}</div>
          <div class="mw-body"><h4>${esc(def.name)}</h4>
          <div class="mw-meta"><span>${n} in stock</span><span>Shelf price ${money(sim.sellPrice(game, id))}</span></div></div>
          <button class="mw-btn sm ghost" data-dump="${id}">Sell ${money(Math.round(sim.sellPrice(game, id) * 0.55))}</button></div>`;
      });
      html += '</div>';
      html += '<p class="mw-note">Selling straight from the store room is quick, but a shopper at the till always pays more.</p>';
    }
    return { title: 'Store room', sub: `${entries.length} kinds of stock`, tabs, html };
  }

  function panelSupply() {
    const s = game.state;
    const loc = currentLocation(s);
    const supplied = Object.keys(ITEMS).filter((id) => item(id).kind === 'supplied');
    let html = '<p class="mw-note">Wholesale goods are delivered straight into the store room. You never have to grow these.</p><div class="mw-list">';
    supplied.forEach((id) => {
      const def = item(id);
      const dept = departmentOf(id);
      const open = !dept || s.player.level >= dept.level;
      const unit = def.cost || Math.round(def.value * 0.45);
      html += `<div class="mw-card ${open ? '' : 'is-locked'}"><div class="mw-icon" style="background:${def.color}33">📦</div>
        <div class="mw-body"><h4>${esc(def.name)}</h4>
        <div class="mw-meta"><span>Buy ${money(unit)}</span><span>Sell ${money(sim.sellPrice(game, id))}</span><span>Have ${loc.storage[id] || 0}</span></div>
        ${open ? '' : `<p>Unlocks with the ${esc(dept.name)} department at level ${dept.level}.</p>`}</div>
        <div style="display:flex;flex-direction:column;gap:.25rem">
        <button class="mw-btn sm" data-order="${id}" data-qty="10" ${open ? '' : 'disabled'}>×10</button>
        <button class="mw-btn sm ghost" data-order="${id}" data-qty="50" ${open ? '' : 'disabled'}>×50</button></div></div>`;
    });
    html += '</div>';
    return { title: 'Order stock', sub: 'Wholesale supplies', html };
  }

  // ---- The store ------------------------------------------------------
  function panelStore() {
    const s = game.state;
    const loc = currentLocation(s);
    const exp = expansionFor(loc.stage);
    const tabs = [
      { id: 'shelves', label: 'Shelves' },
      { id: 'tills', label: 'Checkouts' },
      { id: 'expand', label: 'Expansion' },
      { id: 'depts', label: 'Departments' }
    ];
    let html = '';
    if (openTab === 'shelves') {
      const cap = shelfCapacity(s);
      html += `<button class="mw-btn blue" style="width:100%;margin-bottom:.6rem" data-restock-all>Fill every shelf from the store room</button>`;
      html += '<div class="mw-list">';
      loc.shelves.forEach((shelf, i) => {
        const def = shelf.item ? item(shelf.item) : null;
        const dept = shelf.item ? departmentOf(shelf.item) : null;
        html += `<div class="mw-card"><div class="mw-icon" style="background:${dept ? `${dept.color}33` : 'rgba(255,255,255,.1)'}">${shelf.count ? '🛒' : '🚫'}</div>
          <div class="mw-body"><h4>Shelf ${i + 1} · ${def ? esc(def.name) : 'Not set'}</h4>
          <div class="mw-bar ${shelf.count === 0 ? 'warn' : ''}"><span style="width:${pct(shelf.count / cap)}"></span></div>
          <div class="mw-meta"><span>${shelf.count}/${cap}</span>${def ? `<span>Store room ${loc.storage[shelf.item] || 0}</span>` : ''}</div></div>
          <button class="mw-btn sm ghost" data-open-shelf="${i}">Set up</button></div>`;
      });
      html += '</div>';
    } else if (openTab === 'tills') {
      html += `<p class="mw-note">Stand behind a till to serve, or hire a cashier to run one for you. Self checkouts work on their own but a little slower.</p>`;
      html += '<div class="mw-list">';
      for (let i = 0; i < exp.checkouts; i += 1) {
        const open = i < loc.checkoutsOpen;
        const manned = game.tillIsManned(i);
        const queue = game.customers.queues[i] ? game.customers.queues[i].length : 0;
        html += `<div class="mw-card"><div class="mw-icon">${open ? '💳' : '🔒'}</div><div class="mw-body">
          <h4>Till ${i + 1}</h4><div class="mw-meta"><span>${open ? 'Open' : 'Closed'}</span>
          <span>${manned ? 'Staffed' : 'Nobody serving'}</span><span>${queue} waiting</span></div></div>
          ${open ? '' : `<button class="mw-btn sm" data-open-till="${i}">Open</button>`}</div>`;
      }
      html += '</div>';
      html += upgradeList('store');
    } else if (openTab === 'expand') {
      const next = EXPANSIONS[loc.stage];
      html += `<div class="mw-card"><div class="mw-icon">🏪</div><div class="mw-body"><h4>${esc(exp.name)}</h4>
        <div class="mw-meta"><span>${exp.shelves} shelves</span><span>${exp.checkouts} tills</span><span>${exp.plots} plots</span>
        <span>${exp.staffSlots} staff</span><span>${exp.machineSlots} machine pads</span></div></div></div>`;
      if (next) {
        const canLevel = s.player.level >= next.level;
        const canPay = s.player.cash >= next.cost;
        html += `<div class="mw-card" style="margin-top:.6rem"><div class="mw-icon">🏗️</div><div class="mw-body">
          <h4>${esc(next.name)}</h4>
          <p>${next.shelves} shelves · ${next.checkouts} tills · ${next.plots} plots · ${next.pens} pens · ${next.staffSlots} staff · +${pct(next.trafficBonus)} passing trade</p>
          <div class="mw-meta"><span>${canLevel ? '✅' : '🔒'} Level ${next.level}</span><span>${canPay ? '✅' : '🔒'} ${money(next.cost)}</span></div></div>
          <button class="mw-btn gold" data-expand ${canLevel && canPay ? '' : 'disabled'}>Build</button></div>`;
        html += '<p class="mw-note">Building work happens for real: the shop, the field and the car park all grow on the spot.</p>';
      } else {
        html += '<p class="mw-note">This is the largest store you can build here. Try another city.</p>';
      }
      html += '<div style="margin-top:.8rem"></div>';
      html += '<h4 style="font-size:.82rem;margin:.2rem 0 .4rem">Delivery vehicles</h4><div class="mw-list">';
      VEHICLES.forEach((v) => {
        const owned = s.vehicles.includes(v.id);
        const locked = s.player.level < v.unlock;
        html += `<div class="mw-card ${locked ? 'is-locked' : ''}"><div class="mw-icon">🚚</div><div class="mw-body">
          <h4>${esc(v.name)}</h4><div class="mw-meta"><span>Carries ${v.capacity}</span><span>Speed ${v.speed.toFixed(2)}×</span></div></div>
          <button class="mw-btn sm" data-vehicle="${v.id}" ${owned || locked ? 'disabled' : ''}>${owned ? 'Owned' : locked ? `Lv ${v.unlock}` : money(v.cost)}</button></div>`;
      });
      html += '</div>';
    } else {
      html += '<p class="mw-note">Departments open as you level up. Each one adds new products you can put on a shelf.</p><div class="mw-list">';
      DEPARTMENTS.forEach((d) => {
        const open = s.player.level >= d.level;
        html += `<div class="mw-card ${open ? '' : 'is-locked'}"><div class="mw-icon" style="background:${d.color}33;color:${d.color}">${open ? '✅' : '🔒'}</div>
          <div class="mw-body"><h4>${esc(d.name)}</h4>
          <p>${d.products.map((p) => esc(item(p).name)).join(', ')}</p>
          <div class="mw-meta"><span>${open ? 'Open' : `Unlocks at level ${d.level}`}</span></div></div></div>`;
      });
      html += '</div>';
    }
    const happy = sim.satisfaction(game);
    return { title: exp.name, sub: `⭐ ${loc.reputation.toFixed(2)} · ${happy}% happy · ${loc.served.toLocaleString()} served`, tabs, html };
  }

  // ---- Staff -----------------------------------------------------------
  function panelStaff() {
    const s = game.state;
    const loc = currentLocation(s);
    const exp = expansionFor(loc.stage);
    let html = `<div class="mw-card"><div class="mw-icon">👥</div><div class="mw-body">
      <h4>${loc.staff.length} of ${exp.staffSlots} staff</h4>
      <div class="mw-meta"><span>Wages ${money(sim.salaryPerMinute(game))} a minute</span></div></div></div>`;
    if (loc.staff.length) {
      html += '<div class="mw-list" style="margin-top:.6rem">';
      loc.staff.forEach((m) => {
        const def = STAFF_TYPES[m.type];
        const lv = STAFF_LEVELS[m.level - 1];
        const next = STAFF_LEVELS[m.level];
        html += `<div class="mw-card"><div class="mw-icon" style="background:${def.color}33">👷</div><div class="mw-body">
          <h4>${esc(def.name)} · level ${m.level}</h4>
          <div class="mw-meta"><span>Speed ${lv.speed.toFixed(2)}×</span><span>Carries ${lv.capacity}</span>
          <span>${money(def.salary * (1 + (m.level - 1) * 0.35))}/min</span></div></div>
          <div style="display:flex;flex-direction:column;gap:.25rem">
          <button class="mw-btn sm" data-train="${m.id}" ${next ? '' : 'disabled'}>${next ? `Train ${money(next.cost)}` : 'Max'}</button>
          <button class="mw-btn sm red" data-fire="${m.id}">Let go</button></div></div>`;
      });
      html += '</div>';
    }
    html += '<h4 style="font-size:.82rem;margin:.8rem 0 .4rem">Hire someone new</h4><div class="mw-list">';
    Object.entries(STAFF_TYPES).forEach(([type, def]) => {
      const locked = s.player.level < def.unlock;
      const full = loc.staff.length >= exp.staffSlots;
      html += `<div class="mw-card ${locked ? 'is-locked' : ''}"><div class="mw-icon" style="background:${def.color}33">🧑‍🌾</div>
        <div class="mw-body"><h4>${esc(def.name)}</h4><p>${esc(def.blurb)}</p>
        <div class="mw-meta"><span>${money(def.salary)}/min wages</span></div></div>
        <button class="mw-btn sm" data-hire="${type}" ${locked || full ? 'disabled' : ''}>${locked ? `Level ${def.unlock}` : full ? 'No room' : money(def.hire)}</button></div>`;
    });
    html += '</div>';
    return { title: 'Staff', sub: 'They work while you do something else', html };
  }

  // ---- Marketing --------------------------------------------------------
  function panelMarketing() {
    const s = game.state;
    const level = MARKETING_LEVELS[s.marketingLevel - 1];
    const next = MARKETING_LEVELS[s.marketingLevel];
    let html = `<div class="mw-card"><div class="mw-icon">📢</div><div class="mw-body">
      <h4>Marketing level ${s.marketingLevel} · ${esc(level.name)}</h4>
      <div class="mw-meta"><span>Traffic boost right now: +${pct(meta.marketingBoost(game))}</span>
      <span>${s.stats.campaigns} campaigns run</span></div></div>
      ${next ? `<button class="mw-btn gold" data-marketing-up>${money(next.cost)}</button>` : ''}</div>`;
    if (next) html += `<p class="mw-note">Level ${s.marketingLevel + 1} unlocks ${esc(next.name)}.</p>`;
    if (s.campaigns.length) {
      html += '<h4 style="font-size:.82rem;margin:.7rem 0 .35rem">Running now</h4><div class="mw-list">';
      s.campaigns.forEach((c) => {
        const def = CAMPAIGNS.find((x) => x.id === c.id);
        html += `<div class="mw-card"><div class="mw-icon">⏱️</div><div class="mw-body"><h4>${esc(def.name)}</h4>
          <div class="mw-bar blue"><span style="width:${pct(c.left / c.total)}"></span></div>
          <div class="mw-meta"><span>+${pct(def.boost)} customers</span><span>${timeLeft(c.left)} left</span></div></div></div>`;
      });
      html += '</div>';
    }
    html += '<h4 style="font-size:.82rem;margin:.7rem 0 .35rem">Campaigns</h4><div class="mw-list">';
    CAMPAIGNS.forEach((c) => {
      const locked = c.level > s.marketingLevel;
      const running = s.campaigns.some((x) => x.id === c.id);
      html += `<div class="mw-card ${locked ? 'is-locked' : ''}"><div class="mw-icon">${c.id === 'tv' ? '📺' : c.id === 'radio' ? '📻' : c.id === 'social' ? '📱' : c.id === 'billboard' ? '🪧' : c.id === 'influencer' ? '🌟' : c.id === 'global' ? '🌍' : '📄'}</div>
        <div class="mw-body"><h4>${esc(c.name)}</h4><p>${esc(c.blurb)}</p>
        <div class="mw-meta"><span>+${pct(c.boost)} customers</span><span>${timeLeft(c.duration)}</span></div></div>
        <button class="mw-btn sm" data-campaign="${c.id}" ${locked || running ? 'disabled' : ''}>${locked ? `Level ${c.level}` : running ? 'Running' : money(c.cost)}</button></div>`;
    });
    html += '</div>';
    return { title: 'Marketing', sub: 'Spend money to bring the crowds in', html };
  }

  // ---- World map ---------------------------------------------------------
  function panelMap() {
    const s = game.state;
    let pins = '';
    LOCATIONS.forEach((l) => {
      const unlocked = s.unlocked.includes(l.id);
      const here = s.location === l.id;
      pins += `<button class="mw-pin ${unlocked ? '' : 'locked'} ${here ? 'here' : ''}" data-map="${l.id}"
        style="left:${l.map.x}%;top:${l.map.y}%"><span class="dot"></span><b>${esc(l.name)}</b></button>`;
    });
    let html = `<div class="mw-map">
      <svg viewBox="0 0 100 62" preserveAspectRatio="none">
        <defs><linearGradient id="mwsea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#123b5c"/><stop offset="100%" stop-color="#0a1e30"/></linearGradient></defs>
        <rect width="100" height="62" fill="url(#mwsea)"/>
        <path d="M8 46 L18 30 L30 24 L44 18 L58 22 L70 16 L84 24 L94 40 L88 56 L60 60 L30 58 Z" fill="#2f6b45" opacity="0.92"/>
        <path d="M30 24 L44 18 L58 22 L54 34 L38 36 Z" fill="#3f8055" opacity="0.9"/>
        <path d="M58 22 L70 16 L84 24 L76 32 L62 30 Z" fill="#7c8f6a" opacity="0.9"/>
        <path d="M18 52 L34 48 L40 56 L24 58 Z" fill="#c9a86a" opacity="0.85"/>
        <path d="M8 46 L18 30 L24 38 L16 50 Z" fill="#4a7f52" opacity="0.85"/>
        <path d="M22 60 Q46 44 92 42" stroke="#e8dcb8" stroke-width="0.7" fill="none" stroke-dasharray="2 1.6" opacity="0.75"/>
      </svg>${pins}</div>`;
    const chosen = openIndex && typeof openIndex === 'string' ? openIndex : s.location;
    const loc = locationById(chosen);
    const unlocked = s.unlocked.includes(loc.id);
    const stateFor = s.locations[loc.id];
    html += `<div class="mw-card" style="margin-top:.7rem"><div class="mw-icon">${unlocked ? '📍' : '🔒'}</div>
      <div class="mw-body"><h4>${esc(loc.name)}</h4><p>${esc(loc.blurb)}</p>
      <div class="mw-meta"><span>Population ${loc.population.toFixed(1)}×</span><span>Prices ${loc.priceMul.toFixed(2)}×</span>
      <span>Traffic ${loc.trafficMul.toFixed(1)}×</span>${stateFor ? `<span>⭐ ${stateFor.reputation.toFixed(1)}</span>` : ''}</div></div></div>`;
    if (unlocked) {
      const exp = stateFor ? expansionFor(stateFor.stage) : null;
      html += `<div class="mw-meta" style="margin:.4rem 0 .6rem;font-size:.74rem;opacity:.8">
        ${exp ? `<span>${esc(exp.name)}</span>` : ''}
        ${stateFor ? `<span>${stateFor.served.toLocaleString()} served</span><span>${money(stateFor.revenue)} taken</span>` : ''}</div>`;
      html += s.location === loc.id
        ? '<p class="mw-note">You are here.</p>'
        : `<button class="mw-btn" style="width:100%" data-travel="${loc.id}">Travel to ${esc(loc.name)}</button>`;
    } else {
      const rows = meta.requirementRows(game, loc);
      html += '<div style="margin:.4rem 0 .6rem">';
      html += '<b style="font-size:.78rem">LOCATION LOCKED</b>';
      rows.forEach((r) => {
        html += `<div class="mw-req ${r.met ? 'met' : 'unmet'}"><span class="tick">${r.met ? '✓' : '✗'}</span><span>${esc(r.label)}</span></div>`;
      });
      html += '</div>';
      const ready = rows.every((r) => r.met);
      const price = loc.requires && loc.requires.cash ? Math.round(loc.requires.cash * 0.6) : 0;
      html += `<button class="mw-btn gold" style="width:100%" data-unlock="${loc.id}" ${ready ? '' : 'disabled'}>
        ${ready ? `Buy the land for ${money(price)}` : 'Requirements not met'}</button>`;
    }
    html += `<p class="mw-note">Each city has its own crowds, prices, products and music. Your businesses keep running in the background wherever you are.</p>`;
    return { title: 'World map', sub: `${s.unlocked.length} of ${LOCATIONS.length} locations open`, html };
  }

  // ---- Upgrades -----------------------------------------------------------
  function upgradeList(group) {
    const s = game.state;
    let html = '<div class="mw-list">';
    Object.entries(UPGRADES).filter(([, u]) => u.group === group).forEach(([id, u]) => {
      const level = s.upgrades[id] || 0;
      const maxed = level >= u.max;
      const locked = s.player.level < u.unlock;
      const cost = upgradeCost(id, level);
      html += `<div class="mw-card ${locked ? 'is-locked' : ''}"><div class="mw-icon">⚙️</div><div class="mw-body">
        <h4>${esc(u.name)} ${level > 0 ? `· level ${level}` : ''}</h4>
        <p>${u.per >= 1 ? `+${u.per} ${u.unit}` : `+${pct(u.per)} ${u.unit}`} each level</p>
        <div class="mw-bar"><span style="width:${pct(level / u.max)}"></span></div></div>
        <button class="mw-btn sm" data-upgrade="${id}" ${maxed || locked ? 'disabled' : ''}>${maxed ? 'Max' : locked ? `Lv ${u.unlock}` : money(cost)}</button></div>`;
    });
    html += '</div>';
    return html;
  }

  function panelUpgrades() {
    const tabs = [{ id: 'farm', label: 'Farm' }, { id: 'you', label: 'You' }, { id: 'store', label: 'Store' }];
    const group = ['farm', 'you', 'store'].includes(openTab) ? openTab : 'farm';
    openTab = group;
    return { title: 'Upgrades', sub: 'Every one of these you can feel', tabs, html: upgradeList(group) };
  }

  // ---- More: missions, achievements, daily, settings, looks ---------------
  function panelMore() {
    const tabs = [
      { id: 'missions', label: 'Missions' },
      { id: 'awards', label: 'Awards' },
      { id: 'daily', label: 'Daily' },
      { id: 'look', label: 'Your look' },
      { id: 'settings', label: 'Settings' }
    ];
    const s = game.state;
    let html = '';
    if (openTab === 'missions') {
      const current = meta.currentMission(game);
      const prog = meta.missionProgress(game);
      if (current) {
        html += `<div class="mw-card"><div class="mw-icon">🎯</div><div class="mw-body"><h4>${esc(current.text)}</h4>
          <div class="mw-bar"><span style="width:${pct(prog.pct)}"></span></div>
          <div class="mw-meta"><span>${Math.floor(prog.done).toLocaleString()} / ${Number(prog.target).toLocaleString()}</span>
          <span>Reward ${money(current.cash || 0)}${current.gems ? ` + ${current.gems}💎` : ''}${current.xp ? ` + ${current.xp} XP` : ''}</span></div></div></div>`;
      } else {
        html += '<div class="mw-empty">Every mission is done. The empire is yours.</div>';
      }
      html += '<h4 style="font-size:.8rem;margin:.7rem 0 .35rem">Coming up</h4><div class="mw-list">';
      MISSIONS.slice(s.missionIndex + 1, s.missionIndex + 5).forEach((m) => {
        html += `<div class="mw-card"><div class="mw-icon">·</div><div class="mw-body"><h4 style="opacity:.75">${esc(m.text)}</h4>
          <div class="mw-meta"><span>${money(m.cash || 0)}${m.gems ? ` + ${m.gems}💎` : ''}</span></div></div></div>`;
      });
      html += '</div>';
      html += `<p class="mw-note">${s.missionIndex} of ${MISSIONS.length} missions complete.</p>`;
    } else if (openTab === 'awards') {
      html += '<div class="mw-list">';
      ACHIEVEMENTS.forEach((a) => {
        const done = s.achievements.includes(a.id);
        const value = meta.achievementValue(game, a.stat);
        html += `<div class="mw-card ${done ? '' : 'is-locked'}"><div class="mw-icon">${done ? '🏆' : '🔒'}</div>
          <div class="mw-body"><h4>${esc(a.name)}</h4><p>${esc(a.blurb)}</p>
          <div class="mw-bar"><span style="width:${pct(Math.min(1, value / a.target))}"></span></div>
          <div class="mw-meta"><span>${Math.floor(value).toLocaleString()} / ${a.target.toLocaleString()}</span><span>${a.gems}💎</span></div></div></div>`;
      });
      html += '</div>';
    } else if (openTab === 'daily') {
      const status = meta.dailyStatus(game);
      html += '<div class="mw-grid">';
      DAILY_REWARDS.forEach((r, i) => {
        const claimed = s.daily.day > i;
        html += `<div class="mw-tile ${claimed ? 'is-on' : ''}"><b>Day ${r.day}</b><span>${esc(r.label)}</span>
          <span>${claimed ? 'Claimed' : ''}</span></div>`;
      });
      html += '</div>';
      html += `<button class="mw-btn gold" style="width:100%;margin-top:.7rem" data-claim-daily ${status.ready ? '' : 'disabled'}>
        ${status.ready ? 'Claim today\'s reward' : 'Come back tomorrow'}</button>`;
    } else if (openTab === 'look') {
      const look = s.player.look;
      const row = (key, label, list, isColor = true) => {
        let out = `<h4 style="font-size:.8rem;margin:.6rem 0 .3rem">${label}</h4><div class="mw-swatches">`;
        list.forEach((v) => {
          out += isColor
            ? `<button data-look="${key}" data-value="${v}" class="${look[key] === v ? 'is-on' : ''}" style="background:${v}"></button>`
            : `<button data-look="${key}" data-value="${v}" class="mw-tile ${look[key] === v ? 'is-on' : ''}" style="width:auto"><b>${esc(v)}</b></button>`;
        });
        return `${out}</div>`;
      };
      html += row('skin', 'Skin', LOOK_OPTIONS.skin);
      html += row('hair', 'Hair colour', LOOK_OPTIONS.hair);
      html += row('hairStyle', 'Hair style', LOOK_OPTIONS.hairStyle, false);
      html += row('shirt', 'Shirt', LOOK_OPTIONS.shirt);
      html += row('pants', 'Trousers', LOOK_OPTIONS.pants);
      html += row('shoes', 'Shoes', LOOK_OPTIONS.shoes);
      html += row('accessory', 'Accessory', LOOK_OPTIONS.accessory, false);
    } else {
      const st = s.settings;
      html += `<div class="mw-list">
        <div class="mw-card"><div class="mw-icon">🎵</div><div class="mw-body"><h4>Music</h4><p>A different theme in every city.</p></div>
          <button class="mw-btn sm ${st.music ? '' : 'ghost'}" data-toggle="music">${st.music ? 'On' : 'Off'}</button></div>
        <div class="mw-card"><div class="mw-icon">🔊</div><div class="mw-body"><h4>Sound effects</h4><p>Harvests, tills and coins.</p></div>
          <button class="mw-btn sm ${st.sfx ? '' : 'ghost'}" data-toggle="sfx">${st.sfx ? 'On' : 'Off'}</button></div>
        <div class="mw-card"><div class="mw-icon">⚡</div><div class="mw-body"><h4>Graphics</h4><p>Turn this down if the game feels slow.</p></div>
          <button class="mw-btn sm ${st.quality >= 1 ? '' : 'ghost'}" data-toggle="quality">${st.quality >= 1 ? 'Full' : 'Light'}</button></div>
      </div>`;
      html += `<h4 style="font-size:.8rem;margin:.8rem 0 .35rem">Your business</h4>
        <div class="mw-list">
        <div class="mw-card"><div class="mw-body"><h4>Total earned</h4><p>${money(s.stats.earned)}</p></div></div>
        <div class="mw-card"><div class="mw-body"><h4>Customers served</h4><p>${s.stats.served.toLocaleString()}</p></div></div>
        <div class="mw-card"><div class="mw-body"><h4>Crops harvested</h4><p>${s.stats.harvested.toLocaleString()}</p></div></div>
        <div class="mw-card"><div class="mw-body"><h4>Goods produced</h4><p>${s.stats.produced.toLocaleString()}</p></div></div>
        <div class="mw-card"><div class="mw-body"><h4>Time played</h4><p>${Math.floor(s.played / 60)} minutes</p></div></div>
        </div>`;
      html += `<h4 style="font-size:.8rem;margin:.8rem 0 .35rem">Gems</h4>
        <div class="mw-card"><div class="mw-icon">💎</div><div class="mw-body"><h4>${s.player.gems} gems</h4>
        <p>Gems come from missions, awards and daily rewards. They buy time, never anything you could not earn by playing.</p></div>
        <button class="mw-btn sm gold" data-exchange ${s.player.gems < 1 ? 'disabled' : ''}>Swap 1 for $2,500</button></div>`;
      html += `<button class="mw-btn red" style="width:100%;margin-top:.8rem" data-reset>Start a brand new game</button>`;
      html += '<p class="mw-note">Your game saves itself on this device every few seconds.</p>';
    }
    return { title: 'More', sub: '', tabs, html };
  }

  // ---- Wiring --------------------------------------------------------------
  function onClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    const s = game.state;
    const d = t.dataset;
    if (t.hasAttribute('data-close')) { closePanel(); return; }
    if (d.nav) { setPanel(d.nav); return; }
    if (d.tab) { openTab = d.tab; renderPanel(); game.audio.play('click'); return; }
    if (d.crop) { game.selectedCrop = d.crop; game.audio.play('click'); renderPanel(); return; }
    if (d.assign) { result(game.assignShelf(openIndex, d.assign), 'Shelf set up.'); renderPanel(); return; }
    if (d.openShelf) { setPanel('shelf', Number(d.openShelf)); return; }
    if (d.fillShelf !== undefined && d.fillShelf !== '') { result(sim.stockShelf(game, Number(d.fillShelf))); renderPanel(); return; }
    if (d.restockAll !== undefined && t.hasAttribute('data-restock-all')) { restockAll(); return; }
    if (d.dump) { dumpStock(d.dump); return; }
    if (d.order) { result(sim.buyWholesale(game, d.order, Number(d.qty)), 'Delivered to the store room.'); game.audio.play('truck'); renderPanel(); return; }
    if (d.upgrade) { result(game.buyUpgrade(d.upgrade)); renderPanel(); return; }
    if (t.hasAttribute('data-upgrade-storage')) { result(sim.upgradeStorage(game), 'Bigger store room built.'); renderPanel(); return; }
    if (t.hasAttribute('data-expand')) { result(game.expandStore()); renderPanel(); return; }
    if (d.openTill !== undefined && t.hasAttribute('data-open-till')) { result(sim.openCheckout(game, Number(d.openTill))); game.rebuild(); renderPanel(); return; }
    if (d.buildMachine) { result(game.buildMachine(openIndex, d.buildMachine), 'Machine built.'); renderPanel(); return; }
    if (d.recipe) { result(sim.startRecipe(game, openIndex, d.recipe), 'Production started.'); game.audio.play('machine'); renderPanel(); return; }
    if (d.collectMachine) { result(sim.collectMachine(game, Number(d.collectMachine))); renderPanel(); return; }
    if (d.buyAnimal) { result(game.buyAnimal(Number(d.pen), d.buyAnimal), 'A new arrival on the farm.'); renderPanel(); return; }
    if (d.feed) { result(sim.feedAnimals(game, Number(d.feed))); renderPanel(); return; }
    if (d.collectPen) { collectPen(Number(d.collectPen)); return; }
    if (d.hire) { result(game.hire(d.hire), 'Welcome to the team.'); renderPanel(); return; }
    if (d.train) { result(sim.upgradeStaff(game, d.train), 'Training done.'); renderPanel(); return; }
    if (d.fire) { sim.fireStaff(game, d.fire); game.staff.sync(); renderPanel(); return; }
    if (d.vehicle) { result(game.buyVehicle(d.vehicle), 'The new vehicle is at the dock.'); renderPanel(); return; }
    if (d.campaign) { result(meta.startCampaign(game, d.campaign), 'Campaign live.'); game.audio.play('campaign'); renderPanel(); return; }
    if (t.hasAttribute('data-marketing-up')) { result(meta.upgradeMarketing(game), 'Marketing department upgraded.'); renderPanel(); return; }
    if (d.map) { openIndex = d.map; renderPanel(); return; }
    if (d.travel) { const r = game.travel(d.travel); result(r, r.ok ? `Welcome to ${r.loc.name}.` : null); renderPanel(); return; }
    if (d.unlock) { unlockPlace(d.unlock); return; }
    if (t.hasAttribute('data-claim-daily')) { claimDaily(); return; }
    if (t.hasAttribute('data-rush-field')) { result(sim.rushField(game), 'The whole field is ready.'); game.audio.play('harvest'); renderPanel(); return; }
    if (d.rushMachine) { result(sim.rushMachine(game, Number(d.rushMachine)), 'Batch finished.'); game.audio.play('machine'); renderPanel(); return; }
    if (t.hasAttribute('data-exchange')) { result(sim.exchangeGems(game, 1), 'Gems swapped for cash.'); game.audio.play('coin'); renderPanel(); return; }
    if (d.look) { game.setLook({ [d.look]: d.value }); game.audio.play('click'); renderPanel(); return; }
    if (d.toggle) {
      if (d.toggle === 'music') { s.settings.music = !s.settings.music; game.audio.setMusic(s.settings.music); }
      if (d.toggle === 'sfx') { s.settings.sfx = !s.settings.sfx; game.audio.setSfx(s.settings.sfx); }
      if (d.toggle === 'quality') {
        s.settings.quality = s.settings.quality >= 1 ? 0 : 1;
        game.renderer.quality = s.settings.quality;
        game.renderer.resize(root.clientWidth, root.clientHeight);
      }
      saveGame(s, true);
      renderPanel();
      return;
    }
    if (t.hasAttribute('data-reset')) { confirmReset(); }
  }

  function restockAll() {
    const loc = currentLocation(game.state);
    let total = 0;
    loc.shelves.forEach((shelf, i) => {
      if (!shelf.item) return;
      const res = sim.stockShelf(game, i);
      if (res.ok) total += res.amount;
    });
    if (total) {
      game.audio.play('stock');
      toast(`${total} items put out on the shelves.`, 'info');
    } else toast('Nothing in the store room to put out.', 'warn');
    renderPanel();
    refresh();
  }

  function dumpStock(id) {
    const loc = currentLocation(game.state);
    const have = loc.storage[id] || 0;
    if (!have) return;
    const price = Math.round(sim.sellPrice(game, id) * 0.55);
    sim.takeStock(game.state, id, have);
    sim.earn(game, price * have);
    game.audio.play('coin');
    toast(`Sold ${have} ${item(id).name} for ${money(price * have)}.`, 'info');
    renderPanel();
    refresh();
  }

  function collectPen(index) {
    const res = sim.collectAnimal(game, index);
    if (!res.ok) { toast(res.msg, 'warn'); return; }
    sim.addStock(game.state, res.item, res.amount);
    game.audio.play('pickup');
    toast(`${res.amount} ${item(res.item).name} put in the store room.`, 'info');
    renderPanel();
    refresh();
  }

  function claimDaily() {
    const res = meta.claimDaily(game);
    if (!res.ok) { toast(res.msg, 'warn'); return; }
    game.audio.play('reward');
    game.fx.confetti(game.player.x, 2, game.player.z, 34);
    toast(`Day ${res.day} reward: ${res.reward.label}`, 'level');
    renderPanel();
    refresh();
  }

  function unlockPlace(id) {
    const res = game.unlockLocation(id);
    if (!res.ok) { toast(res.msg, 'warn'); return; }
    showUnlock(res.loc);
    renderPanel();
    refresh();
  }

  function showUnlock(loc) {
    const box = document.createElement('div');
    box.className = 'mw-unlock';
    box.innerHTML = `<div class="box">
      <div style="font-size:2.4rem">🌍</div>
      <h3 style="margin:.4rem 0">${esc(loc.name)} is open!</h3>
      <p style="font-size:.82rem;opacity:.82">${esc(loc.blurb)}</p>
      <div style="display:flex;gap:.5rem;justify-content:center;margin-top:.8rem">
        <button class="mw-btn" data-go>Travel there now</button>
        <button class="mw-btn ghost" data-stay>Stay here</button>
      </div></div>`;
    root.appendChild(box);
    game.fx.confetti(game.player.x, 3, game.player.z, 60);
    box.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-go')) { game.travel(loc.id); box.remove(); renderPanel(); }
      else if (e.target.hasAttribute('data-stay')) box.remove();
    });
  }

  function confirmReset() {
    const box = document.createElement('div');
    box.className = 'mw-unlock';
    box.innerHTML = `<div class="box"><h3 style="margin:0 0 .4rem">Start again?</h3>
      <p style="font-size:.82rem;opacity:.82">This wipes your whole business on this device. There is no way back.</p>
      <div style="display:flex;gap:.5rem;justify-content:center;margin-top:.8rem">
        <button class="mw-btn red" data-yes>Yes, wipe it</button>
        <button class="mw-btn ghost" data-no>Keep playing</button></div></div>`;
    root.appendChild(box);
    box.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-yes')) {
        clearSave();
        box.remove();
        if (game.hooks.onRestart) game.hooks.onRestart();
      } else if (e.target.hasAttribute('data-no')) box.remove();
    });
  }

  sheet.addEventListener('click', onClick);
  dom.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.nav) { setPanel(t.dataset.nav); return; }
    if (t === $('btn-missions')) { setPanel('more', 0, 'missions'); return; }
    if (t === $('btn-daily')) { setPanel('more', 0, 'daily'); return; }
    if (t === $('btn-full')) { toggleFullscreen(); }
  });

  const actionBtn = $('action');
  const press = (on) => { game.holding = on; if (on) game.doPrimary(); };
  actionBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(true); });
  actionBtn.addEventListener('pointerup', () => press(false));
  actionBtn.addEventListener('pointerleave', () => press(false));
  actionBtn.addEventListener('pointercancel', () => press(false));
  window.addEventListener('pointerup', () => { if (game.holding) press(false); });

  function toggleFullscreen() {
    root.classList.toggle('is-fullscreen');
    setTimeout(() => {
      if (game.hooks.onResize) game.hooks.onResize();
    }, 60);
  }

  // ---- The refresh that keeps the HUD honest ------------------------------
  function refresh() {
    const s = game.state;
    const loc = currentLocation(s);
    const prog = levelProgress(s);
    $('level').textContent = `Level ${s.player.level}`;
    $('xp').textContent = `${Math.floor(prog.xp)}/${prog.need}`;
    $('xpfill').style.width = pct(prog.pct);
    $('cash').textContent = Math.round(s.player.cash).toLocaleString();
    $('gems').textContent = s.player.gems;
    $('rep').textContent = `⭐ ${loc.reputation.toFixed(2)}`;
    const happy = sim.satisfaction(game);
    $('happy').textContent = `😊 ${happy}%`;
    $('where').textContent = `${locationById(s.location).name} · ${expansionFor(loc.stage).name}`;

    const mission = meta.currentMission(game);
    const missionBox = $('mission');
    if (mission) {
      const mp = meta.missionProgress(game);
      missionBox.hidden = false;
      $('mission-text').textContent = mission.text;
      $('mission-fill').style.width = pct(mp.pct);
      $('mission-progress').textContent = `${Math.floor(mp.done).toLocaleString()} / ${Number(mp.target).toLocaleString()}`;
    } else missionBox.hidden = true;

    let evHtml = '';
    if (s.event) {
      const def = meta.eventDef(s.event.id);
      evHtml += `<span class="mw-chip">🎉 ${esc(def.name)} · ${timeLeft(s.event.left)}</span>`;
    }
    s.campaigns.forEach((c) => {
      const def = CAMPAIGNS.find((x) => x.id === c.id);
      evHtml += `<span class="mw-chip" data-kind="campaign">📢 ${esc(def.name)} · ${timeLeft(c.left)}</span>`;
    });
    const queue = game.averageQueue();
    if (queue >= 3) evHtml += `<span class="mw-chip">⏳ Queues building up</span>`;
    $('events').innerHTML = evHtml;

    const near = game.nearby;
    const prompt = $('prompt');
    if (near) {
      prompt.textContent = near.label;
      prompt.classList.add('is-on');
      actionBtn.disabled = false;
      actionBtn.textContent = near.action ? near.label : `Open ${near.label}`;
    } else {
      prompt.classList.remove('is-on');
      actionBtn.disabled = true;
      actionBtn.textContent = 'Walk up to something';
    }

    const carry = $('carry');
    if (game.carry) {
      carry.classList.add('is-on');
      $('carry-color').style.background = item(game.carry.item).color;
      $('carry-text').textContent = `${game.carry.count}/${carryCapacity(s)} ${item(game.carry.item).name}`;
    } else carry.classList.remove('is-on');

    const daily = meta.dailyStatus(game);
    $('btn-daily').classList.toggle('is-alert', daily.ready);

    if (openPanel) renderPanel();
  }

  function destroy() {
    dom.remove();
    sheet.remove();
    toasts.remove();
  }

  return { refresh, toast, setPanel, closePanel, destroy, renderPanel };
}
