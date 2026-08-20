// Snake - grid based, keyboard and touch controls.
import { icon } from '../lib/icons.js';

export default function snake({ root, onScore }) {
  const SIZE = 20;
  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-accent" id="snake-score">Score 0</span>
        <span class="badge" id="snake-best">Best 0</span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="snake-start">${icon('play', 14)} Start</button>
      </div>
      <canvas id="snake-canvas" width="400" height="400" class="game-canvas" aria-label="Snake game board"></canvas>
      <p class="small faint center" id="snake-hint">Use the arrow keys, WASD, or swipe on a touch screen.</p>
      <div class="dpad" id="snake-dpad">
        <button data-dir="up" aria-label="Up">${icon('chevronDown', 20)}</button>
        <button data-dir="left" aria-label="Left">${icon('chevronDown', 20)}</button>
        <button data-dir="down" aria-label="Down">${icon('chevronDown', 20)}</button>
        <button data-dir="right" aria-label="Right">${icon('chevronDown', 20)}</button>
      </div>
    </div>`;

  const canvas = root.querySelector('#snake-canvas');
  const ctx = canvas.getContext('2d');
  const scoreLabel = root.querySelector('#snake-score');
  const bestLabel = root.querySelector('#snake-best');
  const startButton = root.querySelector('#snake-start');

  let snakeBody = [];
  let direction = { x: 1, y: 0 };
  let queued = null;
  let food = { x: 10, y: 10 };
  let score = 0;
  let best = Number(localStorage.getItem('g8h-snake-best') || 0);
  let timer = null;
  let speed = 130;
  let running = false;

  bestLabel.textContent = `Best ${best}`;

  const colors = () => {
    const styles = getComputedStyle(document.documentElement);
    return {
      grid: styles.getPropertyValue('--border').trim(),
      snake: styles.getPropertyValue('--accent').trim(),
      head: styles.getPropertyValue('--accent-2').trim(),
      food: styles.getPropertyValue('--danger').trim(),
      bg: styles.getPropertyValue('--surface-2').trim()
    };
  };

  function reset() {
    snakeBody = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
    direction = { x: 1, y: 0 };
    queued = null;
    score = 0;
    speed = 130;
    placeFood();
    scoreLabel.textContent = 'Score 0';
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
    } while (snakeBody.some((part) => part.x === food.x && part.y === food.y));
  }

  function draw() {
    const c = colors();
    const cell = canvas.width / SIZE;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < SIZE; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
    }

    ctx.fillStyle = c.food;
    ctx.beginPath();
    ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell / 2.6, 0, Math.PI * 2);
    ctx.fill();

    snakeBody.forEach((part, index) => {
      ctx.fillStyle = index === 0 ? c.head : c.snake;
      const inset = index === 0 ? 1 : 2;
      ctx.beginPath();
      ctx.roundRect(part.x * cell + inset, part.y * cell + inset, cell - inset * 2, cell - inset * 2, 4);
      ctx.fill();
    });
  }

  function step() {
    if (queued) { direction = queued; queued = null; }
    const head = { x: snakeBody[0].x + direction.x, y: snakeBody[0].y + direction.y };

    if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE
      || snakeBody.some((part) => part.x === head.x && part.y === head.y)) {
      return gameOver();
    }

    snakeBody.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreLabel.textContent = `Score ${score}`;
      if (speed > 60) { speed -= 3; restartTimer(); }
      placeFood();
    } else {
      snakeBody.pop();
    }
    draw();
  }

  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(step, speed);
  }

  function start() {
    reset();
    running = true;
    startButton.innerHTML = `${icon('refresh', 14)} Restart`;
    root.querySelector('#snake-hint').textContent = 'Eat the red dots. Do not hit the wall or yourself.';
    draw();
    restartTimer();
  }

  function gameOver() {
    clearInterval(timer);
    running = false;
    if (score > best) {
      best = score;
      localStorage.setItem('g8h-snake-best', String(best));
      bestLabel.textContent = `Best ${best}`;
    }
    const cell = canvas.width / SIZE;
    ctx.fillStyle = 'rgba(4,6,14,.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('Game over', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`Score ${score}`, canvas.width / 2, canvas.height / 2 + 18);
    startButton.innerHTML = `${icon('play', 14)} Play again`;
    onScore(score, 'played');
  }

  function turn(name) {
    const map = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
      left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
    };
    const next = map[name];
    if (!next || !running) return;
    if (next.x === -direction.x && next.y === -direction.y) return;
    queued = next;
  }

  const onKey = (event) => {
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right'
    };
    const name = map[event.key];
    if (!name) return;
    event.preventDefault();
    turn(name);
  };
  document.addEventListener('keydown', onKey);

  root.querySelector('#snake-dpad').addEventListener('click', (event) => {
    const button = event.target.closest('[data-dir]');
    if (button) turn(button.dataset.dir);
  });

  let touchStart = null;
  canvas.addEventListener('touchstart', (event) => {
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', (event) => {
    if (!touchStart) return;
    const dx = event.touches[0].clientX - touchStart.x;
    const dy = event.touches[0].clientY - touchStart.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    touchStart = null;
  }, { passive: true });

  startButton.addEventListener('click', start);
  reset();
  draw();

  return {
    destroy() {
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
    }
  };
}
