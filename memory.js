// ============================================================
//  LINGUA QUEST - Memory Card Game
// ============================================================

const MemoryGame = (() => {

  let words = [];
  let selectedLeft  = null;  // { el, index }
  let selectedRight = null;
  let matchedCount  = 0;
  let score = 0;
  let mistakes = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let active = false;
  let locked = false;  // block clicks during feedback
  let mode = 1;        // 1=all closed, 2=open 10s then close, 3=always open

  // ── DOM refs ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Start ──────────────────────────────────────────────────
  function start() {
    mode = App.state.memoryMode || 1;
    const sub = App.state.selectedSubcategory;
    words = shuffle([...sub.words]);
    matchedCount = 0;
    score = 0;
    mistakes = 0;
    elapsedSeconds = 0;
    active = true;
    locked = false;

    $('memory-quit').onclick = () => App.quitGame();
    buildBoard();

    if (mode === 2) {
      // Show all for 10 seconds then flip
      locked = true;
      revealAll();
      let countdown = 10;
      $('memory-countdown').textContent = '⏳ Memorise! ' + countdown + 's';
      const cd = setInterval(() => {
        countdown--;
        $('memory-countdown').textContent = countdown > 0
          ? '⏳ Memorise! ' + countdown + 's'
          : 'Go!';
        if (countdown <= 0) {
          clearInterval(cd);
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

    // Shuffle display order of each side independently
    const leftOrder  = shuffle(words.map((_, i) => i));
    const rightOrder = shuffle(words.map((_, i) => i));

    leftOrder.forEach(idx => {
      const card = makeCard(words[idx].question, idx, 'left');
      leftCol.appendChild(card);
    });
    rightOrder.forEach(idx => {
      const card = makeCard(words[idx].answer, idx, 'right');
      rightCol.appendChild(card);
    });
  }

  function makeCard(text, index, side) {
    const div = document.createElement('div');
    div.className = 'mem-card' + (mode === 1 ? ' face-down' : '');
    div.dataset.index = index;
    div.dataset.side  = side;
    div.dataset.text  = text;
    div.textContent = (mode === 1) ? '' : text;

    div.addEventListener('click', () => onCardClick(div));
    return div;
  }

  // ── Click handler ──────────────────────────────────────────
  function onCardClick(card) {
    if (!active || locked) return;
    if (card.classList.contains('matched')) return;
    const side = card.dataset.side;

    // Reveal if face-down
    if (card.classList.contains('face-down')) {
      card.classList.remove('face-down');
      card.textContent = card.dataset.text;
    }

    if (side === 'left') {
      if (selectedLeft?.el === card) {
        // Deselect
        card.classList.remove('selected');
        selectedLeft = null;
        return;
      }
      if (selectedLeft) selectedLeft.el.classList.remove('selected');
      selectedLeft = { el: card, index: parseInt(card.dataset.index) };
      card.classList.add('selected');
    } else {
      if (selectedRight?.el === card) {
        card.classList.remove('selected');
        selectedRight = null;
        return;
      }
      if (selectedRight) selectedRight.el.classList.remove('selected');
      selectedRight = { el: card, index: parseInt(card.dataset.index) };
      card.classList.add('selected');
    }

    if (selectedLeft && selectedRight) checkMatch();
  }

  // ── Check match ────────────────────────────────────────────
  function checkMatch() {
    locked = true;
    const lIdx = selectedLeft.index;
    const rIdx = selectedRight.index;

    if (lIdx === rIdx) {
      // Match!
      score += 20;
      matchedCount++;
      selectedLeft.el.classList.remove('selected');
      selectedRight.el.classList.remove('selected');
      selectedLeft.el.classList.add('matched');
      selectedRight.el.classList.add('matched');
      selectedLeft  = null;
      selectedRight = null;
      updateHUD();
      locked = false;

      if (matchedCount === words.length) finishGame();
    } else {
      // No match
      mistakes++;
      score = Math.max(0, score - 5);
      selectedLeft.el.classList.add('error');
      selectedRight.el.classList.add('error');

      setTimeout(() => {
        [selectedLeft.el, selectedRight.el].forEach(el => {
          el.classList.remove('selected', 'error');
          if (mode === 1) {
            el.classList.add('face-down');
            el.textContent = '';
          }
        });
        selectedLeft  = null;
        selectedRight = null;
        updateHUD();
        locked = false;
      }, 800);
    }
  }

  // ── HUD ────────────────────────────────────────────────────
  function updateHUD() {
    $('memory-score').textContent = score;
    $('memory-matched').textContent = matchedCount + ' / ' + words.length;
  }

  // ── Timer ──────────────────────────────────────────────────
  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!active) return;
      elapsedSeconds++;
      $('memory-timer').textContent = App.formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // ── Reveal/Hide all ────────────────────────────────────────
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
  function finishGame() {
    active = false;
    stopTimer();

    App.Scores.add({
      game: 'memory',
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
    const modeNames = { 1: 'Closed', 2: 'Peek (10s)', 3: 'Open' };
    document.getElementById('memory-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">🃏</div>
        <div class="result-title">All Matched!</div>
        <div class="result-subtitle">Mode: ${modeNames[mode]} — ${words.length} pairs found.</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${score}</div><div class="result-stat-label">Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsedSeconds)}</div><div class="result-stat-label">Time</div></div>
          <div class="result-stat"><div class="result-stat-value">${mistakes}</div><div class="result-stat-label">Mistakes</div></div>
        </div>
        <div class="result-btns">
          <button class="btn-primary" id="mem-play-again">Play Again</button>
          <button class="btn-secondary" id="mem-home">Home</button>
        </div>
      </div>
    `;
    $('mem-play-again').onclick = () => { reset(); start(); };
    $('mem-home').onclick = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = false;
    locked = false;
    stopTimer();
    words = [];
    selectedLeft = selectedRight = null;
    matchedCount = score = mistakes = elapsedSeconds = 0;

    const c = document.getElementById('memory-container');
    if (c && !$('memory-left')) c.innerHTML = memoryOriginalHTML;
  }

  // ── Utility ────────────────────────────────────────────────
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
