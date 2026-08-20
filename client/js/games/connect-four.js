// Connect Four - line up four discs. Solo against the computer or live.
import { icon } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

const COLUMNS = 7;
const ROWS = 6;

export default function connectFour({ root, onScore, multiplayer }) {
  return multiplayer ? multiplayerBoard({ root, multiplayer }) : soloBoard({ root, onScore });
}

function winnerOf(board) {
  const at = (r, c) => (r >= 0 && r < ROWS && c >= 0 && c < COLUMNS ? board[r * COLUMNS + c] : '');
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLUMNS; c += 1) {
      const mark = at(r, c);
      if (!mark) continue;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = [[r, c]];
        for (let step = 1; step < 4; step += 1) {
          if (at(r + dr * step, c + dc * step) !== mark) break;
          cells.push([r + dr * step, c + dc * step]);
        }
        if (cells.length === 4) return { mark, line: cells.map(([rr, cc]) => rr * COLUMNS + cc) };
      }
    }
  }
  return null;
}

function drop(board, column, mark) {
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (!board[r * COLUMNS + column]) {
      const next = [...board];
      next[r * COLUMNS + column] = mark;
      return { board: next, index: r * COLUMNS + column };
    }
  }
  return null;
}

function boardMarkup(board, { line = [], disabled = false } = {}) {
  return `
    <div class="c4-columns">
      ${Array.from({ length: COLUMNS }, (_, c) => `
        <button class="c4-column" data-column="${c}" ${disabled || board[c] ? 'disabled' : ''} aria-label="Drop in column ${c + 1}">
          ${icon('chevronDown', 16)}
        </button>`).join('')}
    </div>
    <div class="c4-board">
      ${board.map((mark, index) => `
        <span class="c4-cell ${mark ? `mark-${mark.toLowerCase()}` : ''} ${line.includes(index) ? 'win' : ''}"></span>`).join('')}
    </div>`;
}

function soloBoard({ root, onScore }) {
  let board = Array(ROWS * COLUMNS).fill('');
  let over = false;

  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-accent">You are red</span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="c4-reset">${icon('refresh', 14)} New game</button>
      </div>
      <p class="center small muted" id="c4-status">Drop a disc into any column.</p>
      <div id="c4-area"></div>
    </div>`;

  const area = root.querySelector('#c4-area');
  const status = root.querySelector('#c4-status');

  const paint = (line = []) => { area.innerHTML = boardMarkup(board, { line, disabled: over }); };

  function computerMove() {
    // Win if possible, block if needed, otherwise favour the middle.
    for (const mark of ['O', 'X']) {
      for (let c = 0; c < COLUMNS; c += 1) {
        const result = drop(board, c, mark);
        if (result && winnerOf(result.board)?.mark === mark) return c;
      }
    }
    const order = [3, 2, 4, 1, 5, 0, 6];
    return order.find((c) => !board[c]);
  }

  function finish(result, line) {
    over = true;
    status.textContent = result === 'win' ? 'You win.' : (result === 'loss' ? 'The computer wins.' : 'The board is full - a draw.');
    paint(line || []);
    onScore(result === 'win' ? 1 : 0, result);
  }

  area.addEventListener('click', (event) => {
    const button = event.target.closest('[data-column]');
    if (!button || over) return;

    const played = drop(board, Number(button.dataset.column), 'X');
    if (!played) return;
    board = played.board;
    paint();

    let result = winnerOf(board);
    if (result) return finish('win', result.line);
    if (board.every(Boolean)) return finish('draw');

    status.textContent = 'The computer is thinking...';
    setTimeout(() => {
      const column = computerMove();
      const reply = column === undefined ? null : drop(board, column, 'O');
      if (reply) board = reply.board;
      paint();
      result = winnerOf(board);
      if (result) return finish('loss', result.line);
      if (board.every(Boolean)) return finish('draw');
      status.textContent = 'Your turn.';
    }, 300);
  });

  root.querySelector('#c4-reset').addEventListener('click', () => {
    board = Array(ROWS * COLUMNS).fill('');
    over = false;
    status.textContent = 'Drop a disc into any column.';
    paint();
  });

  paint();
  return { destroy() {} };
}

function multiplayerBoard({ root, multiplayer }) {
  root.innerHTML = `
    <div class="game-stage">
      <div id="mp-header"></div>
      <p class="center small muted" id="c4-status"></p>
      <div id="c4-area"></div>
    </div>`;

  const area = root.querySelector('#c4-area');
  const status = root.querySelector('#c4-status');

  function paint(match, line = []) {
    const board = match.state.board || Array(ROWS * COLUMNS).fill('');
    const finished = match.status === 'finished';
    area.innerHTML = boardMarkup(board, { line, disabled: finished || !match.myTurn });
    root.querySelector('#mp-header').innerHTML = multiplayer.header(match);
    status.textContent = finished
      ? multiplayer.resultText(match)
      : (match.myTurn ? `Your turn - you are ${match.myMark === 'X' ? 'red' : 'yellow'}.`
        : `Waiting for ${multiplayer.opponent(match)?.displayName || 'your opponent'}...`);
  }

  area.addEventListener('click', (event) => {
    const button = event.target.closest('[data-column]');
    if (button) multiplayer.move({ column: Number(button.dataset.column) });
  });

  return { paint, destroy() {} };
}
