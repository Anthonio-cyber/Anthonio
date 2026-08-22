// ==========================================================
// Coding Hub - the celebration.
//
// celebrate({ title, subtitle, xp }) drops a blocky 3D character
// onto the screen who springs up and high-fives you. Every part is
// a real CSS 3D box, built here as six faces on a preserve-3d
// parent, so there is nothing to download and it works offline in
// the installed app.
//
// It never blocks anything: the stage ignores clicks except to
// dismiss itself, it clears itself up, and it refuses to stack.
// ==========================================================

const CONFETTI_COLOURS = ['#ffd166', '#ff2d9b', '#22d3ee', '#7c5cff', '#34d399', '#ffffff'];

let active = null;

/** Builds one solid box out of six faces. */
function box(className, { width, height, depth }) {
  const part = document.createElement('div');
  part.className = `cel-part ${className}`;
  part.style.width = `${width}px`;
  part.style.height = `${height}px`;

  const halfDepth = depth / 2;
  const faces = [
    ['front',  `translateZ(${halfDepth}px)`, width, height],
    ['back',   `rotateY(180deg) translateZ(${halfDepth}px)`, width, height],
    ['right',  `rotateY(90deg) translateZ(${width - halfDepth}px)`, depth, height],
    ['left',   `rotateY(-90deg) translateZ(${halfDepth}px)`, depth, height],
    ['top',    `rotateX(90deg) translateZ(${halfDepth}px)`, width, depth],
    ['bottom', `rotateX(-90deg) translateZ(${height - halfDepth}px)`, width, depth]
  ];

  for (const [name, transform, faceWidth, faceHeight] of faces) {
    const face = document.createElement('div');
    face.className = `cel-face ${name}`;
    face.style.width = `${faceWidth}px`;
    face.style.height = `${faceHeight}px`;
    face.style.transform = transform;
    part.append(face);
  }
  return part;
}

function buildCharacter() {
  const actor = document.createElement('div');
  actor.className = 'cel-actor';

  const head = box('cel-head', { width: 76, height: 70, depth: 48 });
  const visor = document.createElement('div');
  visor.className = 'cel-visor';
  visor.innerHTML = '<span class="cel-eye l"></span><span class="cel-eye r"></span>';
  head.append(visor);

  const torso = box('cel-torso', { width: 84, height: 86, depth: 46 });
  const chest = document.createElement('div');
  chest.className = 'cel-chest';
  torso.append(chest);

  const armLeft = box('cel-arm l', { width: 24, height: 84, depth: 24 });
  const armRight = box('cel-arm r', { width: 24, height: 84, depth: 24 });
  // The hand rides on the end of the arm, so it lands on the palm with it.
  armRight.append(box('cel-hand', { width: 30, height: 26, depth: 26 }));
  const legLeft = box('cel-leg l', { width: 26, height: 62, depth: 26 });
  const legRight = box('cel-leg r', { width: 26, height: 62, depth: 26 });

  actor.append(legLeft, legRight, torso, armLeft, armRight, head);
  return actor;
}

function buildPalm() {
  const palm = document.createElement('div');
  palm.className = 'cel-palm';
  palm.innerHTML = `
    <div class="cel-palm-shape"></div>
    <div class="cel-finger"></div>
    <div class="cel-finger"></div>
    <div class="cel-finger"></div>
    <div class="cel-finger"></div>`;
  return palm;
}

function buildConfetti(count = 40) {
  const wrap = document.createElement('div');
  wrap.className = 'cel-confetti';
  for (let i = 0; i < count; i += 1) {
    const bit = document.createElement('span');
    bit.className = 'cel-bit';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = 130 + Math.random() * 190;
    bit.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * distance - 60}px`);
    bit.style.setProperty('--dr', `${Math.round(Math.random() * 900 - 450)}deg`);
    const colour = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length];
    bit.style.background = colour;
    bit.style.color = colour;              // the glow follows the colour
    bit.style.animationDelay = `${1.05 + Math.random() * 0.18}s`;
    wrap.append(bit);
  }
  return wrap;
}

const escapeText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Shows the celebration.
 * @param {object} options
 * @param {string} options.title    the big line, e.g. "Lesson complete"
 * @param {string} [options.subtitle]
 * @param {number} [options.xp]     shown as a "+25 XP" pill
 * @param {number} [options.duration] how long before it clears itself
 */
export function celebrate({ title, subtitle = '', xp = 0, duration = 3400 } = {}) {
  // One at a time: a second win replaces the first rather than stacking.
  if (active) dismiss(true);

  const stage = document.createElement('div');
  stage.className = 'celebrate-stage tappable';
  stage.setAttribute('role', 'status');
  stage.setAttribute('aria-live', 'polite');

  const scene = document.createElement('div');
  scene.className = 'celebrate-scene';

  const copy = document.createElement('div');
  copy.className = 'cel-copy';
  copy.innerHTML = `
    <h2 class="cel-title">${escapeText(title)}</h2>
    ${subtitle ? `<p class="cel-sub">${escapeText(subtitle)}</p>` : ''}
    ${xp ? `<span class="cel-xp">+${Number(xp)} XP</span>` : ''}`;

  const impact = document.createElement('div');
  impact.className = 'cel-impact';
  impact.innerHTML = `
    <span class="cel-flash"></span>
    <span class="cel-ring"></span>
    <span class="cel-ring"></span>
    <span class="cel-ring"></span>`;

  const shadow = document.createElement('div');
  shadow.className = 'cel-shadow';

  const hint = document.createElement('div');
  hint.className = 'cel-hint';
  hint.textContent = 'Tap anywhere to carry on';

  const actor = buildCharacter();
  // The palm and the burst live inside the character so they always line up
  // with the hand, whatever the screen size.
  actor.append(buildPalm(), impact);

  scene.append(copy, actor, shadow, buildConfetti(), hint);
  stage.append(scene);
  document.body.append(stage);

  const timer = setTimeout(() => dismiss(), duration);
  const onClick = () => dismiss();
  const onKey = (event) => { if (event.key === 'Escape') dismiss(); };
  stage.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  active = { stage, timer, onKey };
  return dismiss;
}

function dismiss(immediate = false) {
  if (!active) return;
  const { stage, timer, onKey } = active;
  active = null;
  clearTimeout(timer);
  document.removeEventListener('keydown', onKey);

  if (immediate) { stage.remove(); return; }
  stage.classList.add('closing');
  stage.classList.remove('tappable');
  setTimeout(() => stage.remove(), 450);
}

/** A shorter version for smaller wins, with no character. */
export function sparkle(element) {
  if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  element.classList.remove('cel-sparkle');
  // Restart the animation even if the class is already there.
  void element.offsetWidth;
  element.classList.add('cel-sparkle');
  setTimeout(() => element.classList.remove('cel-sparkle'), 900);
}
