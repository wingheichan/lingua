// ============================================================
//  LINGUA QUEST - Fill in Letters Game
//  - 20 words (sampled from pool, repeated if pool < 20)
//  - 60-second countdown timer
//  - +5 bonus per second remaining on finish
// ============================================================

const FillGame = (() => {

  const WORD_TARGET  = 20;
  const MAX_SECONDS  = 60;
  const PTS_CORRECT  = 10;
  const PTS_BONUS_PER_SEC = 5;

  let words = [];
  let currentIndex = 0;
  let currentWord  = null;
  let missingIndex = -1;
  let score        = 0;
  let secondsLeft  = MAX_SECONDS;
  let timerInterval= null;
  let active       = false;

  // ── DOM refs ───────────────────────────────────────────────
  const dom = () => ({
    progressBar:  document.getElementById('fill-progress-bar'),
    progressText: document.getElementById('fill-progress-text'),
    hintLabel:    document.getElementById('fill-hint-answer'),
    wordDisplay:  document.getElementById('fill-word-display'),
    input:        document.getElementById('fill-input'),
    feedback:     document.getElementById('fill-feedback'),
    scoreEl:      document.getElementById('fill-score'),
    timerEl:      document.getElementById('fill-timer'),
    btnQuit:      document.getElementById('fill-quit'),
  });

  // ── Build 20-word list (repeat pool if needed) ─────────────
  function buildWordList(pool) {
    const shuffled = shuffle([...pool]);
    const result = [];
    while (result.length < WORD_TARGET) {
      result.push(...shuffle([...pool]));
    }
    return result.slice(0, WORD_TARGET);
  }

  // ── Start ──────────────────────────────────────────────────
  function start() {
    const sub = App.state.selectedSubcategory;
    words        = buildWordList(sub.words);
    currentIndex = 0;
    score        = 0;
    secondsLeft  = MAX_SECONDS;
    active       = true;

    const d = dom();
    d.btnQuit.onclick = () => App.quitGame();
    d.input.addEventListener('keydown', handleKey);

    updateTimerDisplay();
    startTimer();
    loadWord();
    d.input.focus();
  }

  // ── Timer ──────────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!active) return;
      secondsLeft--;
      updateTimerDisplay();
      if (secondsLeft <= 0) {
        secondsLeft = 0;
        timeUp();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateTimerDisplay() {
    const d = dom();
    if (!d.timerEl) return;
    d.timerEl.textContent = App.formatTime(secondsLeft);
    // Warn when low
    d.timerEl.style.color = secondsLeft <= 10 ? 'var(--redstone)' : 'var(--gold)';
  }

  function timeUp() {
    active = false;
    stopTimer();
    const d = dom();
    if (d.feedback) {
      d.feedback.textContent = '⏰ Time is up!';
      d.feedback.className = 'fill-feedback wrong';
    }
    setTimeout(() => finishGame(false), 800);
  }

  // ── Load next word ─────────────────────────────────────────
  function loadWord() {
    const d = dom();
    if (currentIndex >= words.length) {
      finishGame(true);
      return;
    }

    currentWord = words[currentIndex];

    const pct = Math.round((currentIndex / words.length) * 100);
    d.progressBar.style.width = pct + '%';
    d.progressText.textContent = (currentIndex + 1) + ' / ' + words.length;
    d.hintLabel.textContent = currentWord.answer;

    const q = currentWord.question;
    const candidates = [];
    for (let i = 0; i < q.length; i++) {
      if (/[a-zA-ZÀ-ÿα-ωΑ-Ω]/u.test(q[i])) candidates.push(i);
    }
    missingIndex = candidates[Math.floor(Math.random() * candidates.length)];

    d.input.value = '';
    d.feedback.textContent = '';
    d.feedback.className = 'fill-feedback';
    d.scoreEl.textContent = score;

    renderWordDisplay(false);
    d.input.focus();
  }

  // ── Render word with blank ─────────────────────────────────
  function renderWordDisplay(showError) {
    const d = dom();
    const q = currentWord.question;
    d.wordDisplay.innerHTML = '';

    for (let i = 0; i < q.length; i++) {
      const ch = q[i];
      if (ch === ' ') {
        const sp = document.createElement('div');
        sp.className = 'letter-box space';
        d.wordDisplay.appendChild(sp);
      } else if (i === missingIndex) {
        const box = document.createElement('div');
        box.className = 'letter-box missing' + (showError ? ' error' : '');
        box.id = 'missing-box';
        box.textContent = d.input.value.toUpperCase() || '_';
        d.wordDisplay.appendChild(box);
      } else {
        const box = document.createElement('div');
        box.className = 'letter-box';
        box.textContent = ch;
        d.wordDisplay.appendChild(box);
      }
    }
  }

  // ── Key handler ────────────────────────────────────────────
  function handleKey(e) {
    if (!active) return;
    setTimeout(() => renderWordDisplay(false), 0);
    if (e.key === 'Enter') {
      const typed = dom().input.value.trim();
      if (typed) checkAnswer(typed);
    }
  }

  // ── Check answer ───────────────────────────────────────────
  function checkAnswer(typed) {
    const d = dom();
    const correct = currentWord.question[missingIndex];

    if (typed.toLowerCase() === correct.toLowerCase()) {
      score += PTS_CORRECT;
      d.scoreEl.textContent = score;
      d.feedback.textContent = '✓ Correct!';
      d.feedback.className = 'fill-feedback correct';

      renderWordDisplay(false);
      const box = document.getElementById('missing-box');
      if (box) {
        box.textContent = correct;
        box.style.borderColor = 'var(--emerald)';
        box.style.color = 'var(--grass-dark)';
      }

      setTimeout(() => { currentIndex++; loadWord(); }, 700);
    } else {
      d.feedback.textContent = '✗ Try again…';
      d.feedback.className = 'fill-feedback wrong';
      renderWordDisplay(true);
      d.input.value = '';
      setTimeout(() => { renderWordDisplay(false); d.input.focus(); }, 500);
    }
  }

  // ── Finish ─────────────────────────────────────────────────
  function finishGame(completed) {
    active = false;
    stopTimer();

    const bonusPoints = completed ? secondsLeft * PTS_BONUS_PER_SEC : 0;
    const finalScore  = score + bonusPoints;
    const elapsed     = MAX_SECONDS - secondsLeft;

    App.Scores.add({
      player:      App.state.playerName || 'Player',
      game:        'fill',
      language:    App.state.selectedLanguage.label,
      category:    App.state.selectedCategory.name,
      subcategory: App.state.selectedSubcategory.name,
      score:       finalScore,
      time:        elapsed,
      date:        new Date().toLocaleDateString('nl-NL'),
    });

    showResult(completed, finalScore, bonusPoints, elapsed);
  }

  function showResult(completed, finalScore, bonusPoints, elapsed) {
    const container = document.getElementById('fill-container');
    container.innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${completed ? '🏆' : '⏰'}</div>
        <div class="result-title">${completed ? 'Completed!' : 'Time Up!'}</div>
        <div class="result-subtitle">${completed
          ? 'All ' + words.length + ' words done! Bonus: +' + bonusPoints + ' pts (' + App.formatTime(60 - elapsed) + ' remaining)'
          : 'You completed ' + currentIndex + ' of ' + words.length + ' words.'}</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${finalScore}</div><div class="result-stat-label">Final Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsed)}</div><div class="result-stat-label">Time Used</div></div>
          <div class="result-stat"><div class="result-stat-value">${currentIndex}</div><div class="result-stat-label">Words Done</div></div>
          ${completed ? `<div class="result-stat"><div class="result-stat-value">+${bonusPoints}</div><div class="result-stat-label">Time Bonus</div></div>` : ''}
        </div>
        <div class="result-btns">
          <button class="btn-primary"   id="result-play-again">Play Again</button>
          <button class="btn-secondary" id="result-home">Home</button>
        </div>
      </div>
    `;
    document.getElementById('result-play-again').onclick = () => { reset(); start(); };
    document.getElementById('result-home').onclick = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = false;
    stopTimer();
    words        = [];
    currentIndex = 0;
    currentWord  = null;
    missingIndex = -1;
    score        = 0;
    secondsLeft  = MAX_SECONDS;

    const container = document.getElementById('fill-container');
    if (container && !document.getElementById('fill-progress-bar')) {
      container.innerHTML = fillOriginalHTML;
    }
  }

  // ── Utility ────────────────────────────────────────────────
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let fillOriginalHTML = '';
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('fill-container');
    if (c) fillOriginalHTML = c.innerHTML;
  });

  return { start, reset };
})();
