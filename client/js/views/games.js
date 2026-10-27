// ==========================================================
// The Gaming Hub landing page.
// ==========================================================
import { esc, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { store, on } from '../lib/store.js';
import { setPageTitle } from '../components/shell.js';
import { avatar, emptyState, openUserPicker } from '../components/common.js';
import { toast, confirmDialog } from '../lib/ui.js';
import { navigate } from '../lib/router.js';

const GAME_ICON = {
  tic_tac_toe: 'grid', rps: 'target', snake: 'zap', memory_match: 'brain',
  reaction: 'clock', number_guess: 'search', quiz_battle: 'book',
  typing: 'keyboard', connect_four: 'grid', market_world: 'cart'
};

export default async function games({ mount }) {
  setPageTitle('Gaming Hub');
  mount.innerHTML = '<div class="page page-wide"><div class="spinner spinner-center"></div></div>';

  let data;
  let invites = { incoming: [], outgoing: [] };
  let matches = { matches: [] };
  try {
    [data, invites, matches] = await Promise.all([api.games.hub(), api.games.invites(), api.games.matches()]);
  } catch (err) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({ iconName: 'warning', title: 'The Gaming Hub could not load', text: err.message })}</div>`;
    return;
  }

  if (!data.hubOpen) {
    mount.innerHTML = `<div class="page page-narrow">${emptyState({
      iconName: 'lock',
      title: 'The Gaming Hub is closed',
      text: 'An administrator has switched games off for now. Check back later.'
    })}</div>`;
    return;
  }

  render(mount, data, invites, matches);

  const offs = [
    on('game:invite', async () => { const fresh = await api.games.invites(); renderInvites(mount, fresh); }),
    on('game:match_started', ({ match }) => {
      toast('Your match is ready.', 'success');
      navigate(`/games/${match.gameKey}?match=${match.id}`);
    })
  ];
  return { destroy: () => offs.forEach((off) => off()) };
}

function render(mount, data, invites, matches) {
  const stats = data.myStats;
  mount.innerHTML = `
    <div class="page page-wide">
      <section class="hero-card game-hero">
        <div class="hero-glow"></div>
        <div class="hero-content">
          <div class="hero-main">
            <h1>Gaming Hub</h1>
            <p class="muted">Play on your own or challenge a classmate. Winning earns XP for the leaderboard.</p>
            <div class="row" style="margin-top:.9rem">
              <span class="badge badge-accent">${icon('zap', 12)} Win: +${data.xpRewards.win} XP</span>
              <span class="badge">${icon('target', 12)} Play: +${data.xpRewards.challenge} XP</span>
              <span class="badge badge-warning">${icon('trophy', 12)} Tournament: +${data.xpRewards.tournament} XP</span>
            </div>
          </div>
          <div class="grid grid-4" style="min-width:min(100%,340px)">
            <div class="stat"><div class="stat-body"><div class="stat-value">${stats.played}</div><div class="stat-label">Played</div></div></div>
            <div class="stat"><div class="stat-body"><div class="stat-value">${stats.wins}</div><div class="stat-label">Wins</div></div></div>
            <div class="stat"><div class="stat-body"><div class="stat-value">${stats.losses}</div><div class="stat-label">Losses</div></div></div>
            <div class="stat"><div class="stat-body"><div class="stat-value">${store.user.level}</div><div class="stat-label">Level</div></div></div>
          </div>
        </div>
      </section>

      <div id="invites-area">${renderInviteMarkup(invites, matches)}</div>

      <section style="margin-top:1.5rem">
        <div class="section-title">${icon('game', 14)} All games</div>
        <div class="grid grid-3">
          ${data.games.map((game) => gameCard(game, data.multiplayerEnabled)).join('')}
        </div>
      </section>

      <section style="margin-top:1.5rem" id="tournaments"></section>
    </div>`;

  wireGames(mount, data);
  loadTournaments(mount);
}

function gameCard(game, multiplayerEnabled) {
  return `
    <article class="card card-hover game-card ${game.enabled ? '' : 'disabled'}">
      <div class="game-card-top">
        <span class="game-icon">${icon(GAME_ICON[game.key] || 'game', 22)}</span>
        <div style="flex:1;min-width:0">
          <h3 style="margin:0">${esc(game.name)}</h3>
          <div class="row row-tight tiny faint">
            <span>${esc(game.category)}</span>
            ${game.multiplayer ? '<span class="badge badge-accent" style="font-size:.62rem">2 players</span>' : ''}
            ${game.enabled ? '' : '<span class="badge badge-danger" style="font-size:.62rem">Switched off</span>'}
          </div>
        </div>
      </div>
      <p class="small muted clamp-2" style="margin:.6rem 0 .9rem">${esc(game.description)}</p>
      <div class="row row-tight">
        <a class="btn btn-primary btn-sm" href="#/games/${esc(game.key)}" ${game.enabled ? '' : 'aria-disabled="true"'}>
          ${icon('play', 14)} Play
        </a>
        ${game.multiplayer && multiplayerEnabled && game.enabled
    ? `<button class="btn btn-sm" data-challenge="${esc(game.key)}">${icon('users', 14)} Challenge</button>`
    : ''}
        <a class="btn btn-sm btn-ghost" href="#/leaderboard?game=${esc(game.key)}">${icon('trophy', 14)}</a>
      </div>
    </article>`;
}

function renderInviteMarkup(invites, matches) {
  const active = matches.matches || [];
  if (!invites.incoming.length && !invites.outgoing.length && !active.length) return '';

  return `
    <section class="card" style="margin-top:1.25rem;border-color:var(--accent)">
      <div class="card-header">
        <span class="card-title-icon">${icon('users', 17)}</span>
        <h3>Multiplayer</h3>
      </div>

      ${active.length ? `
        <div class="section-title" style="margin-top:.3rem">Games in progress</div>
        <div class="list">
          ${active.map((match) => {
    const opponent = match.playerX?.id === store.user.id ? match.playerO : match.playerX;
    return `
              <a class="list-item" href="#/games/${esc(match.gameKey)}?match=${match.id}">
                ${avatar(opponent, 'sm', true)}
                <div class="meta">
                  <div class="title">vs ${esc(opponent?.displayName || 'Classmate')}</div>
                  <div class="sub">${match.myTurn ? 'Your turn' : 'Waiting for them'}</div>
                </div>
                ${match.myTurn ? '<span class="badge badge-success">Your turn</span>' : '<span class="badge">Waiting</span>'}
              </a>`;
  }).join('')}
        </div>` : ''}

      ${invites.incoming.length ? `
        <div class="section-title" style="margin-top:.8rem">Invitations for you</div>
        <div class="list">
          ${invites.incoming.map((invite) => `
            <div class="list-item">
              ${avatar(invite.from, 'sm', true)}
              <div class="meta">
                <div class="title">${esc(invite.from?.displayName || 'A classmate')} invited you to ${esc(invite.gameName)}</div>
                <div class="sub">Accept to start the match.</div>
              </div>
              <div class="row row-tight">
                <button class="btn btn-sm btn-primary" data-accept="${invite.id}">Accept</button>
                <button class="btn btn-sm" data-decline="${invite.id}">Decline</button>
              </div>
            </div>`).join('')}
        </div>` : ''}

      ${invites.outgoing.length ? `
        <div class="section-title" style="margin-top:.8rem">Waiting for a reply</div>
        <div class="list">
          ${invites.outgoing.map((invite) => `
            <div class="list-item">
              ${avatar(invite.to, 'sm', true)}
              <div class="meta">
                <div class="title">${esc(invite.to?.displayName || 'Classmate')}</div>
                <div class="sub">${esc(invite.gameName)} - waiting for an answer</div>
              </div>
              <button class="btn btn-sm btn-ghost" data-cancel="${invite.id}">Cancel</button>
            </div>`).join('')}
        </div>` : ''}
    </section>`;
}

async function renderInvites(mount, invites) {
  const matches = await api.games.matches();
  const area = mount.querySelector('#invites-area');
  if (area) area.innerHTML = renderInviteMarkup(invites, matches);
}

async function loadTournaments(mount) {
  const holder = mount.querySelector('#tournaments');
  if (!holder) return;
  try {
    const { tournaments } = await api.games.tournaments();
    if (!tournaments.length) { holder.innerHTML = ''; return; }
    holder.innerHTML = `
      <div class="section-title">${icon('trophy', 14)} Tournaments</div>
      <div class="grid grid-2">
        ${tournaments.map((t) => `
          <div class="card">
            <div class="row" style="justify-content:space-between;align-items:flex-start">
              <div style="min-width:0">
                <h3 style="margin:0">${esc(t.name)}</h3>
                <div class="tiny faint">${esc(t.gameName)} - ${esc(t.status)}</div>
              </div>
              ${t.joined
    ? '<span class="badge badge-success">Entered</span>'
    : `<button class="btn btn-sm btn-primary" data-join-tournament="${t.id}">Join</button>`}
            </div>
            ${t.description ? `<p class="small muted" style="margin-top:.6rem">${esc(t.description)}</p>` : ''}
            ${t.entries.length ? `
              <div class="list" style="margin-top:.5rem">
                ${t.entries.slice(0, 5).map((e, i) => `
                  <div class="list-item">
                    <span class="rank rank-${i + 1}">${i + 1}</span>
                    ${avatar(e.user, 'xs')}
                    <div class="meta"><div class="title">${esc(e.user?.displayName || '')}</div></div>
                    <span class="badge">${e.points} pts</span>
                  </div>`).join('')}
              </div>` : '<p class="small faint" style="margin-top:.5rem">No players have joined yet.</p>'}
          </div>`).join('')}
      </div>`;
  } catch { holder.innerHTML = ''; }
}

function wireGames(mount, data) {
  mount.addEventListener('click', async (event) => {
    const challenge = event.target.closest('[data-challenge]');
    if (challenge) {
      const key = challenge.dataset.challenge;
      openUserPicker({
        title: 'Challenge a classmate',
        confirmText: 'Invite',
        onPick: async (userId) => {
          try {
            await api.games.invite(key, userId);
            toast('Invitation sent. You will be told when they answer.', 'success');
            renderInvites(mount, await api.games.invites());
          } catch (err) { toast(err.message, 'error'); }
        }
      });
      return;
    }

    const accept = event.target.closest('[data-accept]');
    const decline = event.target.closest('[data-decline]');
    if (accept || decline) {
      const id = Number((accept || decline).dataset.accept || (accept || decline).dataset.decline);
      try {
        const result = await api.games.respondInvite(id, accept ? 'accept' : 'decline');
        if (result.status === 'accepted') navigate(`/games/${result.match.gameKey}?match=${result.match.id}`);
        else { toast('Invitation declined.', 'info'); renderInvites(mount, await api.games.invites()); }
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const cancel = event.target.closest('[data-cancel]');
    if (cancel) {
      try {
        await api.games.cancelInvite(Number(cancel.dataset.cancel));
        renderInvites(mount, await api.games.invites());
      } catch (err) { toast(err.message, 'error'); }
      return;
    }

    const joinTournament = event.target.closest('[data-join-tournament]');
    if (joinTournament) {
      try {
        await api.games.joinTournament(Number(joinTournament.dataset.joinTournament));
        toast('You are in the tournament.', 'success');
        loadTournaments(mount);
      } catch (err) { toast(err.message, 'error'); }
    }
  });
}
