// ==========================================================
// Server-side rules for the two-player games.
// The browser never decides who won - it only sends moves.
// ==========================================================

export function newState(gameKey) {
  switch (gameKey) {
    case 'tic_tac_toe':
      return { board: Array(9).fill(''), moves: 0 };
    case 'connect_four':
      return { board: Array(42).fill(''), moves: 0, columns: 7, rows: 6 };
    case 'rps':
      return { round: 1, picks: {}, scores: {}, history: [], target: 3 };
    case 'reaction':
      return { results: {}, target: 3 };
    case 'quiz_battle':
      return { index: 0, answers: {}, scores: {}, questions: [] };
    default:
      return {};
  }
}

const LINES_3 = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function ticTacToeWinner(board) {
  for (const [a, b, c] of LINES_3) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a], line: [a, b, c] };
  }
  return null;
}

function connectFourWinner(board, columns = 7, rows = 6) {
  const at = (r, c) => (r >= 0 && r < rows && c >= 0 && c < columns ? board[r * columns + c] : '');
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const mark = at(r, c);
      if (!mark) continue;
      for (const [dr, dc] of directions) {
        const cells = [[r, c]];
        for (let step = 1; step < 4; step += 1) {
          if (at(r + dr * step, c + dc * step) !== mark) break;
          cells.push([r + dr * step, c + dc * step]);
        }
        if (cells.length === 4) return { mark, line: cells.map(([rr, cc]) => rr * columns + cc) };
      }
    }
  }
  return null;
}

/**
 * Applies one move and reports the new state.
 * Returns { state, finished, winnerMark, draw, nextMark }.
 */
export function applyMove(gameKey, state, mark, move) {
  if (gameKey === 'tic_tac_toe') {
    const index = Number(move.index);
    if (!Number.isInteger(index) || index < 0 || index > 8) throw new Error('That square does not exist.');
    if (state.board[index]) throw new Error('That square is already taken.');
    const board = [...state.board];
    board[index] = mark;
    const next = { ...state, board, moves: state.moves + 1 };
    const win = ticTacToeWinner(board);
    return {
      state: next,
      finished: Boolean(win) || next.moves === 9,
      winnerMark: win?.mark || null,
      line: win?.line || null,
      draw: !win && next.moves === 9,
      nextMark: mark === 'X' ? 'O' : 'X'
    };
  }

  if (gameKey === 'connect_four') {
    const columns = state.columns || 7;
    const rows = state.rows || 6;
    const column = Number(move.column);
    if (!Number.isInteger(column) || column < 0 || column >= columns) throw new Error('That column does not exist.');
    const board = [...state.board];
    let placed = -1;
    for (let r = rows - 1; r >= 0; r -= 1) {
      if (!board[r * columns + column]) { board[r * columns + column] = mark; placed = r * columns + column; break; }
    }
    if (placed === -1) throw new Error('That column is full.');
    const next = { ...state, board, moves: state.moves + 1 };
    const win = connectFourWinner(board, columns, rows);
    return {
      state: next,
      finished: Boolean(win) || next.moves === columns * rows,
      winnerMark: win?.mark || null,
      line: win?.line || null,
      draw: !win && next.moves === columns * rows,
      nextMark: mark === 'X' ? 'O' : 'X'
    };
  }

  if (gameKey === 'rps') {
    const choice = String(move.choice || '').toLowerCase();
    if (!['rock', 'paper', 'scissors'].includes(choice)) throw new Error('Pick rock, paper or scissors.');
    const picks = { ...state.picks, [mark]: choice };
    const scores = { ...state.scores };
    const history = [...(state.history || [])];
    let round = state.round;

    if (picks.X && picks.O) {
      const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
      let roundWinner = null;
      if (picks.X !== picks.O) roundWinner = beats[picks.X] === picks.O ? 'X' : 'O';
      if (roundWinner) scores[roundWinner] = (scores[roundWinner] || 0) + 1;
      history.push({ round, x: picks.X, o: picks.O, winner: roundWinner });
      round += 1;
      const target = state.target || 3;
      const finished = (scores.X || 0) >= target || (scores.O || 0) >= target;
      return {
        state: { ...state, round, picks: {}, scores, history },
        finished,
        winnerMark: finished ? ((scores.X || 0) > (scores.O || 0) ? 'X' : 'O') : null,
        draw: false,
        nextMark: null
      };
    }
    return { state: { ...state, picks }, finished: false, winnerMark: null, draw: false, nextMark: null, waiting: true };
  }

  if (gameKey === 'reaction') {
    const ms = Number(move.ms);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 60_000) throw new Error('That reaction time is not valid.');
    const results = { ...state.results };
    results[mark] = [...(results[mark] || []), Math.round(ms)];
    const target = state.target || 3;
    const doneX = (results.X || []).length >= target;
    const doneO = (results.O || []).length >= target;
    const finished = doneX && doneO;
    let winnerMark = null;
    if (finished) {
      const avg = (list) => list.reduce((a, b) => a + b, 0) / list.length;
      const ax = avg(results.X);
      const ao = avg(results.O);
      winnerMark = ax === ao ? null : (ax < ao ? 'X' : 'O');
    }
    return { state: { ...state, results }, finished, winnerMark, draw: finished && !winnerMark, nextMark: null };
  }

  if (gameKey === 'quiz_battle') {
    const answers = { ...state.answers };
    const scores = { ...state.scores };
    const index = Number(move.index);
    const correct = Boolean(move.correct);
    const key = `${mark}:${index}`;
    if (answers[key] !== undefined) throw new Error('You already answered that question.');
    answers[key] = correct;
    if (correct) scores[mark] = (scores[mark] || 0) + 1;

    const total = Number(state.total || 5);
    const answeredX = Object.keys(answers).filter((k) => k.startsWith('X:')).length;
    const answeredO = Object.keys(answers).filter((k) => k.startsWith('O:')).length;
    const finished = answeredX >= total && answeredO >= total;
    let winnerMark = null;
    if (finished && (scores.X || 0) !== (scores.O || 0)) winnerMark = (scores.X || 0) > (scores.O || 0) ? 'X' : 'O';
    return { state: { ...state, answers, scores, total }, finished, winnerMark, draw: finished && !winnerMark, nextMark: null };
  }

  throw new Error('That game does not support multiplayer moves.');
}

/** Games where players take strict turns. */
export const TURN_BASED = new Set(['tic_tac_toe', 'connect_four']);
