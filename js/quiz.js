// ============================================================
//  LINGUA QUEST - Quest Battle
//  Fireball combat system:
//   • Correct → human shoots blue fireball → monster explodes, new colour spawns
//   • Wrong   → monster shoots red fireball → human explodes, new colour spawns
// ============================================================

const QuizGame = (() => {

  const MAX_SECONDS       = 60;
  const MAX_LIVES         = 3;
  const PTS_CORRECT       = 20;
  const PTS_BONUS_PER_SEC = 5;

  // Rotating monster emojis (different colour each spawn)
  const MONSTERS = ['👾','👹','👺','🧟','🐲','👿','🦇','🤡'];
  // Rotating human emojis
  const HUMANS   = ['🧙','🧝','🧚','🦸','🧑‍🚀','🥷','🧜','🦊'];

  let words        = [];
  let allWords     = [];
  let currentIndex = 0;
  let score        = 0;
  let lives        = MAX_LIVES;
  let secondsLeft  = MAX_SECONDS;
  let timerInterval= null;
  let active       = false;
  let answering    = false;
  let monsterIdx   = 0;
  let humanIdx     = 0;

  const $ = id => document.getElementById(id);

  // ── Start ──────────────────────────────────────────────────
  function start() {
    const sub = App.state.selectedSubcategory;
    allWords  = [...sub.words];
    words     = shuffle([...sub.words]);

    currentIndex = 0;
    score        = 0;
    lives        = MAX_LIVES;
    secondsLeft  = MAX_SECONDS;
    active       = true;
    answering    = false;
    monsterIdx   = 0;
    humanIdx     = 0;

    $('quiz-quit').onclick = () => App.quitGame();

    setCharacter('quiz-monster', MONSTERS[0]);
    setCharacter('quiz-human',   HUMANS[0]);
    updateLives();
    startTimer();
    renderQuestion();
  }

  // ── Characters ─────────────────────────────────────────────
  function setCharacter(id, emoji) {
    const el = $(id);
    if (el) el.textContent = emoji;
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
        el.style.color = secondsLeft <= 10 ? 'var(--redstone)' : 'var(--gold)';
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

  // ── Question ───────────────────────────────────────────────
  function renderQuestion() {
    if (currentIndex >= words.length) { triggerVictory(); return; }

    answering = false;

    // Spawn new monster (slide in from cave side)
    spawnCharacter('quiz-monster', 'left');

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
    const pool    = allWords.filter(w => w.answer !== word.answer);
    const wrongs  = shuffle(pool).slice(0, 3).map(w => ({ answer: w.answer, correct: false }));
    // pad if pool too small
    while (wrongs.length < 3) wrongs.push({ answer: '—', correct: false });
    return shuffle([correct, ...wrongs]);
  }

  function disableChoices() {
    document.querySelectorAll('.quiz-choice').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });
  }

  // ── Spawn character (slide in from side) ──────────────────
  function spawnCharacter(id, from) {
    const el = $(id);
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity    = '0';
    el.style.transform  = from === 'left'
      ? 'translateX(-60px) scale(0.4)'
      : 'translateX(60px)  scale(0.4)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 0.45s cubic-bezier(0.34,1.6,0.64,1), opacity 0.3s ease';
      el.style.opacity    = '1';
      el.style.transform  = 'translateX(0) scale(1)';
    }));
  }

  // ── Select answer ──────────────────────────────────────────
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
      shootFireball('human-to-monster', () => {
        explodeCharacter('quiz-monster', () => {
          currentIndex++;
          if (currentIndex >= words.length) {
            triggerVictory();
          } else {
            monsterIdx = (monsterIdx + 1) % MONSTERS.length;
            setCharacter('quiz-monster', MONSTERS[monsterIdx]);
            answering = false;
            renderQuestion();
          }
        });
      });
    } else {
      lives--;
      updateLives();
      shootFireball('monster-to-human', () => {
        explodeCharacter('quiz-human', () => {
          if (lives <= 0) {
            triggerDefeat();
          } else {
            humanIdx = (humanIdx + 1) % HUMANS.length;
            setCharacter('quiz-human', HUMANS[humanIdx]);
            spawnCharacter('quiz-human', 'right');
            answering = false;
            renderQuestion();
          }
        });
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

  // ── FIREBALL (canvas animation) ────────────────────────────
  function shootFireball(direction, onImpact) {
    const canvas = $('quiz-explosion-canvas');
    if (!canvas) { onImpact && onImpact(); return; }

    const wrap   = $('quiz-battle-wrap');
    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');

    // Determine source & target X positions (% of width)
    const monsterEl = $('quiz-monster');
    const humanEl   = $('quiz-human');
    const wrapRect  = wrap.getBoundingClientRect();

    function charCenterX(el) {
      if (!el) return canvas.width / 2;
      const r = el.getBoundingClientRect();
      return r.left - wrapRect.left + r.width / 2;
    }

    const monsterX = charCenterX(monsterEl);
    const humanX   = charCenterX(humanEl);
    const groundY  = canvas.height * 0.55;

    let fromX, toX;
    const isBlue = direction === 'human-to-monster';
    if (isBlue) { fromX = humanX;   toX = monsterX; }
    else        { fromX = monsterX; toX = humanX; }

    // Fireball properties
    const color1 = isBlue ? '#44AAFF' : '#FF4400';
    const color2 = isBlue ? '#0066FF' : '#FF8800';
    const glow   = isBlue ? 'rgba(68,170,255,0.6)' : 'rgba(255,100,0,0.6)';

    let progress = 0;
    const STEPS  = 28;
    let impacted = false;

    // Trail particles
    const trail = [];

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      progress++;

      const t  = progress / STEPS;
      const cx = fromX + (toX - fromX) * t;
      // arc: rises then falls
      const arc = Math.sin(t * Math.PI) * (canvas.height * 0.28);
      const cy  = groundY - arc;

      // Add trail particle
      trail.push({ x: cx, y: cy, life: 1, r: 7 + Math.random() * 5 });

      // Draw trail
      for (const p of trail) {
        p.life -= 0.08;
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fillStyle = color2;
        ctx.fill();
      }

      // Glow halo
      ctx.globalAlpha = 0.35;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
      grd.addColorStop(0, glow);
      grd.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Fireball core
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = color1;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      // inner bright
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.7;
      ctx.fill();

      ctx.globalAlpha = 1;

      if (progress >= STEPS && !impacted) {
        impacted = true;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onImpact && onImpact();
        return;
      }

      if (!impacted) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  // ── EXPLODE character (canvas burst) ──────────────────────
  function explodeCharacter(charId, cb) {
    const canvas  = $('quiz-explosion-canvas');
    const charEl  = $(charId);
    if (!canvas || !charEl) { cb && cb(); return; }

    const wrap    = $('quiz-battle-wrap');
    const wrapRect= wrap.getBoundingClientRect();
    const charRect= charEl.getBoundingClientRect();
    const cx      = charRect.left - wrapRect.left + charRect.width  / 2;
    const cy      = charRect.top  - wrapRect.top  + charRect.height / 2;

    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');

    // Shake then hide the character
    charEl.style.transition = 'transform 0.08s steps(2)';
    charEl.style.transform  = 'scale(1.4) translateX(8px)';
    setTimeout(() => {
      charEl.style.transform = 'scale(1.4) translateX(-8px)';
      setTimeout(() => {
        charEl.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
        charEl.style.transform  = 'scale(0)';
        charEl.style.opacity    = '0';
      }, 80);
    }, 80);

    // Build burst particles
    const particles = [];
    const COLOURS   = charId === 'quiz-monster'
      ? ['#7EC850','#FFD700','#FF6600','#FF0000','#FFFFFF']
      : ['#5DE5E5','#FFFFFF','#FFD700','#FF88FF','#88AAFF'];

    for (let i = 0; i < 55; i++) {
      const angle = (Math.PI * 2 * i) / 55 + (Math.random() - 0.5) * 0.3;
      const speed = 2.5 + Math.random() * 5.5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        r: 4 + Math.random() * 7,
        life: 1,
        decay: 0.025 + Math.random() * 0.025,
        color: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        square: Math.random() > 0.5,  // Minecraft-style square bits
      });
    }
    // Sparks
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        r: 2 + Math.random() * 3,
        life: 1,
        decay: 0.04 + Math.random() * 0.04,
        color: '#FFFFFF',
        square: false,
      });
    }

    // Shockwave
    let ringR = 0, ringLife = 1;

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Shockwave ring
      if (ringLife > 0) {
        ringR   += 9;
        ringLife -= 0.06;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,220,80,${ringLife * 0.8})`;
        ctx.lineWidth   = 4;
        ctx.stroke();
        // second ring slightly behind
        if (ringR > 20) {
          ctx.beginPath();
          ctx.arc(cx, cy, ringR - 14, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,140,0,${ringLife * 0.5})`;
          ctx.lineWidth   = 2;
          ctx.stroke();
        }
      }

      let any = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        any = true;
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   += 0.28;
        p.vx   *= 0.96;
        p.life -= p.decay;

        ctx.globalAlpha = Math.max(0, p.life);
        if (p.square) {
          // Minecraft block debris
          const s = p.r * p.life;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (any || ringLife > 0) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Restore character for next spawn
        charEl.style.transition = 'none';
        charEl.style.opacity    = '1';
        charEl.style.transform  = '';
        cb && cb();
      }
    }

    requestAnimationFrame(frame);
  }

  // ── VICTORY: cave explodes ─────────────────────────────────
  function triggerVictory() {
    active = false;
    stopTimer();

    const human = $('quiz-human');
    if (human) {
      human.style.transition = 'transform 0.4s cubic-bezier(0.34,1.8,0.64,1)';
      human.style.transform  = 'scaleX(-1) scale(1.3) translateY(-12px)';
    }

    // Explode cave via canvas at cave position
    setTimeout(() => explodeBuildingAt(0.13, ['#7A7A7A','#555','#FF6600','#FFD700','#FF4400'], () => {
      // hide cave SVG
      const cave = $('quiz-cave-group');
      if (cave) { cave.style.opacity = '0'; }
    }), 300);

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

    setTimeout(() => showResult(true, finalScore, bonusPoints, elapsed, false), 1800);
  }

  // ── DEFEAT: house explodes ─────────────────────────────────
  function triggerDefeat() {
    active = false;
    stopTimer();

    const monster = $('quiz-monster');
    if (monster) {
      monster.style.transition = 'transform 0.4s cubic-bezier(0.34,1.8,0.64,1)';
      monster.style.transform  = 'scale(1.4) translateY(-8px)';
    }

    // Explode house at right side
    setTimeout(() => explodeBuildingAt(0.86, ['#9C7A3C','#5C3D1E','#5DE5E5','#7EC850','#FF6600'], () => {
      const house = $('quiz-house-group');
      if (house) { house.style.opacity = '0'; }
    }), 300);

    const elapsed = MAX_SECONDS - secondsLeft;
    setTimeout(() => showResult(false, score, 0, elapsed, false), 1800);
  }

  // ── Explode a building at X% position ─────────────────────
  function explodeBuildingAt(xPct, colours, onDone) {
    const canvas = $('quiz-explosion-canvas');
    if (!canvas) { onDone && onDone(); return; }

    const wrap   = $('quiz-battle-wrap');
    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');
    const cx      = canvas.width  * xPct;
    const cy      = canvas.height * 0.7;

    // Big block explosion
    const particles = [];
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80 + (Math.random() - 0.5) * 0.4;
      const speed = 2 + Math.random() * 8;
      particles.push({
        x: cx + (Math.random()-0.5)*40, y: cy + (Math.random()-0.5)*20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        r: 5 + Math.random() * 12,
        life: 1,
        decay: 0.014 + Math.random() * 0.018,
        color: colours[Math.floor(Math.random() * colours.length)],
        square: Math.random() > 0.4,
      });
    }
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        r: 2 + Math.random() * 4,
        life: 1,
        decay: 0.03 + Math.random() * 0.03,
        color: '#FFFFFF',
        square: false,
      });
    }

    let ringR = 0, ringLife = 1;

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (ringLife > 0) {
        ringR   += 12;
        ringLife -= 0.04;
        // 3 concentric rings for big boom
        [ringR, ringR - 18, ringR - 34].forEach((r, i) => {
          if (r <= 0) return;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,${180-i*40},0,${Math.max(0, ringLife - i*0.15) * 0.9})`;
          ctx.lineWidth   = 5 - i;
          ctx.stroke();
        });
      }

      let any = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        any = true;
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   += 0.25;
        p.vx   *= 0.97;
        p.life -= p.decay;

        ctx.globalAlpha = Math.max(0, p.life);
        if (p.square) {
          const s = Math.max(1, p.r * p.life);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (any || ringLife > 0) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onDone && onDone();
      }
    }

    requestAnimationFrame(frame);
  }

  // ── Result ─────────────────────────────────────────────────
  function showResult(won, finalScore, bonusPoints, elapsed, timedOut) {
    document.getElementById('quiz-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${won ? '🏆' : '💀'}</div>
        <div class="result-title">${won ? 'VICTORY!' : timedOut ? 'TIME UP!' : 'DEFEAT!'}</div>
        <div class="result-subtitle">${won
          ? 'The cave crumbles! All monsters defeated!' + (bonusPoints ? ' Bonus: +' + bonusPoints + ' pts' : '')
          : timedOut ? 'The clock ran out!' : 'Three wrong answers — the village fell!'
        }</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${finalScore}</div><div class="result-stat-label">Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsed)}</div><div class="result-stat-label">Time</div></div>
          <div class="result-stat"><div class="result-stat-value">${currentIndex}</div><div class="result-stat-label">Correct</div></div>
          <div class="result-stat"><div class="result-stat-value">${MAX_LIVES - lives}</div><div class="result-stat-label">Mistakes</div></div>
          ${won && bonusPoints ? `<div class="result-stat"><div class="result-stat-value">+${bonusPoints}</div><div class="result-stat-label">Bonus</div></div>` : ''}
        </div>
        <div class="result-btns">
          <button class="btn-primary"   id="quiz-play-again">PLAY AGAIN</button>
          <button class="btn-secondary" id="quiz-home">HOME</button>
        </div>
      </div>`;
    $('quiz-play-again').onclick = () => { reset(); start(); };
    $('quiz-home').onclick       = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = answering = false;
    stopTimer();
    words = []; allWords = [];
    currentIndex = score = 0;
    secondsLeft  = MAX_SECONDS;
    lives        = MAX_LIVES;
    monsterIdx   = humanIdx = 0;

    // Clear canvas
    const canvas = $('quiz-explosion-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // Restore cave/house opacity
    const cave  = $('quiz-cave-group');
    const house = $('quiz-house-group');
    if (cave)  cave.style.opacity  = '1';
    if (house) house.style.opacity = '1';

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
