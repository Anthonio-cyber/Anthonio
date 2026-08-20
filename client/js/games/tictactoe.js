// Tic-Tac-Toe - play the computer, or a classmate through a live match.
import { icon } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export default function ticTacToe({ root, onScore, multiplayer }) {
  if (multiplayer) return multiplayerBoard({ root, multiplayer });
  return soloBoard({ root, onScore });
}

// ---------------------------------------------------------------------------
// Playing the computer
// ---------------------------------------------------------------------------
function soloBoard({ root, onScore }) {
  let board = Array(9).fill('');
  let over = false;
  let difficulty = 'hard';
  const tally = { win: 0, loss: 0, draw: 0 };

  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-success" id="ttt-wins">Won 0</span>
        <span class="badge badge-danger" id="ttt-losses">Lost 0</span>
        <span class="badge" id="ttt-draws">Drawn 0</span>
        <div class="spacer"></div>
        <select class="select" id="ttt-difficulty" style="width:auto">
          <option value="easy">Easy</option>
          <option value="normal">Normal</option>
          <option value="hard" selected>Hard</option>
        </select>
        <button class="btn btn-sm" id="ttt-reset">${icon('refresh', 14)} New game</button>
      </div>
      <p class="center small muted" id="ttt-status">You are X. Tap a square to start.</p>
      <div class="ttt-board" id="ttt-board"></div>
    </div>`;

  const boardEl = root.querySelector('#ttt-board');
  const status = root.querySelector('#ttt-status');

  function paint(highlight = []) {
    boardEl.innerHTML = board.map((mark, index) => `
      <button class="ttt-cell ${mark ? `mark-${mark.toLowerCase()}` : ''} ${highlight.includes(index) ? 'win' : ''}"
              data-cell="${index}" ${mark || over ? 'disabled' : ''} aria-label="Square ${index + 1}">
        ${mark}
      </button>`).join('');
  }

  function winnerOf(cells) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return { mark: cells[a], line };
    }
    return null;
  }

  function bestMove(cells) {
    const empty = cells.map((v, i) => (v ? null : i)).filter((v) => v !== null);
    if (difficulty === 'easy') return empty[Math.floor(Math.random() * empty.length)];
    if (difficulty === 'normal' && Math.random() < 0.4) return empty[Math.floor(Math.random() * empty.length)];

    // Minimax for a perfect opponent.
    const minimax = (state, isComputer) => {
      const result = winnerOf(state);
      if (result) return result.mark === 'O' ? { score: 10 } : { score: -10 };
      if (state.every(Boolean)) return { score: 0 };

      const moves = [];
      for (let i = 0; i < 9; i += 1) {
        if (state[i]) continue;
        const next = [...state];
        next[i] = isComputer ? 'O' : 'X';
        moves.push({ index: i, score: minimax(next, !isComputer).score });
      }
      return isComputer
        ? moves.reduce((best, m) => (m.score > best.score ? m : best))
        : moves.reduce((best, m) => (m.score < best.score ? m : best));
    };
    return minimax(cells, true).index;
  }

  function finish(result, line = []) {
    over = true;
    tally[result] += 1;
    root.querySelector('#ttt-wins').textContent = `Won ${tally.win}`;
    root.querySelector('#ttt-losses').textContent = `Lost ${tally.loss}`;
    root.querySelector('#ttt-draws').textContent = `Drawn ${tally.draw}`;
    status.textContent = result === 'win' ? 'You win.' : (result === 'loss' ? 'The computer wins this one.' : 'A draw.');
    paint(line);
    onScore(result === 'win' ? 1 : 0, result);
  }

  boardEl.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-cell]');
    if (!cell || over) return;
    const index = Number(cell.dataset.cell);
    if (board[index]) return;

    board[index] = 'X';
    paint();

    let result = winnerOf(board);
    if (result) return finish('win', result.line);
    if (board.every(Boolean)) return finish('draw');

    status.textContent = 'The computer is thinking...';
    setTimeout(() => {
      const move = bestMove(board);
      if (move !== undefined) board[move] = 'O';
      paint();
      result = winnerOf(board);
      if (result) return finish('loss', result.line);
      if (board.every(Boolean)) return finish('draw');
      status.textContent = 'Your turn.';
    }, 260);
  });

  function reset() {
    board = Array(9).fill('');
    over = false;
    status.textContent = 'You are X. Tap a square to start.';
    paint();
  }

  root.querySelector('#ttt-reset').addEventListener('click', reset);
  root.querySelector('#ttt-difficulty').addEventListener('change', (event) => {
    difficulty = event.target.value;
    reset();
  });

  paint();
  return { destroy() {} };
}

// ---------------------------------------------------------------------------
// Playing a classmate (the server decides every result)
// ---------------------------------------------------------------------------
function multiplayerBoard({ root, multiplayer }) {
  root.innerHTML = `
    <div class="game-stage">
      <div id="mp-header"></div>
      <p class="center small muted" id="ttt-status"></p>
      <div class="ttt-board" id="ttt-board"></div>
    </div>`;

  const boardEl = root.querySelector('#ttt-board');
  const status = root.querySelector('#ttt-status');

  function paint(match, line = []) {
    const board = match.state.board || Array(9).fill('');
    const finished = match.status === 'finished';
    boardEl.innerHTML = board.map((mark, index) => `
      <button class="ttt-cell ${mark ? `mark-${mark.toLowerCase()}` : ''} ${line.includes(index) ? 'win' : ''}"
              data-cell="${index}" ${mark || finished || !match.myTurn ? 'disabled' : ''}>
        ${mark}
      </button>`).join('');

    root.querySelector('#mp-header').innerHTML = multiplayer.header(match);
    if (finished) {
      status.textContent = multiplayer.resultText(match);
    } else {
      status.textContent = match.myTurn
        ? `Your turn - you are ${match.myMark}.`
        : `Waiting for ${esc(multiplayer.opponent(match)?.displayName || 'your opponent')}...`;
    }
  }

  boardEl.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-cell]');
    if (!cell) return;
    multiplayer.move({ index: Number(cell.dataset.cell) });
  });

  return { paint, destroy() {} };
}
