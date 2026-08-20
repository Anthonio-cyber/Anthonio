// Quiz Battle - school subject questions against the clock.
import { icon } from '../lib/icons.js';
import { esc } from '../lib/dom.js';

const QUESTIONS = [
  { subject: 'Mathematics', q: 'What is 15% of 240?', options: ['36', '32', '24', '48'], answer: 0 },
  { subject: 'Mathematics', q: 'Solve for x:  3x + 7 = 22', options: ['3', '5', '7', '15'], answer: 1 },
  { subject: 'Mathematics', q: 'What is the area of a triangle with base 10 cm and height 6 cm?', options: ['60 cm2', '16 cm2', '30 cm2', '32 cm2'], answer: 2 },
  { subject: 'Mathematics', q: 'Which number is a prime number?', options: ['21', '27', '29', '33'], answer: 2 },
  { subject: 'Science', q: 'What gas do plants take in during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], answer: 2 },
  { subject: 'Science', q: 'What is the chemical symbol for gold?', options: ['Go', 'Au', 'Ag', 'Gd'], answer: 1 },
  { subject: 'Science', q: 'How many bones does an adult human body have?', options: ['206', '186', '224', '198'], answer: 0 },
  { subject: 'Science', q: 'Which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mars', 'Mercury'], answer: 3 },
  { subject: 'English', q: 'Which word is an adverb?', options: ['Quickly', 'Quick', 'Quicken', 'Quickness'], answer: 0 },
  { subject: 'English', q: 'What is the plural of "child"?', options: ['Childs', 'Childes', 'Children', 'Childrens'], answer: 2 },
  { subject: 'English', q: 'Which sentence uses the apostrophe correctly?', options: ["The dog's bone", "The dogs' bone's", "The dogs bone's", "Thes dog bone"], answer: 0 },
  { subject: 'Geography', q: 'Which is the longest river in Africa?', options: ['Congo', 'Niger', 'Nile', 'Zambezi'], answer: 2 },
  { subject: 'Geography', q: 'What is the capital city of Kenya?', options: ['Kampala', 'Nairobi', 'Dodoma', 'Kigali'], answer: 1 },
  { subject: 'Geography', q: 'Which layer of the Earth do we live on?', options: ['Mantle', 'Outer core', 'Crust', 'Inner core'], answer: 2 },
  { subject: 'History', q: 'In which year did the Second World War end?', options: ['1943', '1945', '1947', '1939'], answer: 1 },
  { subject: 'History', q: 'Who was the first President of Ghana?', options: ['Jomo Kenyatta', 'Nelson Mandela', 'Kwame Nkrumah', 'Julius Nyerere'], answer: 2 },
  { subject: 'ICT', q: 'What does CPU stand for?', options: ['Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Control Processing Unit'], answer: 1 },
  { subject: 'ICT', q: 'Which of these is an input device?', options: ['Monitor', 'Printer', 'Keyboard', 'Speaker'], answer: 2 }
];

export default function quiz({ root, onScore }) {
  const TOTAL = 8;
  const SECONDS = 15;
  let pool = [];
  let index = 0;
  let score = 0;
  let timeLeft = SECONDS;
  let timer = null;
  let answered = false;

  root.innerHTML = `
    <div class="game-stage">
      <div class="game-toolbar">
        <span class="badge badge-accent" id="quiz-progress">Question 1 / ${TOTAL}</span>
        <span class="badge" id="quiz-score">Score 0</span>
        <div class="spacer"></div>
        <button class="btn btn-sm" id="quiz-restart">${icon('refresh', 14)} Restart</button>
      </div>
      <div class="quiz-timer"><span id="quiz-timer-bar"></span></div>
      <div id="quiz-area"></div>
    </div>`;

  const area = root.querySelector('#quiz-area');
  const progress = root.querySelector('#quiz-progress');
  const scoreLabel = root.querySelector('#quiz-score');
  const timerBar = root.querySelector('#quiz-timer-bar');

  function start() {
    pool = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, TOTAL);
    index = 0;
    score = 0;
    scoreLabel.textContent = 'Score 0';
    show();
  }

  function show() {
    clearInterval(timer);
    answered = false;
    timeLeft = SECONDS;
    const question = pool[index];
    progress.textContent = `Question ${index + 1} / ${TOTAL}`;

    area.innerHTML = `
      <div class="quiz-card">
        <span class="badge badge-info">${esc(question.subject)}</span>
        <h3 class="quiz-question">${esc(question.q)}</h3>
        <div class="quiz-options">
          ${question.options.map((option, i) => `
            <button class="quiz-option" data-option="${i}">
              <span class="quiz-letter">${'ABCD'[i]}</span>
              <span>${esc(option)}</span>
            </button>`).join('')}
        </div>
      </div>`;

    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    requestAnimationFrame(() => {
      timerBar.style.transition = `width ${SECONDS}s linear`;
      timerBar.style.width = '0%';
    });

    timer = setInterval(() => {
      timeLeft -= 0.1;
      if (timeLeft <= 0) { clearInterval(timer); reveal(-1); }
    }, 100);

    area.querySelectorAll('[data-option]').forEach((button) => {
      button.addEventListener('click', () => reveal(Number(button.dataset.option)));
    });
  }

  function reveal(choice) {
    if (answered) return;
    answered = true;
    clearInterval(timer);
    timerBar.style.transition = 'none';

    const question = pool[index];
    const buttons = area.querySelectorAll('[data-option]');
    buttons.forEach((button, i) => {
      button.disabled = true;
      if (i === question.answer) button.classList.add('right');
      else if (i === choice) button.classList.add('wrong');
    });

    if (choice === question.answer) {
      score += 1;
      scoreLabel.textContent = `Score ${score}`;
    }

    setTimeout(() => {
      index += 1;
      if (index >= TOTAL) finish();
      else show();
    }, 1100);
  }

  function finish() {
    const percent = Math.round((score / TOTAL) * 100);
    area.innerHTML = `
      <div class="quiz-card center">
        <div class="quiz-final">${score} / ${TOTAL}</div>
        <p class="muted">${percent >= 75 ? 'Excellent work.' : (percent >= 50 ? 'Good effort - keep practising.' : 'Have another go, you will improve fast.')}</p>
        <button class="btn btn-primary" id="quiz-again">${icon('refresh', 15)} Play again</button>
      </div>`;
    area.querySelector('#quiz-again').addEventListener('click', start);
    onScore(score, score >= TOTAL / 2 ? 'win' : 'loss');
  }

  root.querySelector('#quiz-restart').addEventListener('click', start);
  start();

  return { destroy() { clearInterval(timer); } };
}

export { QUESTIONS };
