// Typing Challenge - words per minute and accuracy.
import { icon } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

const SENTENCES = [
  'The Grade 8 class is working on a science project about photosynthesis this term.',
  'Practice makes progress, so keep going even when the questions feel difficult.',
  'Our football team plays against Grade 9 on Friday afternoon after the last lesson.',
  'Reading for twenty minutes every evening makes a real difference to your writing.',
  'The coding club is building a small game that runs directly inside the browser.',
  'Remember to show every step of your working when you answer algebra questions.',
  'A good study plan breaks big topics into small pieces you can finish each day.',
  'The art club painted a new notice board for the corridor outside the library.'
];

export default function typing({ root, onScore }) {
  let target = '';
  let started = null;
  let finished = false;
  let timer = null;

  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-accent" id="typing-wpm">0 WPM</span>
        <span class="badge" id="typing-accuracy">100% accurate</span>
        <span class="badge" id="typing-time">0.0s</span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="typing-new">${icon('refresh', 14)} New sentence</button>
      </div>

      <div class="typing-target" id="typing-target"></div>
      <textarea class="textarea typing-input" id="typing-input" rows="3"
                placeholder="Start typing the sentence above..." autocomplete="off"
                autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
      <div id="typing-result"></div>
    </div>`;

  const targetBox = root.querySelector('#typing-target');
  const input = root.querySelector('#typing-input');
  const wpmLabel = root.querySelector('#typing-wpm');
  const accuracyLabel = root.querySelector('#typing-accuracy');
  const timeLabel = root.querySelector('#typing-time');
  const result = root.querySelector('#typing-result');

  function newSentence() {
    target = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    started = null;
    finished = false;
    clearInterval(timer);
    input.value = '';
    input.disabled = false;
    result.innerHTML = '';
    wpmLabel.textContent = '0 WPM';
    accuracyLabel.textContent = '100% accurate';
    timeLabel.textContent = '0.0s';
    paint('');
    input.focus();
  }

  function paint(typed) {
    targetBox.innerHTML = [...target].map((char, index) => {
      let cls = '';
      if (index < typed.length) cls = typed[index] === char ? 'right' : 'wrong';
      else if (index === typed.length) cls = 'next';
      return `<span class="${cls}">${esc(char === ' ' && cls === 'wrong' ? '_' : char)}</span>`;
    }).join('');
  }

  function stats(typed) {
    const elapsed = (Date.now() - started) / 1000;
    const correct = [...typed].filter((char, index) => char === target[index]).length;
    const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100;
    const wpm = elapsed > 0 ? Math.round((typed.length / 5) / (elapsed / 60)) : 0;
    return { elapsed, accuracy, wpm };
  }

  input.addEventListener('input', () => {
    if (finished) return;
    const typed = input.value;

    if (!started && typed.length) {
      started = Date.now();
      timer = setInterval(() => {
        if (finished) return;
        timeLabel.textContent = `${((Date.now() - started) / 1000).toFixed(1)}s`;
      }, 100);
    }

    paint(typed);
    if (started) {
      const { accuracy, wpm } = stats(typed);
      wpmLabel.textContent = `${wpm} WPM`;
      accuracyLabel.textContent = `${accuracy}% accurate`;
    }

    if (typed.length >= target.length) finish(typed);
  });

  function finish(typed) {
    finished = true;
    clearInterval(timer);
    input.disabled = true;
    const { elapsed, accuracy, wpm } = stats(typed);
    const adjusted = Math.max(0, Math.round(wpm * (accuracy / 100)));
    timeLabel.textContent = `${elapsed.toFixed(1)}s`;
    result.innerHTML = `
      <div class="alert ${accuracy >= 95 ? 'alert-success' : 'alert-warning'}" style="margin-top:1rem">
        ${icon(accuracy >= 95 ? 'check' : 'info', 17)}
        <div>
          <strong>${adjusted} WPM</strong> (${wpm} raw, ${accuracy}% accurate) in ${elapsed.toFixed(1)} seconds.
          ${accuracy < 95 ? '<br>Slow down a little - accuracy counts towards your score.' : ''}
        </div>
      </div>`;
    onScore(adjusted, 'played');
  }

  root.querySelector('#typing-new').addEventListener('click', newSentence);
  newSentence();

  return { destroy() { clearInterval(timer); } };
}
