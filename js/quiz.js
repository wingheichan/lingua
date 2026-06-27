// ============================================================
//  LINGUA QUEST - Quest Battle (rewritten)
//  Player types the Dutch translation — no multiple choice.
//  Correct → human shoots blue fireball → monster explodes,
//            new monster colour spawns from cave.
//  Wrong   → monster shoots red fireball → human explodes,
//            new human colour spawns from house.
//  3 wrong = defeat.  All words done = victory.
// ============================================================

const QuizGame = (() => {

  const MAX_SECONDS       = 60;
  const MAX_LIVES         = 3;
  const PTS_CORRECT       = 20;
  const PTS_BONUS_PER_SEC = 5;

  const MONSTERS = ['👾','👹','👺','🧟','🐲','👿','🦇','🤡'];
  const HUMANS   = ['🧙','🧝','🧚','🦸','🧑‍🚀','🥷','🧜','🦊'];

  let words        = [];
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

  // ── Delegated event handlers (attached to container, survive innerHTML swap) ──
  function _containerClick(e) {
    if (e.target && (e.target.id === 'quiz-submit' || e.target.closest('#quiz-submit'))) {
      checkAnswer();
    }
  }
  function _containerKeydown(e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'quiz-input') {
      checkAnswer();
    }
  }

  // ── Start ──────────────────────────────────────────────────
  function start() {
    const sub = App.state.selectedSubcategory;
    words        = shuffle([...sub.words]);
    currentIndex = 0;
    score        = 0;
    lives        = MAX_LIVES;
    secondsLeft  = MAX_SECONDS;
    active       = true;
    answering    = false;
    monsterIdx   = 0;
    humanIdx     = 0;

    // quiz-quit lives outside quiz-container so always safe
    const quitBtn = $('quiz-quit');
    if (quitBtn) quitBtn.onclick = () => App.quitGame();

    // quiz-submit and quiz-input live inside quiz-container (rebuilt after reset)
    // bind via the container so they work even after innerHTML is restored
    const container = $('quiz-container');
    if (container) {
      container.addEventListener('click', _containerClick);
      container.addEventListener('keydown', _containerKeydown);
    }

    setCharacter('quiz-monster', MONSTERS[0]);
    setCharacter('quiz-human',   HUMANS[0]);
    updateLives();
    updateTimerDisplay();
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
      updateTimerDisplay();
      if (secondsLeft <= 0) { secondsLeft = 0; timeUp(); }
    }, 1000);
  }

  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

  function updateTimerDisplay() {
    const el = $('quiz-timer');
    if (!el) return;
    el.textContent = App.formatTime(secondsLeft);
    el.style.color = secondsLeft <= 10 ? 'var(--redstone)' : 'var(--gold)';
  }

  function timeUp() {
    active = false;
    stopTimer();
    lockInput(true);
    setFeedback('⏰ Time is up!', 'wrong');
    setTimeout(() => showResult(false, score, 0, MAX_SECONDS - secondsLeft, true), 800);
  }

  // ── Render question ────────────────────────────────────────
  function renderQuestion() {
    if (currentIndex >= words.length) { triggerVictory(); return; }

    answering = false;
    spawnMonster();

    const word = words[currentIndex];
    const el = $('quiz-q-text');
    if (el) el.textContent = word.question;

    const num = $('quiz-q-num');
    if (num) num.textContent = (currentIndex + 1) + ' / ' + words.length;

    const sc = $('quiz-score');
    if (sc) sc.textContent = score;

    clearInput();
    setFeedback('', '');
    lockInput(false);
    focusInput();
  }

  // ── Input helpers ──────────────────────────────────────────
  function clearInput() {
    const inp = $('quiz-input');
    if (inp) { inp.value = ''; inp.classList.remove('quiz-input-correct', 'quiz-input-wrong'); }
  }

  function lockInput(lock) {
    const inp = $('quiz-input');
    const btn = $('quiz-submit');
    if (inp) inp.disabled = lock;
    if (btn) btn.disabled = lock;
  }

  function focusInput() {
    const inp = $('quiz-input');
    if (inp) inp.focus();
  }

  function setFeedback(text, type) {
    const fb = $('quiz-feedback');
    if (!fb) return;
    fb.textContent = text;
    fb.className   = 'quiz-feedback' + (type ? ' ' + type : '');
  }

  // ── Check answer ───────────────────────────────────────────
  function checkAnswer() {
    if (!active || answering) return;
    const inp   = $('quiz-input');
    if (!inp) return;
    const typed = inp.value.trim();
    if (!typed) return;

    answering = true;
    lockInput(true);

    const correct = words[currentIndex].answer;

    // Normalise: lowercase, trim, ignore punctuation for comparison
    const norm = s => s.toLowerCase().trim().replace(/[.,!?;:'"()\-]/g, '');

    if (norm(typed) === norm(correct)) {
      // ── CORRECT ─────────────────────────────────────────
      score += PTS_CORRECT;
      const sc = $('quiz-score');
      if (sc) sc.textContent = score;

      inp.classList.add('quiz-input-correct');
      setFeedback('✓ ' + correct, 'correct');

      shootFireball('human-to-monster', () => {
        explodeCharacter('quiz-monster', () => {
          currentIndex++;
          if (currentIndex >= words.length) {
            triggerVictory();
          } else {
            monsterIdx = (monsterIdx + 1) % MONSTERS.length;
            setCharacter('quiz-monster', MONSTERS[monsterIdx]);
            answering = false;
            setTimeout(() => renderQuestion(), 250);
          }
        });
      });

    } else {
      // ── WRONG ────────────────────────────────────────────
      lives--;
      updateLives();

      inp.classList.add('quiz-input-wrong');
      // Show the correct answer after wrong guess
      setFeedback('✗  Answer: ' + correct, 'wrong');

      shootFireball('monster-to-human', () => {
        explodeCharacter('quiz-human', () => {
          if (lives <= 0) {
            triggerDefeat();
          } else {
            humanIdx = (humanIdx + 1) % HUMANS.length;
            setCharacter('quiz-human', HUMANS[humanIdx]);
            spawnCharacter('quiz-human', 'right');
            answering = false;
            setTimeout(() => renderQuestion(), 250);
          }
        });
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

  // ── Spawn monster ──────────────────────────────────────────
  function spawnMonster() {
    spawnCharacter('quiz-monster', 'left');
  }

  function spawnCharacter(id, from) {
    const el = $(id);
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity    = '0';
    el.style.transform  = from === 'left'
      ? 'translateX(-60px) scale(0.3)'
      : 'translateX(60px)  scale(0.3)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = 'transform 0.45s cubic-bezier(0.34,1.6,0.64,1), opacity 0.3s ease';
      el.style.opacity    = '1';
      el.style.transform  = from === 'left' ? 'scaleX(1) scale(1)' : 'scaleX(-1) scale(1)';
    }));
  }

  // ── FIREBALL (canvas) ──────────────────────────────────────
  function shootFireball(direction, onImpact) {
    const canvas = $('quiz-explosion-canvas');
    if (!canvas) { onImpact && onImpact(); return; }

    const wrap = $('quiz-battle-wrap');
    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');

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
    const groundY  = canvas.height * 0.52;

    const isBlue = direction === 'human-to-monster';
    const fromX  = isBlue ? humanX   : monsterX;
    const toX    = isBlue ? monsterX : humanX;

    const color1 = isBlue ? '#44AAFF' : '#FF4400';
    const color2 = isBlue ? '#0066FF' : '#FF8800';
    const glow   = isBlue ? 'rgba(68,170,255,0.6)' : 'rgba(255,100,0,0.6)';

    let progress = 0;
    const STEPS  = 28;
    let impacted = false;
    const trail  = [];

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      progress++;

      const t  = progress / STEPS;
      const cx = fromX + (toX - fromX) * t;
      const arc= Math.sin(t * Math.PI) * (canvas.height * 0.28);
      const cy = groundY - arc;

      trail.push({ x: cx, y: cy, life: 1, r: 7 + Math.random() * 5 });

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
      grd.addColorStop(0, glow); grd.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();

      // Core
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = color1; ctx.fill();
      // Shine
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
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

  // ── EXPLODE character ──────────────────────────────────────
  function explodeCharacter(charId, cb) {
    const canvas  = $('quiz-explosion-canvas');
    const charEl  = $(charId);
    if (!canvas || !charEl) { cb && cb(); return; }

    const wrap     = $('quiz-battle-wrap');
    const wrapRect = wrap.getBoundingClientRect();
    const charRect = charEl.getBoundingClientRect();
    const cx       = charRect.left - wrapRect.left + charRect.width  / 2;
    const cy       = charRect.top  - wrapRect.top  + charRect.height / 2;

    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');

    // Shake then vanish
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

    const COLOURS = charId === 'quiz-monster'
      ? ['#7EC850','#FFD700','#FF6600','#FF0000','#FFFFFF']
      : ['#5DE5E5','#FFFFFF','#FFD700','#FF88FF','#88AAFF'];

    const particles = [];
    for (let i = 0; i < 55; i++) {
      const angle = (Math.PI * 2 * i) / 55 + (Math.random() - 0.5) * 0.3;
      const speed = 2.5 + Math.random() * 5.5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2.5,
        r: 4 + Math.random() * 7, life: 1,
        decay: 0.025 + Math.random() * 0.025,
        color: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        square: Math.random() > 0.5,
      });
    }
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      particles.push({ x:cx,y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-3,
        r:1.5+Math.random()*2.5, life:1, decay:0.04+Math.random()*0.04, color:'#FFFFFF', square:false });
    }

    let ringR = 0, ringLife = 1;

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (ringLife > 0) {
        ringR += 9; ringLife -= 0.06;
        ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(255,220,100,${ringLife * 0.7})`; ctx.lineWidth = 3; ctx.stroke();
        if (ringR > 20) {
          ctx.beginPath(); ctx.arc(cx, cy, ringR-14, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(255,140,0,${ringLife*0.5})`; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      let any = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        any = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.97; p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.square) {
          const s = p.r * p.life;
          ctx.fillStyle = p.color; ctx.fillRect(p.x-s/2, p.y-s/2, s, s);
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r*p.life), 0, Math.PI*2);
          ctx.fillStyle = p.color; ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (any || ringLife > 0) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        charEl.style.transition = 'none';
        charEl.style.opacity    = '1';
        charEl.style.transform  = '';
        cb && cb();
      }
    }
    requestAnimationFrame(frame);
  }

  // ── Building explosion (cave / house) ──────────────────────
  function explodeBuildingAt(xPct, colours, onDone) {
    const canvas = $('quiz-explosion-canvas');
    if (!canvas) { onDone && onDone(); return; }
    const wrap   = $('quiz-battle-wrap');
    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');
    const cx      = canvas.width  * xPct;
    const cy      = canvas.height * 0.7;

    const particles = [];
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i / 80) + (Math.random()-0.5)*0.4;
      const speed = 2 + Math.random() * 8;
      particles.push({
        x: cx+(Math.random()-0.5)*40, y: cy+(Math.random()-0.5)*20,
        vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-4,
        r:5+Math.random()*12, life:1, decay:0.014+Math.random()*0.018,
        color:colours[Math.floor(Math.random()*colours.length)], square:Math.random()>0.4,
      });
    }
    for (let i = 0; i < 35; i++) {
      const angle = Math.random()*Math.PI*2, speed = 4+Math.random()*10;
      particles.push({x:cx,y:cy,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-5,
        r:2+Math.random()*4,life:1,decay:0.03+Math.random()*0.03,color:'#FFFFFF',square:false});
    }
    let ringR=0, ringLife=1;
    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (ringLife > 0) {
        ringR += 12; ringLife -= 0.04;
        [ringR, ringR-18, ringR-34].forEach((r,i) => {
          if (r<=0) return;
          ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
          ctx.strokeStyle=`rgba(255,${180-i*40},0,${Math.max(0,ringLife-i*0.15)*0.9})`;
          ctx.lineWidth=5-i; ctx.stroke();
        });
      }
      let any=false;
      for (const p of particles) {
        if (p.life<=0) continue;
        any=true;
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.25; p.vx*=0.97; p.life-=p.decay;
        ctx.globalAlpha=Math.max(0,p.life);
        if (p.square) { const s=Math.max(1,p.r*p.life); ctx.fillStyle=p.color; ctx.fillRect(p.x-s/2,p.y-s/2,s,s); }
        else { ctx.beginPath();ctx.arc(p.x,p.y,Math.max(0.5,p.r*p.life),0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill(); }
      }
      ctx.globalAlpha=1;
      if (any||ringLife>0) requestAnimationFrame(frame);
      else { ctx.clearRect(0,0,canvas.width,canvas.height); onDone&&onDone(); }
    }
    requestAnimationFrame(frame);
  }

  // ── Victory ────────────────────────────────────────────────
  function triggerVictory() {
    active = false;
    stopTimer();

    const human   = $('quiz-human');
    const monster = $('quiz-monster');
    const cave    = $('quiz-cave-group');

    if (monster) { monster.style.transition='all 0.3s ease'; monster.style.transform='scale(0) rotate(180deg)'; monster.style.opacity='0'; }
    if (human)   { human.style.transition='transform 0.4s cubic-bezier(0.34,1.8,0.64,1)'; human.style.transform='scaleX(-1) scale(1.4) translateY(-14px)'; }

    setTimeout(() => {
      if (cave) { cave.style.transition='all 0.5s ease-in'; cave.style.transformOrigin='105px 168px'; cave.style.transform='scale(0.1) rotate(-30deg)'; cave.style.opacity='0'; }
      explodeBuildingAt(0.13, ['#7A7A7A','#555','#FF6600','#FFD700','#FF4400'], null);
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

  // ── Defeat ─────────────────────────────────────────────────
  function triggerDefeat() {
    active = false;
    stopTimer();

    const monster = $('quiz-monster');
    const human   = $('quiz-human');
    const house   = $('quiz-house-group');

    if (monster) { monster.style.transition='transform 0.4s cubic-bezier(0.34,1.8,0.64,1)'; monster.style.transform='scaleX(1) scale(1.5) translateY(-10px)'; }
    if (human)   { human.style.transition='all 0.55s ease-in'; human.style.transform='scaleX(-1) scale(0.8) rotate(80deg) translateY(30px)'; human.style.opacity='0'; }

    setTimeout(() => {
      if (house) { house.style.transition='all 0.5s ease-in'; house.style.transformOrigin='689px 140px'; house.style.transform='scale(0.05) rotate(20deg)'; house.style.opacity='0'; }
      explodeBuildingAt(0.86, ['#9C7A3C','#5C3D1E','#5DE5E5','#7EC850','#FF6600'], null);
    }, 400);

    const elapsed = MAX_SECONDS - secondsLeft;
    setTimeout(() => showResult(false, score, 0, elapsed, false), 1700);
  }

  // ── Result ─────────────────────────────────────────────────
  function showResult(won, finalScore, bonusPoints, elapsed, timedOut) {
    document.getElementById('quiz-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${won ? '🏆' : '💀'}</div>
        <div class="result-title">${won ? 'VICTORY!' : timedOut ? 'TIME UP!' : 'DEFEAT!'}</div>
        <div class="result-subtitle">${won
          ? 'The cave is destroyed! All monsters defeated!' + (bonusPoints ? ' Bonus: +' + bonusPoints + ' pts' : '')
          : timedOut ? 'The clock ran out!'
          : 'Three wrong answers — the village fell!'}</div>
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
    words = []; currentIndex = score = 0;
    secondsLeft = MAX_SECONDS; lives = MAX_LIVES;
    monsterIdx = humanIdx = 0;

    const canvas = $('quiz-explosion-canvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    const cave  = $('quiz-cave-group');
    const house = $('quiz-house-group');
    if (cave)  { cave.style.cssText  = ''; }
    if (house) { house.style.cssText = ''; }

    const c = $('quiz-container');
    if (c) {
      c.removeEventListener('click', _containerClick);
      c.removeEventListener('keydown', _containerKeydown);
      if (!$('quiz-q-text')) c.innerHTML = quizOriginalHTML;
    }
  }

  function shuffle(arr) {
    for (let i = arr.length-1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
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
