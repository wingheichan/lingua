// ============================================================
//  LINGUA QUEST - Quest Battle (Quiz) Game
// ============================================================

const QuizGame = (() => {

  let words = [];
  let allWords = [];       // full pool for wrong choices
  let currentIndex = 0;
  let score = 0;
  let lives = 3;           // 3 wrong = game over
  let timerInterval = null;
  let elapsedSeconds = 0;
  let active = false;
  let answering = false;   // lock during feedback

  const MAX_LIVES = 3;

  // ── DOM refs ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Start ──────────────────────────────────────────────────
  function start() {
    const sub = App.state.selectedSubcategory;
    // Use all words from same language for wrong-choice pool
    allWords = [];
    App.state.selectedLanguage.data.categories.forEach(cat =>
      cat.subcategories.forEach(s => allWords.push(...s.words))
    );

    words = shuffle([...sub.words]);
    currentIndex = 0;
    score = 0;
    lives = MAX_LIVES;
    elapsedSeconds = 0;
    active = true;
    answering = false;

    $('quiz-quit').onclick = () => App.quitGame();
    updateLives();
    startTimer();
    renderQuestion();
  }

  // ── Timer ──────────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!active) return;
      elapsedSeconds++;
      $('quiz-timer').textContent = App.formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // ── Question ───────────────────────────────────────────────
  function renderQuestion() {
    if (currentIndex >= words.length) {
      triggerVictory();
      return;
    }

    const word = words[currentIndex];
    answering = false;

    // Spawn monster from cave
    spawnMonster();

    // Question text
    $('quiz-q-text').textContent = word.question;
    $('quiz-q-num').textContent = (currentIndex + 1) + ' / ' + words.length;

    // Build 4 choices: 1 correct + 3 random wrong
    const choices = buildChoices(word);
    const choiceEls = document.querySelectorAll('.quiz-choice');
    const keys = ['A', 'B', 'C', 'D'];

    choiceEls.forEach((btn, i) => {
      btn.disabled = false;
      btn.className = 'quiz-choice';
      btn.dataset.answer = choices[i].answer;
      btn.dataset.correct = choices[i].correct ? 'true' : 'false';
      btn.innerHTML = `<span class="choice-key">${keys[i]}</span>${choices[i].answer}`;
      btn.onclick = () => selectAnswer(btn);
    });

    $('quiz-score').textContent = score;
  }

  function buildChoices(word) {
    const correct = { answer: word.answer, correct: true };
    const wrongs = allWords
      .filter(w => w.answer !== word.answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => ({ answer: w.answer, correct: false }));

    const all = [correct, ...wrongs];
    return shuffle(all);
  }

  // ── Answer selection ───────────────────────────────────────
  function selectAnswer(btn) {
    if (!active || answering) return;
    answering = true;

    const isCorrect = btn.dataset.correct === 'true';

    // Highlight all correct/wrong
    document.querySelectorAll('.quiz-choice').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
      else if (b === btn && !isCorrect) b.classList.add('wrong');
    });

    if (isCorrect) {
      score += 20;
      $('quiz-score').textContent = score;
      // Human attacks monster
      triggerHumanAttack(() => {
        currentIndex++;
        if (currentIndex >= words.length) {
          setTimeout(() => triggerVictory(), 600);
        } else {
          setTimeout(() => renderQuestion(), 900);
        }
      });
    } else {
      lives--;
      updateLives();
      triggerMonsterAttack(() => {
        if (lives <= 0) {
          setTimeout(() => triggerDefeat(), 600);
        } else {
          setTimeout(() => renderQuestion(), 900);
        }
      });
    }
  }

  // ── Lives HUD ──────────────────────────────────────────────
  function updateLives() {
    const el = $('quiz-lives');
    el.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      const h = document.createElement('span');
      h.className = 'quiz-heart' + (i >= lives ? ' lost' : '');
      h.textContent = '❤️';
      el.appendChild(h);
    }
  }

  // ── Scene animations ───────────────────────────────────────
  function spawnMonster() {
    const el = $('quiz-monster');
    el.style.opacity = '0';
    el.style.transform = 'translateX(-80px)';
    requestAnimationFrame(() => {
      el.style.transition = 'all 0.5s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });
  }

  function triggerHumanAttack(cb) {
    const human   = $('quiz-human');
    const monster = $('quiz-monster');

    // Human slides toward monster
    human.style.transition = 'transform 0.3s ease';
    human.style.transform = 'translateX(-50px)';
    setTimeout(() => {
      // Monster hit flash then disappear
      monster.style.transition = 'all 0.3s ease';
      monster.style.transform = 'translateX(30px) scale(0.1)';
      monster.style.opacity = '0';
      human.style.transform = 'translateX(0)';
      setTimeout(() => {
        monster.style.transition = 'none';
        monster.style.transform = '';
        monster.style.opacity = '1';
        if (cb) cb();
      }, 400);
    }, 300);
  }

  function triggerMonsterAttack(cb) {
    const monster = $('quiz-monster');
    const human   = $('quiz-human');

    monster.style.transition = 'transform 0.3s ease';
    monster.style.transform = 'translateX(50px)';
    setTimeout(() => {
      human.style.transition = 'all 0.2s ease';
      human.style.filter = 'brightness(3)';
      monster.style.transform = 'translateX(0)';
      setTimeout(() => {
        human.style.filter = '';
        if (cb) cb();
      }, 400);
    }, 300);
  }

  function triggerVictory() {
    active = false;
    stopTimer();

    // Destroy cave animation
    const cave = $('quiz-cave');
    if (cave) {
      cave.style.transition = 'all 0.8s ease';
      cave.style.transform = 'scale(2)';
      cave.style.opacity = '0';
    }

    App.Scores.add({
      game: 'quiz',
      language: App.state.selectedLanguage.label,
      category: App.state.selectedCategory.name,
      subcategory: App.state.selectedSubcategory.name,
      score,
      time: elapsedSeconds,
      date: new Date().toLocaleDateString('nl-NL'),
    });

    setTimeout(() => showResult(true), 800);
  }

  function triggerDefeat() {
    active = false;
    stopTimer();

    // Destroy house animation
    const house = $('quiz-house');
    if (house) {
      house.style.transition = 'all 0.8s ease';
      house.style.transform = 'scale(0) rotate(15deg)';
      house.style.opacity = '0';
    }

    setTimeout(() => showResult(false), 800);
  }

  // ── Result screen ──────────────────────────────────────────
  function showResult(won) {
    document.getElementById('quiz-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${won ? '🏆' : '💀'}</div>
        <div class="result-title">${won ? 'Victory!' : 'Defeat!'}</div>
        <div class="result-subtitle">${won
          ? 'The cave is destroyed! All monsters defeated.'
          : 'Three wrong answers — the village fell.'}</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${score}</div><div class="result-stat-label">Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsedSeconds)}</div><div class="result-stat-label">Time</div></div>
          <div class="result-stat"><div class="result-stat-value">${currentIndex}</div><div class="result-stat-label">Correct</div></div>
          <div class="result-stat"><div class="result-stat-value">${MAX_LIVES - lives}</div><div class="result-stat-label">Mistakes</div></div>
        </div>
        <div class="result-btns">
          <button class="btn-primary" id="quiz-play-again">Play Again</button>
          <button class="btn-secondary" id="quiz-home">Home</button>
        </div>
      </div>
    `;
    $('quiz-play-again').onclick = () => { reset(); start(); };
    $('quiz-home').onclick = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = false;
    answering = false;
    stopTimer();
    words = [];
    allWords = [];
    currentIndex = score = elapsedSeconds = 0;
    lives = MAX_LIVES;

    const c = document.getElementById('quiz-container');
    if (c && !$('quiz-q-text')) c.innerHTML = quizOriginalHTML;
  }

  // ── Utility ────────────────────────────────────────────────
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let quizOriginalHTML = '';
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('quiz-container');
    if (c) quizOriginalHTML = c.innerHTML;
  });

  return { start, reset };
})();
