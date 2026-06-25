// ============================================================
//  LINGUA QUEST - Memory Card Game
//  - 120-second countdown timer
//  - +5 bonus per second remaining on finish
// ============================================================

const MemoryGame = (() => {

  const MAX_SECONDS       = 120;
  const PTS_MATCH         = 20;
  const PTS_MISTAKE       = -5;
  const PTS_BONUS_PER_SEC = 5;

  let words        = [];
  let selectedLeft = null;
  let selectedRight= null;
  let matchedCount = 0;
  let score        = 0;
  let mistakes     = 0;
  let secondsLeft  = MAX_SECONDS;
  let timerInterval= null;
  let active       = false;
  let locked       = false;
  let mode         = 1;

  const $ = id => document.getElementById(id);

  // ── Start ──────────────────────────────────────────────────
  function start() {
    mode         = App.state.memoryMode || 1;
    const sub    = App.state.selectedSubcategory;
    words        = shuffle([...sub.words]);
    matchedCount = 0;
    score        = 0;
    mistakes     = 0;
    secondsLeft  = MAX_SECONDS;
    active       = true;
    locked       = false;

    $('memory-quit').onclick = () => App.quitGame();
    buildBoard();

    if (mode === 2) {
      locked = true;
      revealAll();
      let cd = 10;
      $('memory-countdown').textContent = '⏳ Memorise! ' + cd + 's';
      const interval = setInterval(() => {
        cd--;
        $('memory-countdown').textContent = cd > 0 ? '⏳ Memorise! ' + cd + 's' : 'Go!';
        if (cd <= 0) {
          clearInterval(interval);
          hideAll();
          locked = false;
          $('memory-countdown').textContent = '';
          startTimer();
        }
      }, 1000);
    } else if (mode === 3) {
      revealAll();
      startTimer();
    } else {
      startTimer();
    }
  }

  // ── Build board ────────────────────────────────────────────
  function buildBoard() {
    const leftCol  = $('memory-left');
    const rightCol = $('memory-right');
    leftCol.innerHTML  = '';
    rightCol.innerHTML = '';
    $('memory-countdown').textContent = '';

    const leftOrder  = shuffle(words.map((_, i) => i));
    const rightOrder = shuffle(words.map((_, i) => i));

    leftOrder.forEach(idx => leftCol.appendChild(makeCard(words[idx].question, idx, 'left')));
    rightOrder.forEach(idx => rightCol.appendChild(makeCard(words[idx].answer, idx, 'right')));
    updateHUD();
  }

  function makeCard(text, index, side) {
    const div = document.createElement('div');
    div.className   = 'mem-card' + (mode === 1 ? ' face-down' : '');
    div.dataset.index = index;
    div.dataset.side  = side;
    div.dataset.text  = text;
    div.textContent = mode === 1 ? '' : text;
    div.addEventListener('click', () => onCardClick(div));
    return div;
  }

  // ── Click handler ──────────────────────────────────────────
  function onCardClick(card) {
    if (!active || locked) return;
    if (card.classList.contains('matched')) return;
    const side = card.dataset.side;

    if (card.classList.contains('face-down')) {
      card.classList.remove('face-down');
      card.textContent = card.dataset.text;
    }

    if (side === 'left') {
      if (selectedLeft?.el === card) { card.classList.remove('selected'); selectedLeft = null; return; }
      if (selectedLeft) selectedLeft.el.classList.remove('selected');
      selectedLeft = { el: card, index: parseInt(card.dataset.index) };
      card.classList.add('selected');
    } else {
      if (selectedRight?.el === card) { card.classList.remove('selected'); selectedRight = null; return; }
      if (selectedRight) selectedRight.el.classList.remove('selected');
      selectedRight = { el: card, index: parseInt(card.dataset.index) };
      card.classList.add('selected');
    }

    if (selectedLeft && selectedRight) checkMatch();
  }

  // ── Check match ────────────────────────────────────────────
  function checkMatch() {
    locked = true;
    if (selectedLeft.index === selectedRight.index) {
      score += PTS_MATCH;
      matchedCount++;
      selectedLeft.el.classList.remove('selected');
      selectedRight.el.classList.remove('selected');
      selectedLeft.el.classList.add('matched');
      selectedRight.el.classList.add('matched');
      selectedLeft = selectedRight = null;
      updateHUD();
      locked = false;
      if (matchedCount === words.length) finishGame(true);
    } else {
      mistakes++;
      score = Math.max(0, score + PTS_MISTAKE);
      selectedLeft.el.classList.add('error');
      selectedRight.el.classList.add('error');
      setTimeout(() => {
        [selectedLeft.el, selectedRight.el].forEach(el => {
          el.classList.remove('selected', 'error');
          if (mode === 1) { el.classList.add('face-down'); el.textContent = ''; }
        });
        selectedLeft = selectedRight = null;
        updateHUD();
        locked = false;
      }, 800);
    }
  }

  // ── HUD ────────────────────────────────────────────────────
  function updateHUD() {
    $('memory-score').textContent   = score;
    $('memory-matched').textContent = matchedCount + ' / ' + words.length;
  }

  // ── Timer ──────────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!active) return;
      secondsLeft--;
      const el = $('memory-timer');
      if (el) {
        el.textContent = App.formatTime(secondsLeft);
        el.style.color = secondsLeft <= 10 ? 'var(--redstone)' : 'var(--gold)';
      }
      if (secondsLeft <= 0) { secondsLeft = 0; timeUp(); }
    }, 1000);
  }

  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

  function timeUp() {
    active = false;
    stopTimer();
    setTimeout(() => finishGame(false), 400);
  }

  // ── Reveal / Hide ──────────────────────────────────────────
  function revealAll() {
    document.querySelectorAll('.mem-card').forEach(c => {
      c.classList.remove('face-down');
      c.textContent = c.dataset.text;
    });
  }

  function hideAll() {
    document.querySelectorAll('.mem-card:not(.matched)').forEach(c => {
      c.classList.add('face-down');
      c.textContent = '';
    });
  }

  // ── Finish ─────────────────────────────────────────────────
  function finishGame(completed) {
    active = false;
    stopTimer();
    const bonusPoints = completed ? secondsLeft * 5 : 0;
    const finalScore  = score + bonusPoints;
    const elapsed     = MAX_SECONDS - secondsLeft;

    App.Scores.add({
      player:      App.state.playerName || 'Player',
      game:        'memory',
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
    const modeNames = { 1: 'Closed', 2: 'Peek (10s)', 3: 'Open' };
    document.getElementById('memory-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${completed ? '🃏' : '⏰'}</div>
        <div class="result-title">${completed ? 'All Matched!' : 'Time Up!'}</div>
        <div class="result-subtitle">Mode: ${modeNames[mode]} — ${matchedCount} of ${words.length} pairs matched.${completed ? ' Bonus: +' + bonusPoints + ' pts' : ''}</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${finalScore}</div><div class="result-stat-label">Final Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsed)}</div><div class="result-stat-label">Time Used</div></div>
          <div class="result-stat"><div class="result-stat-value">${mistakes}</div><div class="result-stat-label">Mistakes</div></div>
          ${completed ? `<div class="result-stat"><div class="result-stat-value">+${bonusPoints}</div><div class="result-stat-label">Time Bonus</div></div>` : ''}
        </div>
        <div class="result-btns">
          <button class="btn-primary"   id="mem-play-again">Play Again</button>
          <button class="btn-secondary" id="mem-home">Home</button>
        </div>
      </div>
    `;
    $('mem-play-again').onclick = () => { reset(); start(); };
    $('mem-home').onclick = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = locked = false;
    stopTimer();
    words = [];
    selectedLeft = selectedRight = null;
    matchedCount = score = mistakes = 0;
    secondsLeft = MAX_SECONDS;

    const c = document.getElementById('memory-container');
    if (c && !$('memory-left')) c.innerHTML = memoryOriginalHTML;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let memoryOriginalHTML = '';
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('memory-container');
    if (c) memoryOriginalHTML = c.innerHTML;
  });

  return { start, reset };
})();
