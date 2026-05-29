// ============================================================
//  LINGUA QUEST - Quest Battle
//  Monster LEFT (near cave) · Human RIGHT (near house)
//  Characters approach each other, full explosion particles
// ============================================================

const QuizGame = (() => {

  const MAX_SECONDS       = 60;
  const MAX_LIVES         = 3;
  const PTS_CORRECT       = 20;
  const PTS_BONUS_PER_SEC = 5;

  let words        = [];
  let allWords     = [];
  let currentIndex = 0;
  let score        = 0;
  let lives        = MAX_LIVES;
  let secondsLeft  = MAX_SECONDS;
  let timerInterval= null;
  let active       = false;
  let answering    = false;
  let animBusy     = false;

  // Pixel positions within the SVG viewBox (800×220) mapped to % for CSS
  // Monster starts near cave  (~11% from left)
  // Human   starts near house (~11% from right = ~78% from left)
  const MONSTER_REST = 11;   // % left
  const HUMAN_REST   = 11;   // % right  (right:11% in HTML)

  const $ = id => document.getElementById(id);

  // ── Start ──────────────────────────────────────────────────
  function start() {
    const sub = App.state.selectedSubcategory;
    // Wrong-answer pool = same subcategory (so answers are from the same topic)
    allWords = [...App.state.selectedSubcategory.words];

    words        = shuffle([...sub.words]);
    currentIndex = 0;
    score        = 0;
    lives        = MAX_LIVES;
    secondsLeft  = MAX_SECONDS;
    active       = true;
    answering    = false;
    animBusy     = false;

    $('quiz-quit').onclick = () => App.quitGame();

    resetCharacters();
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
    setTimeout(() => showResult(false, score, 0, MAX_SECONDS - secondsLeft, true), 600);
  }

  // ── Characters ─────────────────────────────────────────────
  // Monster: positioned left:X%  (moves right to attack)
  // Human:   positioned right:X% (moves left to attack)

  function resetCharacters() {
    const monster = $('quiz-monster');
    const human   = $('quiz-human');
    if (monster) {
      monster.style.transition = 'none';
      monster.style.transform  = 'scaleX(1)';   // faces right naturally
      monster.style.opacity    = '1';
      monster.style.left       = MONSTER_REST + '%';
      monster.style.right      = '';
      monster.style.filter     = '';
    }
    if (human) {
      human.style.transition = 'none';
      human.style.transform  = 'scaleX(-1)';    // flip to face left (toward monster)
      human.style.opacity    = '1';
      human.style.right      = HUMAN_REST + '%';
      human.style.left       = '';
      human.style.filter     = '';
    }
  }

  // ── Question ───────────────────────────────────────────────
  function renderQuestion() {
    if (currentIndex >= words.length) { triggerVictory(); return; }

    answering = false;
    animBusy  = false;

    spawnMonster();

    const word = words[currentIndex];
    $('quiz-q-text').textContent = word.question;
    $('quiz-q-num').textContent  = (currentIndex + 1) + ' / ' + words.length;

    const choices = buildChoices(word);
    const keys    = ['A', 'B', 'C', 'D'];
    document.querySelectorAll('.quiz-choice').forEach((btn, i) => {
      btn.disabled        = false;
      btn.className       = 'quiz-choice';
      btn.dataset.answer  = choices[i].answer;
      btn.dataset.correct = choices[i].correct ? 'true' : 'false';
      btn.innerHTML       = `<span class="choice-key">${keys[i]}</span>${choices[i].answer}`;
      btn.onclick         = () => selectAnswer(btn);
    });

    $('quiz-score').textContent = score;
  }

  function buildChoices(word) {
    const correct = { answer: word.answer, correct: true };
    const wrongs  = shuffle(allWords.filter(w => w.answer !== word.answer))
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

  // ── Spawn monster (slide in from cave) ────────────────────
  function spawnMonster() {
    const el = $('quiz-monster');
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform  = 'scaleX(1) scale(0.2)';
    el.style.opacity    = '0';
    el.style.left       = '5%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'left 0.5s cubic-bezier(0.34,1.56,0.64,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease';
      el.style.transform  = 'scaleX(1) scale(1)';
      el.style.opacity    = '1';
      el.style.left       = MONSTER_REST + '%';
    }));
  }

  // ── Answer selection ───────────────────────────────────────
  function selectAnswer(btn) {
    if (!active || answering || animBusy) return;
    answering = true;
    animBusy  = true;

    const isCorrect = btn.dataset.correct === 'true';
    document.querySelectorAll('.quiz-choice').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
      else if (b === btn && !isCorrect) b.classList.add('wrong');
    });

    if (isCorrect) {
      score += PTS_CORRECT;
      $('quiz-score').textContent = score;
      animHumanAttack(() => {
        animBusy = false;
        currentIndex++;
        if (currentIndex >= words.length) setTimeout(() => triggerVictory(), 200);
        else setTimeout(() => renderQuestion(), 300);
      });
    } else {
      lives--;
      updateLives();
      animMonsterAttack(() => {
        animBusy = false;
        if (lives <= 0) setTimeout(() => triggerDefeat(), 200);
        else setTimeout(() => renderQuestion(), 300);
      });
    }
  }

  // ── Lives ──────────────────────────────────────────────────
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

  // ── ANIMATION: Human rushes LEFT, monster dies ─────────────
  // Human: positioned right:11% — to move left we decrease right (or use translateX negative)
  function animHumanAttack(cb) {
    const human   = $('quiz-human');
    const monster = $('quiz-monster');
    if (!human || !monster) { cb && cb(); return; }

    const wrap    = $('quiz-battle-wrap');
    const wrapW   = wrap ? wrap.offsetWidth : 800;
    // Human needs to travel ~75% of scene width to reach monster
    const travel  = Math.round(wrapW * 0.68);

    // Phase 1: human charges left toward monster
    human.style.transition = 'right 0.42s cubic-bezier(0.4,0,0.2,1), transform 0.42s ease';
    human.style.right      = 'calc(' + HUMAN_REST + '% + ' + travel + 'px)';
    human.style.transform  = 'scaleX(-1) scale(1.15)';

    setTimeout(() => {
      // Impact: monster flash white
      monster.style.transition = 'filter 0.1s, transform 0.1s';
      monster.style.filter     = 'brightness(5) saturate(0)';
      monster.style.transform  = 'scale(1.3)';

      setTimeout(() => {
        // Monster explodes outward
        monster.style.transition = 'all 0.45s ease-out';
        monster.style.transform  = 'scale(0) rotate(360deg) translateX(-60px)';
        monster.style.opacity    = '0';
        monster.style.filter     = '';

        // Human bounces back to rest
        human.style.transition = 'right 0.38s cubic-bezier(0.34,1.3,0.64,1), transform 0.38s ease';
        human.style.right      = HUMAN_REST + '%';
        human.style.transform  = 'scaleX(-1) scale(1)';

        setTimeout(() => {
          // Silently reset monster for next spawn
          monster.style.transition = 'none';
          monster.style.transform  = 'scaleX(1) scale(1)';
          monster.style.opacity    = '1';
          monster.style.filter     = '';
          cb && cb();
        }, 460);
      }, 120);
    }, 430);
  }

  // ── ANIMATION: Monster rushes RIGHT, human is hit ─────────
  function animMonsterAttack(cb) {
    const monster = $('quiz-monster');
    const human   = $('quiz-human');
    if (!monster || !human) { cb && cb(); return; }

    const wrap   = $('quiz-battle-wrap');
    const wrapW  = wrap ? wrap.offsetWidth : 800;
    const travel = Math.round(wrapW * 0.66);

    // Phase 1: monster charges right
    monster.style.transition = 'left 0.42s cubic-bezier(0.4,0,0.2,1), transform 0.42s ease';
    monster.style.left       = 'calc(' + MONSTER_REST + '% + ' + travel + 'px)';
    monster.style.transform  = 'scaleX(1) scale(1.15)';

    setTimeout(() => {
      // Impact: human flash red
      human.style.transition = 'filter 0.1s, transform 0.1s';
      human.style.filter     = 'brightness(4) hue-rotate(280deg)';
      human.style.transform  = 'scaleX(-1) scale(1.2) translateX(12px)';

      setTimeout(() => {
        // Human stumbles back
        human.style.transition = 'filter 0.3s, transform 0.35s';
        human.style.filter     = '';
        human.style.transform  = 'scaleX(-1) scale(1) translateX(-8px)';

        // Monster returns
        monster.style.transition = 'left 0.38s cubic-bezier(0.34,1.3,0.64,1), transform 0.38s ease';
        monster.style.left       = MONSTER_REST + '%';
        monster.style.transform  = 'scaleX(1) scale(1)';

        setTimeout(() => {
          human.style.transform = 'scaleX(-1) scale(1)';
          cb && cb();
        }, 360);
      }, 130);
    }, 430);
  }

  // ── EXPLOSION particles (canvas) ──────────────────────────
  function runExplosion(centerXpct, color1, color2, cb) {
    const canvas = $('quiz-explosion-canvas');
    if (!canvas) { cb && cb(); return; }

    const wrap   = $('quiz-battle-wrap');
    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');
    const cx      = canvas.width  * (centerXpct / 100);
    const cy      = canvas.height * 0.75;

    // Build particles
    const particles = [];
    const COUNT = 60;
    for (let i = 0; i < COUNT; i++) {
      const angle = (Math.PI * 2 * i) / COUNT + (Math.random() - 0.5) * 0.4;
      const speed = 2 + Math.random() * 6;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        r:  3 + Math.random() * 6,
        life: 1,
        decay: 0.018 + Math.random() * 0.022,
        color: Math.random() > 0.5 ? color1 : color2,
      });
    }
    // Extra sparks
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        r:  1.5 + Math.random() * 2.5,
        life: 1,
        decay: 0.03 + Math.random() * 0.04,
        color: '#fff',
      });
    }

    // Shockwave ring
    let ringR = 0;
    let ringLife = 1;

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Shockwave
      if (ringLife > 0) {
        ringR   += 7;
        ringLife -= 0.04;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,220,100,${ringLife * 0.7})`;
        ctx.lineWidth   = 3;
        ctx.stroke();
      }

      let any = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        any = true;
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   += 0.22;   // gravity
        p.vx   *= 0.97;   // drag
        p.life -= p.decay;

        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (any || ringLife > 0) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cb && cb();
      }
    }
    requestAnimationFrame(frame);
  }

  // ── VICTORY: cave explodes ─────────────────────────────────
  function triggerVictory() {
    active = false;
    stopTimer();

    const monster = $('quiz-monster');
    const human   = $('quiz-human');
    const cave    = $('quiz-cave-group');

    // Monster vanishes
    if (monster) {
      monster.style.transition = 'all 0.3s ease';
      monster.style.transform  = 'scale(0) rotate(180deg)';
      monster.style.opacity    = '0';
    }
    // Human cheers
    if (human) {
      human.style.transition = 'transform 0.4s cubic-bezier(0.34,1.8,0.64,1)';
      human.style.transform  = 'scaleX(-1) scale(1.4) translateY(-14px)';
    }

    // Cave crumbles (SVG)
    setTimeout(() => {
      if (cave) {
        cave.style.transition = 'transform 0.5s ease-in, opacity 0.5s ease-in';
        cave.style.transformOrigin = '105px 168px';
        cave.style.transform  = 'scale(0.1) rotate(-30deg)';
        cave.style.opacity    = '0';
      }
      // Explosion at cave position (~13% from left of scene)
      runExplosion(13, '#c9a84c', '#e74c3c', null);
      runExplosion(13, '#ff8c00', '#ff4500', null);
    }, 350);

    const bonusPoints = secondsLeft * PTS_BONUS_PER_SEC;
    const finalScore  = score + bonusPoints;
    const elapsed     = MAX_SECONDS - secondsLeft;

    App.Scores.add({
      player: App.state.playerName || 'Player',
      game: 'quiz', language: App.state.selectedLanguage.label,
      category: App.state.selectedCategory.name,
      subcategory: App.state.selectedSubcategory.name,
      score: finalScore, time: elapsed,
      date: new Date().toLocaleDateString('nl-NL'),
    });

    setTimeout(() => showResult(true, finalScore, bonusPoints, elapsed, false), 1600);
  }

  // ── DEFEAT: house explodes ─────────────────────────────────
  function triggerDefeat() {
    active = false;
    stopTimer();

    const monster = $('quiz-monster');
    const human   = $('quiz-human');
    const house   = $('quiz-house-group');

    // Monster gloats
    if (monster) {
      monster.style.transition = 'transform 0.4s cubic-bezier(0.34,1.8,0.64,1)';
      monster.style.transform  = 'scaleX(1) scale(1.5) translateY(-10px)';
    }
    // Human falls
    if (human) {
      human.style.transition = 'all 0.55s ease-in';
      human.style.transform  = 'scaleX(-1) scale(0.8) rotate(80deg) translateY(30px)';
      human.style.opacity    = '0';
    }

    // House explodes (SVG)
    setTimeout(() => {
      if (house) {
        house.style.transition = 'transform 0.5s ease-in, opacity 0.5s ease-in';
        house.style.transformOrigin = '689px 140px';
        house.style.transform  = 'scale(0.05) rotate(20deg)';
        house.style.opacity    = '0';
      }
      // Explosion at house position (~86% from left)
      runExplosion(86, '#2ecc71', '#27ae60', null);
      runExplosion(86, '#f39c12', '#e74c3c', null);
    }, 400);

    const elapsed = MAX_SECONDS - secondsLeft;
    setTimeout(() => showResult(false, score, 0, elapsed, false), 1700);
  }

  // ── Result ─────────────────────────────────────────────────
  function showResult(won, finalScore, bonusPoints, elapsed, timedOut) {
    document.getElementById('quiz-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${won ? '🏆' : '💀'}</div>
        <div class="result-title">${won ? 'Victory!' : timedOut ? 'Time Up!' : 'Defeat!'}</div>
        <div class="result-subtitle">${won
          ? 'The cave is destroyed! All monsters defeated.' + (bonusPoints ? ' Bonus: +' + bonusPoints + ' pts' : '')
          : timedOut ? 'The clock ran out.'
          : 'Three wrong answers — the village fell.'}</div>
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
      </div>`;
    $('quiz-play-again').onclick = () => { reset(); start(); };
    $('quiz-home').onclick       = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = answering = animBusy = false;
    stopTimer();
    words = []; allWords = [];
    currentIndex = score = 0;
    secondsLeft  = MAX_SECONDS;
    lives        = MAX_LIVES;

    const c = $('quiz-container');
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
    const c = $('quiz-container');
    if (c) quizOriginalHTML = c.innerHTML;
  });

  return { start, reset };
})();
