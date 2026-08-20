// Reaction Test - tap as soon as the panel turns green.
import { icon } from '../lib/icons.js';

export default function reaction({ root, onScore }) {
  const ROUNDS = 5;
  let state = 'idle';
  let timer = null;
  let startedAt = 0;
  let results = [];

  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-accent" id="reaction-round">Round 0 / ${ROUNDS}</span>
        <span class="badge" id="reaction-avg">Average -</span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="reaction-reset">${icon('refresh', 14)} Reset</button>
      </div>
      <button class="reaction-panel idle" id="reaction-panel">
        <span class="reaction-title" id="reaction-title">Tap to start</span>
        <span class="reaction-sub" id="reaction-sub">Wait for green, then tap as fast as you can.</span>
      </button>
      <div id="reaction-list" class="reaction-list"></div>
    </div>`;

  const panel = root.querySelector('#reaction-panel');
  const title = root.querySelector('#reaction-title');
  const sub = root.querySelector('#reaction-sub');
  const roundLabel = root.querySelector('#reaction-round');
  const avgLabel = root.querySelector('#reaction-avg');
  const list = root.querySelector('#reaction-list');

  function setPanel(mode, headline, detail) {
    panel.className = `reaction-panel ${mode}`;
    title.textContent = headline;
    sub.textContent = detail;
  }

  function armRound() {
    state = 'waiting';
    setPanel('waiting', 'Wait for green...', 'Do not tap yet.');
    const delay = 1200 + Math.random() * 2800;
    timer = setTimeout(() => {
      state = 'go';
      startedAt = performance.now();
      setPanel('go', 'TAP NOW', '');
    }, delay);
  }

  panel.addEventListener('click', () => {
    if (state === 'idle' || state === 'done') {
      results = [];
      list.innerHTML = '';
      avgLabel.textContent = 'Average -';
      roundLabel.textContent = `Round 0 / ${ROUNDS}`;
      armRound();
      return;
    }

    if (state === 'waiting') {
      clearTimeout(timer);
      state = 'idle';
      setPanel('early', 'Too early', 'You tapped before it turned green. Tap to try again.');
      return;
    }

    if (state === 'go') {
      const ms = Math.round(performance.now() - startedAt);
      results.push(ms);
      list.insertAdjacentHTML('beforeend', `<span class="badge">${results.length}. ${ms} ms</span>`);
      roundLabel.textContent = `Round ${results.length} / ${ROUNDS}`;

      if (results.length >= ROUNDS) {
        const average = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
        avgLabel.textContent = `Average ${average} ms`;
        state = 'done';
        setPanel('done', `${average} ms average`, 'Tap to play again.');
        onScore(average, 'played');
      } else {
        state = 'between';
        setPanel('between', `${ms} ms`, 'Tap for the next round.');
        setTimeout(() => { if (state === 'between') armRound(); }, 550);
      }
    }

    if (state === 'between') armRound();
  });

  root.querySelector('#reaction-reset').addEventListener('click', () => {
    clearTimeout(timer);
    state = 'idle';
    results = [];
    list.innerHTML = '';
    roundLabel.textContent = `Round 0 / ${ROUNDS}`;
    avgLabel.textContent = 'Average -';
    setPanel('idle', 'Tap to start', 'Wait for green, then tap as fast as you can.');
  });

  return { destroy() { clearTimeout(timer); } };
}
