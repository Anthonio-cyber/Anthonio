// ==========================================================
// Hosts one game. Loads the right module, submits scores and
// keeps a live match in step with the server.
// ==========================================================
import { esc } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, on } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, openUserPicker } from '../components/common.js';
import { toast, confirmDialog } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

const LOADERS = {
  tic_tac_toe: () => import('../games/tictactoe.js'),
  connect_four: () => import('../games/connect-four.js'),
  rps: () => import('../games/rps.js'),
  snake: () => import('../games/snake.js'),
  memory_match: () => import('../games/memory.js'),
  reaction: () => import('../games/reaction.js'),
  number_guess: () => import('../games/number-guess.js'),
  quiz_battle: () => import('../games/quiz.js'),
  typing: () => import('../games/typing.js')
};

export default async function gamePlay({ mount, params, query }) {
  const key = params.key;
  mount.innerHTML = '<div class="page page-narrow"><div class="spinner spinner-center"></div></div>';

  let hub;
  let scores;
  try {
    [hub, scores] = await Promise.all([api.games.hub(), api.games.scores(key)]);
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({ iconName: 'warning', title: 'Could not open this game', text: err.message })}</div>`;
    return;
  }

  const game = hub.games.find((g) => g.key === key);
  if (!game) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'game', title: 'That game does not exist',
      action: '<a class="btn btn-primary" href="#/games">Back to the Gaming Hub</a>'
    })}</div>`;
    return;
  }
  setPageTitle(game.name);

  const matchId = query.match ? Number(query.match) : null;

  mount.innerHTML = `
    <div class="page page-wide">
      <div class="row" style="margin-bottom:1rem">
        <a class="btn btn-sm btn-ghost" href="#/games">${icon('arrowLeft', 15)} Gaming Hub</a>
        <div class="spacer"></div>
        ${game.multiplayer && hub.multiplayerEnabled && !matchId
    ? `<button class="btn btn-sm" id="challenge">${icon('users', 14)} Challenge a classmate</button>` : ''}
        ${matchId ? `<button class="btn btn-sm btn-danger" id="resign">${icon('flag', 14)} Resign</button>` : ''}
      </div>

      <div class="with-rail">
        <div>
          <div class="card">
            <div class="card-header">
              <span class="card-title-icon">${icon('game', 17)}</span>
              <div style="flex:1;min-width:0">
                <h2 style="margin:0">${esc(game.name)}</h2>
                <p class="tiny faint" style="margin:0">${esc(game.description)}</p>
              </div>
            </div>
            <div id="game-root"></div>
          </div>
        </div>

        <aside class="rail">
          <div class="card" id="score-card"></div>
          <div class="card">
            <div class="card-header">
              <span class="card-title-icon" style="background:var(--warning-soft);color:var(--warning)">${icon('zap', 17)}</span>
              <h3>Earning XP</h3>
            </div>
            <ul class="rule-list small muted">
              <li>Win a game: <strong>+${hub.xpRewards.win} XP</strong></li>
              <li>Finish a challenge: <strong>+${hub.xpRewards.challenge} XP</strong></li>
              <li>Win a tournament: <strong>+${hub.xpRewards.tournament} XP</strong></li>
            </ul>
            <p class="tiny faint" style="margin:0">Game XP is only for the Gaming Hub leaderboard. It has nothing to do with your school grades.</p>
          </div>
        </aside>
      </div>
    </div>`;

  renderScoreCard(mount, scores);

  const gameRoot = mount.querySelector('#game-root');
  const loader = LOADERS[key];
  if (!loader) {
    gameRoot.innerHTML = emptyState({ iconName: 'game', title: 'This game is not playable yet' });
    return;
  }

  const module = await loader();
  let instance = null;
  let offs = [];

  if (matchId) {
    instance = await startMultiplayer({ mount, module, gameRoot, matchId, game });
    offs = instance.offs || [];
  } else {
    instance = module.default({
      root: gameRoot,
      onScore: async (score, result) => {
        try {
          const response = await api.games.submitScore(key, score, result);
          toast(`+${response.xpAwarded} XP`, 'success', result === 'win' ? 'You won.' : 'Score saved');
          renderScoreCard(mount, await api.games.scores(key));
        } catch (err) { toast(err.message, 'error'); }
      }
    });
  }

  mount.querySelector('#challenge')?.addEventListener('click', () => {
    openUserPicker({
      title: `Challenge a classmate to ${game.name}`,
      confirmText: 'Invite',
      onPick: async (userId) => {
        try {
          await api.games.invite(key, userId);
          toast('Invitation sent.', 'success');
        } catch (err) { toast(err.message, 'error'); }
      }
    });
  });

  mount.querySelector('#resign')?.addEventListener('click', async () => {
    const yes = await confirmDialog({ title: 'Resign this match?', message: 'Your opponent will win.', confirmText: 'Resign', danger: true });
    if (!yes) return;
    try {
      await api.games.resign(matchId);
      toast('You resigned.', 'info');
    } catch (err) { toast(err.message, 'error'); }
  });

  return {
    destroy() {
      instance?.destroy?.();
      offs.forEach((off) => off());
    }
  };
}

function renderScoreCard(mount, scores) {
  const card = mount.querySelector('#score-card');
  if (!card) return;
  const label = scores.game.scoreLabel;
  card.innerHTML = `
    <div class="card-header">
      <span class="card-title-icon" style="background:var(--warning-soft);color:var(--warning)">${icon('trophy', 17)}</span>
      <h3>Best ${esc(label.toLowerCase())}</h3>
    </div>
    ${scores.scores.length
    ? `<div class="list">${scores.scores.slice(0, 10).map((entry) => `
        <a class="list-item" href="#/profile/${esc(entry.user?.username || '')}">
          <span class="rank rank-${entry.rank}">${entry.rank}</span>
          ${avatar(entry.user, 'xs')}
          <div class="meta">
            <div class="title">${esc(entry.user?.displayName || 'Unknown')}</div>
            <div class="sub">${entry.plays} ${entry.plays === 1 ? 'game' : 'games'}</div>
          </div>
          <span class="badge badge-accent">${entry.best}</span>
        </a>`).join('')}</div>`
    : '<p class="small faint center">No scores yet. Be the first.</p>'}`;
}

// ---------------------------------------------------------------------------
// Live two-player matches
// ---------------------------------------------------------------------------
async function startMultiplayer({ mount, module, gameRoot, matchId, game }) {
  let match;
  try {
    ({ match } = await api.games.match(matchId));
  } catch (err) {
    gameRoot.innerHTML = emptyState({ iconName: 'warning', title: 'Could not open the match', text: err.message });
    return { destroy() {} };
  }

  const helpers = {
    opponent: (m) => (m.playerX?.id === store.user.id ? m.playerO : m.playerX),
    header: (m) => {
      const me = m.myMark === 'X' ? m.playerX : m.playerO;
      const them = helpers.opponent(m);
      return `
        <div class="mp-header">
          <div class="mp-player ${m.turnUserId === me?.id ? 'turn' : ''}">
            ${avatar(me, 'sm')}
            <div><div class="bold small">You</div><div class="tiny faint">${m.myMark}</div></div>
          </div>
          <span class="mp-vs">vs</span>
          <div class="mp-player ${m.turnUserId === them?.id ? 'turn' : ''}">
            ${avatar(them, 'sm', true)}
            <div><div class="bold small">${esc(them?.displayName || 'Opponent')}</div>
            <div class="tiny faint">${m.myMark === 'X' ? 'O' : 'X'}</div></div>
          </div>
        </div>`;
    },
    resultText: (m) => {
      if (!m.winnerId) return 'The match ended in a draw.';
      return m.winnerId === store.user.id ? 'You won the match.' : `${helpers.opponent(m)?.displayName || 'Your opponent'} won.`;
    },
    move: async (payload) => {
      try {
        const result = await api.games.move(matchId, payload);
        match = result.match;
        instance.paint?.(match, result.line || []);
        if (result.finished) announce(result);
      } catch (err) { toast(err.message, 'warning'); }
    }
  };

  const instance = module.default({ root: gameRoot, multiplayer: helpers, onScore: () => {} });
  instance.paint?.(match, []);
  store.socket?.emit('match:watch', matchId);

  function announce(payload) {
    const won = payload.match?.winnerId === store.user.id;
    const draw = payload.draw || !payload.match?.winnerId;
    toast(draw ? 'The match is a draw.' : (won ? 'You won the match.' : 'Your opponent won this one.'),
      draw ? 'info' : (won ? 'success' : 'warning'), game.name);
  }

  const off = on('game:match_update', (payload) => {
    if (payload.match.id !== matchId) return;
    match = payload.match;
    instance.paint?.(match, payload.line || []);
    if (payload.finished && payload.match.status === 'finished') announce(payload);
  });

  return { ...instance, offs: [off] };
}
