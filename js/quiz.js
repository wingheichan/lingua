// ============================================================
//  LINGUA QUEST - Quest Battle (Quiz)
//  - Single scene: monster left, human right, both animated
//  - 60-second countdown, +5 bonus per second remaining
//  - Full destruction animations for cave/house/characters
// ============================================================

const QuizGame = (() => {

  const MAX_SECONDS       = 60;
  const MAX_LIVES         = 3;
  const PTS_CORRECT       = 20;
  const PTS_BONUS_PER_SEC = 5;

  let words       = [];
  let allWords    = [];
  let currentIndex= 0;
  let score       = 0;
  let lives       = MAX_LIVES;
  let secondsLeft = MAX_SECONDS;
  let timerInterval = null;
  let active      = false;
  let answering   = false;

  const $ = id => document.getElementById(id);

  // ── Start ──────────────────────────────────────────────────
  function start() {
    const sub = App.state.selectedSubcategory;
    allWords = [];
    App.state.selectedLanguage.data.categories.forEach(cat =>
      cat.subcategories.forEach(s => allWords.push(...s.words))
    );

    words        = shuffle([...sub.words]);
    currentIndex = 0;
    score        = 0;
    lives        = MAX_LIVES;
    secondsLeft  = MAX_SECONDS;
    active       = true;
    answering    = false;

    $('quiz-quit').onclick = () => App.quitGame();

    // Reset scene elements
    resetScene();
    updateLives();
    startTimer();
    renderQuestion();
  }

  // ── Timer ──────────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!active) return;
      secondsLeft--;
      const el = $('quiz-timer');
      if (el) {
        el.textContent = App.formatTime(secondsLeft);
        el.style.color = secondsLeft <= 10 ? 'var(--accent-red2)' : 'var(--accent-gold)';
      }
      if (secondsLeft <= 0) { secondsLeft = 0; timeUp(); }
    }, 1000);
  }

  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

  function timeUp() {
    active = false;
    stopTimer();
    disableChoices();
    setTimeout(() => finishGame(false, true), 400);
  }

  // ── Scene reset ────────────────────────────────────────────
  function resetScene() {
    const monster = $('quiz-monster');
    const human   = $('quiz-human');
    const cave    = $('quiz-cave-group');
    const house   = $('quiz-house-group');

    [monster, human].forEach(el => {
      if (!el) return;
      el.style.transition = 'none';
      el.style.transform  = '';
      el.style.opacity    = '1';
      el.style.filter     = '';
    });
    [cave, house].forEach(el => {
      if (!el) return;
      el.style.transition = 'none';
      el.style.transform  = '';
      el.style.opacity    = '1';
    });
  }

  // ── Question ───────────────────────────────────────────────
  function renderQuestion() {
    if (currentIndex >= words.length) { triggerVictory(); return; }

    const word = words[currentIndex];
    answering = false;

    spawnMonster();

    $('quiz-q-text').textContent = word.question;
    $('quiz-q-num').textContent  = (currentIndex + 1) + ' / ' + words.length;

    const choices = buildChoices(word);
    const keys    = ['A', 'B', 'C', 'D'];
    document.querySelectorAll('.quiz-choice').forEach((btn, i) => {
      btn.disabled          = false;
      btn.className         = 'quiz-choice';
      btn.dataset.answer    = choices[i].answer;
      btn.dataset.correct   = choices[i].correct ? 'true' : 'false';
      btn.innerHTML         = `<span class="choice-key">${keys[i]}</span>${choices[i].answer}`;
      btn.onclick           = () => selectAnswer(btn);
    });

    $('quiz-score').textContent = score;
  }

  function buildChoices(word) {
    const correct = { answer: word.answer, correct: true };
    const wrongs  = allWords
      .filter(w => w.answer !== word.answer)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => ({ answer: w.answer, correct: false }));
    return shuffle([correct, ...wrongs]);
  }

  function disableChoices() {
    document.querySelectorAll('.quiz-choice').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });
  }

  // ── Answer selection ───────────────────────────────────────
  function selectAnswer(btn) {
    if (!active || answering) return;
    answering = true;

    const isCorrect = btn.dataset.correct === 'true';
    document.querySelectorAll('.quiz-choice').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
      else if (b === btn && !isCorrect) b.classList.add('wrong');
    });

    if (isCorrect) {
      score += PTS_CORRECT;
      $('quiz-score').textContent = score;
      triggerHumanAttack(() => {
        currentIndex++;
        if (currentIndex >= words.length) setTimeout(() => triggerVictory(), 300);
        else setTimeout(() => renderQuestion(), 600);
      });
    } else {
      lives--;
      updateLives();
      triggerMonsterAttack(() => {
        if (lives <= 0) setTimeout(() => triggerDefeat(), 300);
        else setTimeout(() => renderQuestion(), 600);
      });
    }
  }

  // ── Lives HUD ──────────────────────────────────────────────
  function updateLives() {
    const el = $('quiz-lives');
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      const h = document.createElement('span');
      h.className   = 'quiz-heart' + (i >= lives ? ' lost' : '');
      h.textContent = '❤️';
      el.appendChild(h);
    }
  }

  // ── Scene: spawn monster ───────────────────────────────────
  function spawnMonster() {
    const el = $('quiz-monster');
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform  = 'translateX(-120px) scale(0.3)';
    el.style.opacity    = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease';
      el.style.transform  = 'translateX(0) scale(1)';
      el.style.opacity    = '1';
    }));
  }

  // ── Scene: human attacks monster ──────────────────────────
  function triggerHumanAttack(cb) {
    const human   = $('quiz-human');
    const monster = $('quiz-monster');
    if (!human || !monster) { if (cb) cb(); return; }

    // Human runs left toward monster
    human.style.transition = 'transform 0.35s ease';
    human.style.transform  = 'translateX(-140px) scaleX(-1)';

    setTimeout(() => {
      // Impact flash on monster
      monster.style.transition = 'all 0.15s ease';
      monster.style.filter     = 'brightness(4) saturate(0)';
      monster.style.transform  = 'translateX(20px) scale(1.2)';

      setTimeout(() => {
        // Monster explodes / disintegrates
        monster.style.transition = 'all 0.4s ease';
        monster.style.transform  = 'translateX(60px) scale(0) rotate(180deg)';
        monster.style.opacity    = '0';
        monster.style.filter     = 'brightness(1)';

        // Human returns home
        human.style.transition   = 'transform 0.4s ease';
        human.style.transform    = 'translateX(0) scaleX(1)';

        setTimeout(() => {
          // Reset monster silently for next spawn
          monster.style.transition = 'none';
          monster.style.transform  = '';
          monster.style.opacity    = '1';
          monster.style.filter     = '';
          if (cb) cb();
        }, 420);
      }, 150);
    }, 350);
  }

  // ── Scene: monster attacks human ──────────────────────────
  function triggerMonsterAttack(cb) {
    const monster = $('quiz-monster');
    const human   = $('quiz-human');
    if (!monster || !human) { if (cb) cb(); return; }

    // Monster lunges right
    monster.style.transition = 'transform 0.35s ease';
    monster.style.transform  = 'translateX(140px) scaleX(-1)';

    setTimeout(() => {
      // Human hit flash + shake
      human.style.transition = 'all 0.15s ease';
      human.style.filter     = 'brightness(4) hue-rotate(300deg)';
      human.style.transform  = 'translateX(-15px)';

      setTimeout(() => {
        human.style.transform  = 'translateX(15px)';
        setTimeout(() => {
          human.style.transform  = '';
          human.style.filter     = '';

          // Monster returns
          monster.style.transition = 'transform 0.3s ease';
          monster.style.transform  = 'translateX(0) scaleX(1)';

          setTimeout(() => { if (cb) cb(); }, 320);
        }, 120);
      }, 150);
    }, 350);
  }

  // ── Victory: cave destroyed ────────────────────────────────
  function triggerVictory() {
    active = false;
    stopTimer();

    const cave    = $('quiz-cave-group');
    const monster = $('quiz-monster');
    const human   = $('quiz-human');

    // Human cheers
    if (human) {
      human.style.transition = 'transform 0.3s ease';
      human.style.transform  = 'translateY(-20px) scale(1.2)';
    }

    // Monster disappears
    if (monster) {
      monster.style.transition = 'all 0.3s ease';
      monster.style.opacity    = '0';
      monster.style.transform  = 'scale(0)';
    }

    // Cave crumbles with delay
    setTimeout(() => {
      if (cave) {
        cave.style.transition = 'all 0.8s cubic-bezier(0.55,0,1,0.45)';
        cave.style.transform  = 'translateY(40px) scale(0.1) rotate(-20deg)';
        cave.style.opacity    = '0';
      }
    }, 400);

    const bonusPoints = secondsLeft * PTS_BONUS_PER_SEC;
    const elapsed     = MAX_SECONDS - secondsLeft;

    App.Scores.add({
      player:      App.state.playerName || 'Player',
      game:        'quiz',
      language:    App.state.selectedLanguage.label,
      category:    App.state.selectedCategory.name,
      subcategory: App.state.selectedSubcategory.name,
      score:       score + bonusPoints,
      time:        elapsed,
      date:        new Date().toLocaleDateString('nl-NL'),
    });

    setTimeout(() => showResult(true, score + bonusPoints, bonusPoints, elapsed), 1200);
  }

  // ── Defeat: house destroyed ────────────────────────────────
  function triggerDefeat() {
    active = false;
    stopTimer();

    const house   = $('quiz-house-group');
    const human   = $('quiz-human');
    const monster = $('quiz-monster');

    // Monster cheers
    if (monster) {
      monster.style.transition = 'transform 0.3s ease';
      monster.style.transform  = 'scale(1.3)';
    }

    // Human falls
    if (human) {
      human.style.transition = 'all 0.5s ease';
      human.style.transform  = 'translateY(30px) rotate(90deg)';
      human.style.opacity    = '0';
    }

    // House collapses
    setTimeout(() => {
      if (house) {
        house.style.transition = 'all 0.9s cubic-bezier(0.55,0,1,0.45)';
        house.style.transform  = 'translateY(50px) scaleY(0.05) rotate(5deg)';
        house.style.opacity    = '0';
      }
    }, 300);

    const elapsed = MAX_SECONDS - secondsLeft;
    setTimeout(() => showResult(false, score, 0, elapsed), 1300);
  }

  function finishGame(won, timedOut) {
    if (won) triggerVictory();
    else if (timedOut) {
      const elapsed = MAX_SECONDS - secondsLeft;
      showResult(false, score, 0, elapsed);
    } else triggerDefeat();
  }

  // ── Result screen ──────────────────────────────────────────
  function showResult(won, finalScore, bonusPoints, elapsed) {
    document.getElementById('quiz-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${won ? '🏆' : '💀'}</div>
        <div class="result-title">${won ? 'Victory!' : 'Defeat!'}</div>
        <div class="result-subtitle">${won
          ? 'The cave is destroyed! All monsters defeated.' + (bonusPoints ? ' Bonus: +' + bonusPoints + ' pts' : '')
          : (lives <= 0 ? 'Three wrong answers — the village fell.' : 'Time ran out!')}</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${finalScore}</div><div class="result-stat-label">Final Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsed)}</div><div class="result-stat-label">Time Used</div></div>
          <div class="result-stat"><div class="result-stat-value">${currentIndex}</div><div class="result-stat-label">Correct</div></div>
          <div class="result-stat"><div class="result-stat-value">${MAX_LIVES - lives}</div><div class="result-stat-label">Mistakes</div></div>
          ${won && bonusPoints ? `<div class="result-stat"><div class="result-stat-value">+${bonusPoints}</div><div class="result-stat-label">Time Bonus</div></div>` : ''}
        </div>
        <div class="result-btns">
          <button class="btn-primary"   id="quiz-play-again">Play Again</button>
          <button class="btn-secondary" id="quiz-home">Home</button>
        </div>
      </div>
    `;
    $('quiz-play-again').onclick = () => { reset(); start(); };
    $('quiz-home').onclick       = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = answering = false;
    stopTimer();
    words = []; allWords = [];
    currentIndex = score = 0;
    secondsLeft = MAX_SECONDS;
    lives = MAX_LIVES;

    const c = document.getElementById('quiz-container');
    if (c && !$('quiz-q-text')) c.innerHTML = quizOriginalHTML;
  }

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
