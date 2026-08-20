// Number Guessing - find the secret number with as few guesses as possible.
import { icon } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

export default function numberGuess({ root, onScore }) {
  let max = 100;
  let secret = 0;
  let guesses = 0;
  let finished = false;

  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-accent" id="guess-count">Guesses 0</span>
        <div class="spacer"></div>
        <select class="select" id="guess-range" style="width:auto">
          <option value="50">1 to 50</option>
          <option value="100" selected>1 to 100</option>
          <option value="1000">1 to 1000</option>
        </select>
        <button class="btn btn-sm" id="guess-restart">${icon('refresh', 14)} New number</button>
      </div>

      <div class="guess-panel">
        <h3 id="guess-prompt">I am thinking of a number between 1 and 100.</h3>
        <form class="row" id="guess-form" style="justify-content:center">
          <input class="input" id="guess-input" type="number" inputmode="numeric" min="1" max="100"
                 placeholder="Your guess" style="max-width:170px;text-align:center;font-size:1.2rem" required>
          <button class="btn btn-primary" type="submit">Guess</button>
        </form>
        <div class="guess-feedback" id="guess-feedback"></div>
        <div class="guess-history" id="guess-history"></div>
      </div>
    </div>`;

  const prompt = root.querySelector('#guess-prompt');
  const input = root.querySelector('#guess-input');
  const feedback = root.querySelector('#guess-feedback');
  const history = root.querySelector('#guess-history');
  const counter = root.querySelector('#guess-count');

  function start() {
    max = Number(root.querySelector('#guess-range').value);
    secret = 1 + Math.floor(Math.random() * max);
    guesses = 0;
    finished = false;
    prompt.textContent = `I am thinking of a number between 1 and ${max}.`;
    input.max = String(max);
    input.value = '';
    input.disabled = false;
    feedback.textContent = '';
    feedback.className = 'guess-feedback';
    history.innerHTML = '';
    counter.textContent = 'Guesses 0';
    input.focus();
  }

  root.querySelector('#guess-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (finished) return;
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      feedback.textContent = `Enter a whole number between 1 and ${max}.`;
      feedback.className = 'guess-feedback warm';
      return;
    }

    guesses += 1;
    counter.textContent = `Guesses ${guesses}`;
    input.value = '';
    input.focus();

    if (value === secret) {
      finished = true;
      input.disabled = true;
      feedback.textContent = `Correct. ${secret} in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}.`;
      feedback.className = 'guess-feedback right';
      history.insertAdjacentHTML('beforeend', `<span class="badge badge-success">${value}</span>`);
      onScore(guesses, 'win');
      return;
    }

    const tooLow = value < secret;
    const distance = Math.abs(value - secret);
    const heat = distance <= max * 0.03 ? 'Very close. ' : (distance <= max * 0.1 ? 'Close. ' : '');
    feedback.textContent = `${heat}Try ${tooLow ? 'higher' : 'lower'}.`;
    feedback.className = `guess-feedback ${tooLow ? 'low' : 'high'}`;
    history.insertAdjacentHTML('beforeend', `<span class="badge ${tooLow ? 'badge-info' : 'badge-warning'}">${esc(String(value))} ${tooLow ? 'up' : 'down'}</span>`);
  });

  root.querySelector('#guess-restart').addEventListener('click', start);
  root.querySelector('#guess-range').addEventListener('change', start);

  start();
  return { destroy() {} };
}
