// ============================================================
//  LINGUA QUEST - Fill in Letters Game
// ============================================================

const FillGame = (() => {

  let words = [];
  let currentIndex = 0;
  let currentWord = null;
  let missingIndex = -1;
  let score = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let active = false;

  // ── DOM refs ───────────────────────────────────────────────
  const dom = () => ({
    progressBar:  document.getElementById('fill-progress-bar'),
    progressText: document.getElementById('fill-progress-text'),
    hintLabel:    document.getElementById('fill-hint-answer'),
    wordDisplay:  document.getElementById('fill-word-display'),
    input:        document.getElementById('fill-input'),
    feedback:     document.getElementById('fill-feedback'),
    score:        document.getElementById('fill-score'),
    timer:        document.getElementById('fill-timer'),
    btnQuit:      document.getElementById('fill-quit'),
  });

  // ── Start ──────────────────────────────────────────────────
  function start() {
    const sub = App.state.selectedSubcategory;
    words = shuffle([...sub.words]);
    currentIndex = 0;
    score = 0;
    elapsedSeconds = 0;
    active = true;

    const d = dom();
    d.btnQuit.onclick = () => App.quitGame();

    startTimer();
    loadWord();
    d.input.addEventListener('keydown', handleKey);
    d.input.focus();
  }

  // ── Timer ──────────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!active) return;
      elapsedSeconds++;
      const d = dom();
      if (d.timer) d.timer.textContent = App.formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // ── Load next word ─────────────────────────────────────────
  function loadWord() {
    const d = dom();
    if (currentIndex >= words.length) {
      finishGame();
      return;
    }

    currentWord = words[currentIndex];

    // Update progress
    const pct = Math.round((currentIndex / words.length) * 100);
    d.progressBar.style.width = pct + '%';
    d.progressText.textContent = (currentIndex + 1) + ' / ' + words.length;

    // Hint = Dutch answer
    d.hintLabel.textContent = currentWord.answer;

    // Pick a random letter index to remove (letters only, skip spaces and special chars)
    const q = currentWord.question;
    const candidates = [];
    for (let i = 0; i < q.length; i++) {
      if (/[a-zA-ZÀ-ÿα-ωΑ-Ω]/u.test(q[i])) candidates.push(i);
    }
    missingIndex = candidates[Math.floor(Math.random() * candidates.length)];

    d.input.value = '';          // clear BEFORE rendering so the blank box shows '_'
    d.feedback.textContent = '';
    d.feedback.className = 'fill-feedback';
    d.score.textContent = score;

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
        const inp = d.input.value.toUpperCase();
        box.textContent = inp || '_';
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
    const d = dom();

    // Update display as user types
    setTimeout(() => renderWordDisplay(false), 0);

    if (e.key === 'Enter') {
      const typed = d.input.value.trim();
      if (!typed) return;
      checkAnswer(typed);
    }
  }

  // ── Check answer ───────────────────────────────────────────
  function checkAnswer(typed) {
    const d = dom();
    const correct = currentWord.question[missingIndex];

    if (typed.toLowerCase() === correct.toLowerCase()) {
      // Correct
      score += 10;
      d.score.textContent = score;
      d.feedback.textContent = '✓ Correct!';
      d.feedback.className = 'fill-feedback correct';

      // Show full word briefly then advance
      renderWordDisplay(false);
      const box = document.getElementById('missing-box');
      if (box) { box.textContent = correct; box.style.borderColor = 'var(--accent-green)'; box.style.color = 'var(--accent-green2)'; }

      setTimeout(() => {
        currentIndex++;
        loadWord();
      }, 800);
    } else {
      // Wrong
      d.feedback.textContent = '✗ Try again…';
      d.feedback.className = 'fill-feedback wrong';
      renderWordDisplay(true);
      d.input.value = '';
      setTimeout(() => {
        renderWordDisplay(false);
        d.input.focus();
      }, 500);
    }
  }

  // ── Finish ─────────────────────────────────────────────────
  function finishGame() {
    active = false;
    stopTimer();

    // Save score
    App.Scores.add({
      game: 'fill',
      language: App.state.selectedLanguage.label,
      category: App.state.selectedCategory.name,
      subcategory: App.state.selectedSubcategory.name,
      score,
      time: elapsedSeconds,
      date: new Date().toLocaleDateString('nl-NL'),
    });

    showResult();
  }

  function showResult() {
    const container = document.getElementById('fill-container');
    container.innerHTML = `
      <div class="result-screen">
        <div class="result-icon">🏆</div>
        <div class="result-title">Completed!</div>
        <div class="result-subtitle">You filled in all ${words.length} words correctly.</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${score}</div><div class="result-stat-label">Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsedSeconds)}</div><div class="result-stat-label">Time</div></div>
          <div class="result-stat"><div class="result-stat-value">${words.length}</div><div class="result-stat-label">Words</div></div>
        </div>
        <div class="result-btns">
          <button class="btn-primary" id="result-play-again">Play Again</button>
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
    words = [];
    currentIndex = 0;
    currentWord = null;
    missingIndex = -1;
    score = 0;
    elapsedSeconds = 0;

    // Restore original fill HTML if it was replaced by result screen
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

  // Store original HTML for reset
  let fillOriginalHTML = '';
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('fill-container');
    if (c) fillOriginalHTML = c.innerHTML;
  });

  return { start, reset };
})();
