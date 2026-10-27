// ==========================================================
// Market World
// A farming, shop-keeping and business-building game in 3D.
//
// This is the entry point the Gaming Hub loads. It puts up the title
// screen, starts the game, keeps the canvas the right size and hands a
// score back to the hub when the player leaves.
// ==========================================================
import { Game } from './game.js';
import { createInterface } from './ui/interface.js';
import { loadGame, clearSave, saveGame } from './systems/state.js';

const STYLE_HREF = '/styles/market-world.css';

function ensureStylesheet() {
  if (document.querySelector(`link[href="${STYLE_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_HREF;
  document.head.appendChild(link);
}

function splashMarkup(hasSave) {
  return `
    <div class="mw-splash">
      <div class="mw-logo">🛒</div>
      <h2>Market World</h2>
      <p>Grow it, make it, stock it, sell it. Start with a roadside shop and one small field, and build a supermarket empire across six cities.</p>
      <p style="font-size:.76rem;opacity:.7">Move with the thumb stick or the WASD keys. Drag anywhere to swing the camera, pinch to zoom.
      Walk up to a plot, a shelf, a machine or a till and press the big green button.</p>
      <div class="row">
        ${hasSave ? '<button class="mw-btn" data-continue>Carry on playing</button>' : ''}
        <button class="mw-btn ${hasSave ? 'ghost' : ''}" data-new>${hasSave ? 'Start again' : 'Start the game'}</button>
      </div>
      ${hasSave ? '<p style="font-size:.7rem;opacity:.55">Starting again wipes the business you already built.</p>' : ''}
    </div>`;
}

export default function marketWorld({ root, onScore }) {
  ensureStylesheet();

  const shell = document.createElement('div');
  shell.className = 'mw-root';
  shell.innerHTML = `
    <canvas class="mw-canvas"></canvas>
    <div class="mw-overlay"></div>`;
  root.innerHTML = '';
  root.appendChild(shell);

  const canvas = shell.querySelector('.mw-canvas');
  const overlay = shell.querySelector('.mw-overlay');

  let game = null;
  let ui = null;
  let observer = null;
  let scoreTimer = null;
  let destroyed = false;

  const sizeToShell = () => {
    if (!game) return;
    const rect = shell.getBoundingClientRect();
    game.resize(rect.width, rect.height);
  };

  const submitScore = () => {
    if (!game || !onScore) return;
    const earned = Math.floor(game.state.stats.earned);
    if (earned <= 0) return;
    try { onScore(earned, 'played'); } catch (err) { /* the hub handles its own errors */ }
  };

  function showSplash() {
    const splash = document.createElement('div');
    splash.innerHTML = splashMarkup(!!loadGame());
    const node = splash.firstElementChild;
    shell.appendChild(node);
    node.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-new')) clearSave();
      node.remove();
      boot();
    });
  }

  function boot() {
    try {
      game = new Game({
        canvas,
        overlay,
        hooks: {
          onNotify: (text, kind) => ui && ui.toast(text, kind),
          onOpenPanel: (panel, index) => ui && ui.setPanel(panel, index),
          onSlowTick: () => ui && ui.refresh(),
          onWorldRebuilt: () => ui && ui.refresh(),
          onEventChange: () => ui && ui.refresh(),
          onLevelUp: () => submitScore(),
          onResize: () => sizeToShell(),
          onRestart: () => restart()
        }
      });
    } catch (err) {
      shell.innerHTML = `<div class="mw-splash"><div class="mw-logo">😕</div>
        <h2>This device cannot run Market World</h2>
        <p>${err && err.message ? err.message : 'The browser could not start 3D graphics.'}</p>
        <p style="font-size:.75rem;opacity:.7">Try a different browser, or turn on hardware acceleration in your browser settings.</p></div>`;
      return;
    }

    // Handy for debugging from the console: the live game hangs off its own element.
    shell.marketWorld = game;

    game.audio.setMusic(game.state.settings.music);
    game.audio.setSfx(game.state.settings.sfx);
    game.renderer.quality = game.state.settings.quality;

    ui = createInterface(shell, game);
    sizeToShell();
    ui.refresh();
    game.start();

    if (window.ResizeObserver) {
      observer = new ResizeObserver(sizeToShell);
      observer.observe(shell);
    } else {
      window.addEventListener('resize', sizeToShell);
    }
    scoreTimer = setInterval(submitScore, 180000);

    // The first mission is the tutorial: tell the player where to start.
    if (game.state.stats.planted === 0) {
      ui.toast('Walk over to the field on the left and plant your first seeds.', 'mission');
    }
  }

  function restart() {
    if (game) { game.destroy(); game = null; }
    if (ui) { ui.destroy(); ui = null; }
    shell.querySelectorAll('.mw-unlock').forEach((n) => n.remove());
    boot();
  }

  const onVisibility = () => {
    if (!game) return;
    game.paused = document.hidden;
    if (document.hidden) saveGame(game.state, true);
  };
  document.addEventListener('visibilitychange', onVisibility);

  showSplash();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      submitScore();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', sizeToShell);
      if (observer) observer.disconnect();
      if (scoreTimer) clearInterval(scoreTimer);
      if (ui) ui.destroy();
      if (game) game.destroy();
      root.innerHTML = '';
    }
  };
}
