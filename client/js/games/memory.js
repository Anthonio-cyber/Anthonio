// Memory Match - find every pair in as few moves as possible.
import { icon } from '../lib/icons.js';

const SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M'];

export default function memory({ root, onScore }) {
  let pairs = 8;
  let cards = [];
  let flipped = [];
  let matched = 0;
  let moves = 0;
  let locked = false;
  let started = 0;

  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-accent" id="memory-moves">Moves 0</span>
        <span class="badge" id="memory-pairs">0 / ${pairs} pairs</span>
        <div class="spacer"></div>
        <select class="select" id="memory-size" style="width:auto">
          <option value="6">Easy (6 pairs)</option>
          <option value="8" selected>Normal (8 pairs)</option>
          <option value="12">Hard (12 pairs)</option>
        </select>
        <button class="btn btn-sm" id="memory-restart">${icon('refresh', 14)} New game</button>
      </div>
      <div class="memory-grid" id="memory-grid"></div>
      <p class="small faint center">Flip two cards. If they match they stay face up.</p>
    </div>`;

  const grid = root.querySelector('#memory-grid');
  const movesLabel = root.querySelector('#memory-moves');
  const pairsLabel = root.querySelector('#memory-pairs');

  function build() {
    pairs = Number(root.querySelector('#memory-size').value);
    const chosen = SYMBOLS.slice(0, pairs);
    cards = [...chosen, ...chosen]
      .map((symbol) => ({ symbol, id: Math.random() }))
      .sort(() => Math.random() - 0.5);
    flipped = [];
    matched = 0;
    moves = 0;
    locked = false;
    started = Date.now();
    movesLabel.textContent = 'Moves 0';
    pairsLabel.textContent = `0 / ${pairs} pairs`;
    grid.style.setProperty('--memory-columns', pairs > 8 ? 6 : 4);
    grid.innerHTML = cards.map((card, index) => `
      <button class="memory-card" data-index="${index}" aria-label="Hidden card">
        <span class="memory-face memory-back">?</span>
        <span class="memory-face memory-front">${card.symbol}</span>
      </button>`).join('');
  }

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('.memory-card');
    if (!button || locked) return;
    const index = Number(button.dataset.index);
    if (button.classList.contains('flipped') || button.classList.contains('matched')) return;

    button.classList.add('flipped');
    flipped.push({ index, button });

    if (flipped.length < 2) return;

    moves += 1;
    movesLabel.textContent = `Moves ${moves}`;

    const [first, second] = flipped;
    if (cards[first.index].symbol === cards[second.index].symbol) {
      first.button.classList.add('matched');
      second.button.classList.add('matched');
      matched += 1;
      pairsLabel.textContent = `${matched} / ${pairs} pairs`;
      flipped = [];
      if (matched === pairs) finish();
    } else {
      locked = true;
      setTimeout(() => {
        first.button.classList.remove('flipped');
        second.button.classList.remove('flipped');
        flipped = [];
        locked = false;
      }, 700);
    }
  });

  function finish() {
    const seconds = Math.round((Date.now() - started) / 1000);
    grid.insertAdjacentHTML('afterend', `
      <div class="alert alert-success" id="memory-result" style="margin-top:1rem">
        ${icon('check', 17)}
        <div><strong>All pairs found.</strong><br>${moves} moves in ${seconds} seconds.</div>
      </div>`);
    onScore(moves, 'played');
  }

  root.querySelector('#memory-restart').addEventListener('click', () => {
    root.querySelector('#memory-result')?.remove();
    build();
  });
  root.querySelector('#memory-size').addEventListener('change', () => {
    root.querySelector('#memory-result')?.remove();
    build();
  });

  build();
  return { destroy() {} };
}
