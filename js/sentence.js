// ============================================================
//  LINGUA QUEST - Missing Word Game
//  Sentence shown with ___ gap; player types the missing word.
//  Wrong input shakes and must retry; correct advances.
//  20 sentences, 60-second countdown, +5 bonus per sec left.
// ============================================================

const SentenceGame = (() => {

  const WORD_TARGET       = 20;
  const MAX_SECONDS       = 60;
  const PTS_CORRECT       = 10;
  const PTS_BONUS_PER_SEC = 5;

  let sentences    = [];
  let currentIndex = 0;
  let current      = null;   // { sentence, answer, hint, translation }
  let score        = 0;
  let secondsLeft  = MAX_SECONDS;
  let timerInterval= null;
  let active       = false;

  // ── DOM refs ───────────────────────────────────────────────
  const dom = () => ({
    progressBar:  document.getElementById('sent-progress-bar'),
    progressText: document.getElementById('sent-progress-text'),
    scoreEl:      document.getElementById('sent-score'),
    timerEl:      document.getElementById('sent-timer'),
    btnQuit:      document.getElementById('sent-quit'),
    sentenceEl:   document.getElementById('sent-sentence'),
    hintEl:       document.getElementById('sent-hint'),
    translEl:     document.getElementById('sent-transl'),
    input:        document.getElementById('sent-input'),
    feedback:     document.getElementById('sent-feedback'),
    submitBtn:    document.getElementById('sent-submit'),
  });

  // ── Build sentence list (20, repeat pool if needed) ───────
  function buildList(pool) {
    const result = [];
    while (result.length < WORD_TARGET) result.push(...shuffle([...pool]));
    return result.slice(0, WORD_TARGET);
  }

  // ── Start ──────────────────────────────────────────────────
  function start() {
    const sub  = App.state.selectedSubcategory;
    sentences  = buildList(sub.sentences);
    currentIndex = 0;
    score        = 0;
    secondsLeft  = MAX_SECONDS;
    active       = true;

    const d = dom();
    d.btnQuit.onclick   = () => App.quitGame();
    d.submitBtn.onclick = () => checkAnswer();
    d.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') checkAnswer();
    });

    updateTimerDisplay();
    startTimer();
    loadSentence();
    d.input.focus();
  }

  // ── Timer ──────────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!active) return;
      secondsLeft--;
      updateTimerDisplay();
      if (secondsLeft <= 0) { secondsLeft = 0; timeUp(); }
    }, 1000);
  }

  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

  function updateTimerDisplay() {
    const d = dom();
    if (!d.timerEl) return;
    d.timerEl.textContent = App.formatTime(secondsLeft);
    d.timerEl.style.color = secondsLeft <= 10 ? 'var(--redstone)' : 'var(--gold)';
  }

  function timeUp() {
    active = false;
    stopTimer();
    const d = dom();
    if (d.feedback) {
      d.feedback.textContent = '⏰ Time is up!';
      d.feedback.className   = 'sent-feedback wrong';
    }
    if (d.input) d.input.disabled = true;
    setTimeout(() => finishGame(false), 900);
  }

  // ── Load sentence ──────────────────────────────────────────
  function loadSentence() {
    const d = dom();
    if (currentIndex >= sentences.length) { finishGame(true); return; }

    current = sentences[currentIndex];

    const pct = Math.round((currentIndex / sentences.length) * 100);
    d.progressBar.style.width  = pct + '%';
    d.progressText.textContent = (currentIndex + 1) + ' / ' + sentences.length;
    d.scoreEl.textContent      = score;

    // Render sentence with stylised blank
    d.sentenceEl.innerHTML = renderSentenceHTML(current.sentence);

    // Hint: Dutch sentence with answer translation
    d.hintEl.textContent    = current.hint;
    d.translEl.textContent  = '(' + current.translation + ')';

    d.input.value           = '';
    d.input.disabled        = false;
    d.feedback.textContent  = '';
    d.feedback.className    = 'sent-feedback';
    d.input.focus();
  }

  function renderSentenceHTML(sentence) {
    // Replace ___ with a styled blank span
    return sentence.replace('___',
      '<span class="sent-blank">___</span>');
  }

  // ── Check answer ───────────────────────────────────────────
  function checkAnswer() {
    if (!active) return;
    const d      = dom();
    const typed  = d.input.value.trim();
    if (!typed) return;

    if (typed.toLowerCase() === current.answer.toLowerCase()) {
      score += PTS_CORRECT;
      d.scoreEl.textContent  = score;
      d.feedback.textContent = '✓ Correct!';
      d.feedback.className   = 'sent-feedback correct';

      // Show the completed sentence with the answer in green
      d.sentenceEl.innerHTML = current.sentence.replace('___',
        '<span class="sent-answer-fill">' + current.answer + '</span>');

      d.input.disabled = true;
      setTimeout(() => { currentIndex++; loadSentence(); }, 900);
    } else {
      d.feedback.textContent = '✗ Try again!';
      d.feedback.className   = 'sent-feedback wrong';

      // Shake the input
      d.input.classList.remove('sent-shake');
      void d.input.offsetWidth; // reflow
      d.input.classList.add('sent-shake');
      d.input.value = '';
      setTimeout(() => d.input.focus(), 50);
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
      game:        'sentence',
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
    document.getElementById('sent-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${completed ? '🏆' : '⏰'}</div>
        <div class="result-title">${completed ? 'COMPLETED!' : 'TIME UP!'}</div>
        <div class="result-subtitle">${completed
          ? 'All ' + sentences.length + ' sentences done!' + (bonusPoints ? ' Bonus: +' + bonusPoints + ' pts' : '')
          : 'You finished ' + currentIndex + ' of ' + sentences.length + ' sentences.'}</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${finalScore}</div><div class="result-stat-label">Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsed)}</div><div class="result-stat-label">Time</div></div>
          <div class="result-stat"><div class="result-stat-value">${currentIndex}</div><div class="result-stat-label">Done</div></div>
          ${completed ? `<div class="result-stat"><div class="result-stat-value">+${bonusPoints}</div><div class="result-stat-label">Bonus</div></div>` : ''}
        </div>
        <div class="result-btns">
          <button class="btn-primary"   id="sent-play-again">PLAY AGAIN</button>
          <button class="btn-secondary" id="sent-home">HOME</button>
        </div>
      </div>`;
    document.getElementById('sent-play-again').onclick = () => { reset(); start(); };
    document.getElementById('sent-home').onclick       = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = false;
    stopTimer();
    sentences    = [];
    currentIndex = 0;
    current      = null;
    score        = 0;
    secondsLeft  = MAX_SECONDS;

    const c = document.getElementById('sent-container');
    if (c && !document.getElementById('sent-input')) c.innerHTML = sentOriginalHTML;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let sentOriginalHTML = '';
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('sent-container');
    if (c) sentOriginalHTML = c.innerHTML;
  });

  return { start, reset };
})();
