// Rock Paper Scissors - best of five, solo or against a classmate.
import { icon } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

const CHOICES = [
  { key: 'rock', label: 'Rock', symbol: 'R' },
  { key: 'paper', label: 'Paper', symbol: 'P' },
  { key: 'scissors', label: 'Scissors', symbol: 'S' }
];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export default function rps({ root, onScore, multiplayer }) {
  return multiplayer ? multiplayerGame({ root, multiplayer }) : soloGame({ root, onScore });
}

function choiceButtons(disabled = false) {
  return `
    <div class="rps-choices">
      ${CHOICES.map((choice) => `
        <button class="rps-choice" data-choice="${choice.key}" ${disabled ? 'disabled' : ''}>
          <span class="rps-symbol">${choice.symbol}</span>
          <span>${choice.label}</span>
        </button>`).join('')}
    </div>`;
}

function soloGame({ root, onScore }) {
  const TARGET = 3;
  let you = 0;
  let them = 0;
  let over = false;

  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-accent" id="rps-score">You 0 - 0 Computer</span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="rps-reset">${icon('refresh', 14)} New match</button>
      </div>
      <p class="center small muted" id="rps-status">First to ${TARGET} wins the match.</p>
      <div class="rps-arena" id="rps-arena">
        <div class="rps-side"><span class="rps-big" id="rps-you">?</span><span class="tiny faint">You</span></div>
        <span class="rps-vs">vs</span>
        <div class="rps-side"><span class="rps-big" id="rps-them">?</span><span class="tiny faint">Computer</span></div>
      </div>
      ${choiceButtons()}
      <div id="rps-history" class="rps-history"></div>
    </div>`;

  const scoreLabel = root.querySelector('#rps-score');
  const status = root.querySelector('#rps-status');
  const history = root.querySelector('#rps-history');

  root.querySelector('.rps-choices').addEventListener('click', (event) => {
    const button = event.target.closest('[data-choice]');
    if (!button || over) return;

    const mine = button.dataset.choice;
    const theirs = CHOICES[Math.floor(Math.random() * 3)].key;
    root.querySelector('#rps-you').textContent = CHOICES.find((c) => c.key === mine).symbol;
    root.querySelector('#rps-them').textContent = CHOICES.find((c) => c.key === theirs).symbol;

    let outcome = 'draw';
    if (mine !== theirs) outcome = BEATS[mine] === theirs ? 'win' : 'loss';
    if (outcome === 'win') you += 1;
    if (outcome === 'loss') them += 1;

    scoreLabel.textContent = `You ${you} - ${them} Computer`;
    status.textContent = outcome === 'win' ? 'You take the round.' : (outcome === 'loss' ? 'They take the round.' : 'That round was a draw.');
    history.insertAdjacentHTML('beforeend',
      `<span class="badge ${outcome === 'win' ? 'badge-success' : (outcome === 'loss' ? 'badge-danger' : '')}">${esc(mine)} v ${esc(theirs)}</span>`);

    if (you >= TARGET || them >= TARGET) {
      over = true;
      const won = you > them;
      status.textContent = won ? `You win the match ${you}-${them}.` : `The computer wins ${them}-${you}.`;
      root.querySelectorAll('[data-choice]').forEach((b) => { b.disabled = true; });
      onScore(you, won ? 'win' : 'loss');
    }
  });

  root.querySelector('#rps-reset').addEventListener('click', () => {
    you = 0; them = 0; over = false;
    scoreLabel.textContent = 'You 0 - 0 Computer';
    status.textContent = `First to ${TARGET} wins the match.`;
    history.innerHTML = '';
    root.querySelector('#rps-you').textContent = '?';
    root.querySelector('#rps-them').textContent = '?';
    root.querySelectorAll('[data-choice]').forEach((b) => { b.disabled = false; });
  });

  return { destroy() {} };
}

function multiplayerGame({ root, multiplayer }) {
  root.innerHTML = `
    <div class="game-stage">
      <div id="mp-header"></div>
      <p class="center small muted" id="rps-status"></p>
      <div class="rps-arena">
        <div class="rps-side"><span class="rps-big" id="rps-you">?</span><span class="tiny faint">You</span></div>
        <span class="rps-vs">vs</span>
        <div class="rps-side"><span class="rps-big" id="rps-them">?</span><span class="tiny faint" id="rps-them-name">Opponent</span></div>
      </div>
      <div id="rps-buttons">${choiceButtons()}</div>
      <div id="rps-history" class="rps-history"></div>
    </div>`;

  const status = root.querySelector('#rps-status');

  function paint(match) {
    const state = match.state || {};
    const mine = state.scores?.[match.myMark] || 0;
    const theirs = state.scores?.[match.myMark === 'X' ? 'O' : 'X'] || 0;
    const opponent = multiplayer.opponent(match);
    const finished = match.status === 'finished';
    const waiting = Boolean(state.picks?.[match.myMark]);

    root.querySelector('#mp-header').innerHTML = multiplayer.header(match);
    root.querySelector('#rps-them-name').textContent = opponent?.displayName || 'Opponent';

    status.textContent = finished
      ? multiplayer.resultText(match)
      : (waiting ? 'Waiting for your opponent to choose...' : `Round ${state.round || 1} - first to ${state.target || 3} wins. You ${mine} - ${theirs} them.`);

    root.querySelector('#rps-buttons').innerHTML = choiceButtons(finished || waiting);

    const history = (state.history || []).map((entry) => {
      const won = entry.winner === match.myMark;
      const drew = !entry.winner;
      return `<span class="badge ${drew ? '' : (won ? 'badge-success' : 'badge-danger')}">R${entry.round}: ${esc(entry[match.myMark === 'X' ? 'x' : 'o'])} v ${esc(entry[match.myMark === 'X' ? 'o' : 'x'])}</span>`;
    }).join('');
    root.querySelector('#rps-history').innerHTML = history;

    const last = (state.history || []).at(-1);
    if (last) {
      const mineKey = match.myMark === 'X' ? 'x' : 'o';
      const theirKey = match.myMark === 'X' ? 'o' : 'x';
      root.querySelector('#rps-you').textContent = CHOICES.find((c) => c.key === last[mineKey])?.symbol || '?';
      root.querySelector('#rps-them').textContent = CHOICES.find((c) => c.key === last[theirKey])?.symbol || '?';
    }
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-choice]');
    if (button) multiplayer.move({ choice: button.dataset.choice });
  });

  return { paint, destroy() {} };
}
