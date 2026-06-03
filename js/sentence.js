// ============================================================
//  LINGUA QUEST - Missing Word Game (Street Fighter arena)
//
//  Alien LEFT vs Human RIGHT, both standing in the centre.
//  Correct answer → human punches/kicks alien (canvas effect)
//  Wrong answer   → alien punches/kicks human  (canvas effect)
//  3 wrong answers → human KO, alien wins (defeat)
//  Complete all sentences with <3 wrong → human wins, alien KO
// ============================================================

const SentenceGame = (() => {

  const WORD_TARGET       = 20;
  const MAX_SECONDS       = 60;
  const PTS_CORRECT       = 10;
  const PTS_BONUS_PER_SEC = 5;
  const MAX_LIVES         = 3;

  // Rotating fighters
  const ALIENS = ['👽','🤖','👾','🧟','🐙','👻','🦑','🎃'];
  const HUMANS = ['🧙','🥷','🦸','🧝','👩‍🚀','🧑‍🎤','🧞','🧜'];

  // Punch/kick attack labels shown on hit
  const ATTACKS = ['POW!','BAM!','KICK!','SMASH!','HIT!','COMBO!','WHAM!','CRACK!'];

  let sentences    = [];
  let currentIndex = 0;
  let current      = null;
  let score        = 0;
  let lives        = MAX_LIVES;      // human's lives
  let wrongCount   = 0;
  let secondsLeft  = MAX_SECONDS;
  let timerInterval= null;
  let active       = false;
  let animating    = false;
  let alienHP      = 100;
  let humanHP      = 100;
  let alienIdx     = 0;
  let humanIdx     = 0;

  const $ = id => document.getElementById(id);

  // ── DOM refs ───────────────────────────────────────────────
  const dom = () => ({
    progressBar:  $('sent-progress-bar'),
    progressText: $('sent-progress-text'),
    scoreEl:      $('sent-score'),
    timerEl:      $('sent-timer'),
    btnQuit:      $('sent-quit'),
    sentenceEl:   $('sent-sentence'),
    hintEl:       $('sent-hint'),
    translEl:     $('sent-transl'),
    input:        $('sent-input'),
    feedback:     $('sent-feedback'),
    submitBtn:    $('sent-submit'),
    alienEl:      $('sent-alien'),
    humanEl:      $('sent-human'),
    alienHp:      $('sent-alien-hp'),
    humanHp:      $('sent-human-hp'),
    canvas:       $('sent-arena-canvas'),
    arenaWrap:    $('sent-arena-wrap'),
  });

  // ── Build 20-sentence list ─────────────────────────────────
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
    lives        = MAX_LIVES;
    wrongCount   = 0;
    secondsLeft  = MAX_SECONDS;
    active       = true;
    animating    = false;
    alienHP      = 100;
    humanHP      = 100;
    alienIdx     = 0;
    humanIdx     = 0;

    const d = dom();
    d.btnQuit.onclick   = () => App.quitGame();
    d.submitBtn.onclick = () => checkAnswer();
    d.input.addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });

    // Set initial fighters
    d.alienEl.textContent = ALIENS[0];
    d.humanEl.textContent = HUMANS[0];
    d.alienEl.style.transform = 'scaleX(-1)';  // alien faces right
    d.humanEl.style.transform = 'scaleX(1)';   // human faces left (mirrored)

    updateHPBars();
    updateTimerDisplay();
    startTimer();
    loadSentence();
    d.input.focus();
  }

  // ── HP bars ────────────────────────────────────────────────
  function updateHPBars() {
    const d = dom();
    if (d.alienHp) d.alienHp.style.width = Math.max(0, alienHP) + '%';
    if (d.humanHp) d.humanHp.style.width = Math.max(0, humanHP) + '%';
    // Colour shifts green→yellow→red
    const alienColor = alienHP > 50 ? '#17DD62' : alienHP > 25 ? '#FFD700' : '#FF2200';
    const humanColor = humanHP > 50 ? '#17DD62' : humanHP > 25 ? '#FFD700' : '#FF2200';
    if (d.alienHp) d.alienHp.style.background = alienColor;
    if (d.humanHp) d.humanHp.style.background = humanColor;
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
    if (d.feedback) { d.feedback.textContent = '⏰ Time is up!'; d.feedback.className = 'sent-feedback wrong'; }
    if (d.input) d.input.disabled = true;
    setTimeout(() => finishGame(false, true), 900);
  }

  // ── Load sentence ──────────────────────────────────────────
  function loadSentence() {
    const d = dom();
    if (currentIndex >= sentences.length) { finishGame(true, false); return; }
    current = sentences[currentIndex];

    const pct = Math.round((currentIndex / sentences.length) * 100);
    d.progressBar.style.width  = pct + '%';
    d.progressText.textContent = (currentIndex + 1) + ' / ' + sentences.length;
    d.scoreEl.textContent      = score;

    d.sentenceEl.innerHTML = current.sentence.replace('___',
      '<span class="sent-blank">___</span>');
    d.hintEl.textContent   = current.hint;
    d.translEl.textContent = '(' + current.translation + ')';

    d.input.value          = '';
    d.input.disabled       = false;
    d.feedback.textContent = '';
    d.feedback.className   = 'sent-feedback';
    d.input.focus();
  }

  // ── Check answer ───────────────────────────────────────────
  function checkAnswer() {
    if (!active || animating) return;
    const d     = dom();
    const typed = d.input.value.trim();
    if (!typed) return;

    if (typed.toLowerCase() === current.answer.toLowerCase()) {
      // ── CORRECT: human attacks alien ──
      score += PTS_CORRECT;
      d.scoreEl.textContent  = score;
      d.feedback.textContent = '✓ Correct!';
      d.feedback.className   = 'sent-feedback correct';
      d.sentenceEl.innerHTML = current.sentence.replace('___',
        '<span class="sent-answer-fill">' + current.answer + '</span>');
      d.input.disabled = true;

      // Damage alien
      const dmg = Math.floor(100 / sentences.length) + 2;
      alienHP = Math.max(0, alienHP - dmg);

      animating = true;
      animHumanAttack(() => {
        updateHPBars();
        animating = false;
        currentIndex++;
        setTimeout(() => loadSentence(), 300);
      });

    } else {
      // ── WRONG: alien attacks human ──
      wrongCount++;
      d.feedback.textContent = '✗ Try again!';
      d.feedback.className   = 'sent-feedback wrong';

      // Shake input
      d.input.classList.remove('sent-shake');
      void d.input.offsetWidth;
      d.input.classList.add('sent-shake');
      d.input.value = '';

      // Damage human HP
      const hpPerHit = Math.floor(100 / MAX_LIVES);
      humanHP = Math.max(0, humanHP - hpPerHit);

      animating = true;
      animAlienAttack(() => {
        updateHPBars();
        animating = false;

        if (wrongCount >= MAX_LIVES) {
          // Human KO
          animKO('human', () => finishGame(false, false));
        } else {
          setTimeout(() => d.input.focus(), 50);
        }
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  ANIMATIONS
  // ──────────────────────────────────────────────────────────

  // Human steps toward alien, punches, steps back
  function animHumanAttack(cb) {
    const d = dom();
    const humanWrap = $('sent-human-wrap');
    const alienEl   = d.alienEl;
    if (!humanWrap || !alienEl) { cb && cb(); return; }

    const attack = ATTACKS[Math.floor(Math.random() * ATTACKS.length)];

    // Step toward alien (move left)
    humanWrap.style.transition = 'transform 0.18s ease-out';
    humanWrap.style.transform  = 'translateX(-55px)';

    setTimeout(() => {
      // Hit flash on alien
      alienEl.style.transition = 'filter 0.08s, transform 0.08s';
      alienEl.style.filter     = 'brightness(5) saturate(0)';
      alienEl.style.transform  = 'scaleX(-1) translateX(18px) scale(1.3)';

      // Hit effect on canvas
      spawnHitEffect('alien', attack, '#44AAFF');

      setTimeout(() => {
        alienEl.style.filter     = '';
        alienEl.style.transform  = 'scaleX(-1) scale(1)';

        // Step back
        humanWrap.style.transition = 'transform 0.2s cubic-bezier(0.34,1.4,0.64,1)';
        humanWrap.style.transform  = 'translateX(0)';

        setTimeout(() => { cb && cb(); }, 220);
      }, 130);
    }, 190);
  }

  // Alien steps toward human, hits, steps back
  function animAlienAttack(cb) {
    const d = dom();
    const alienWrap = $('sent-alien-wrap');
    const humanEl   = d.humanEl;
    if (!alienWrap || !humanEl) { cb && cb(); return; }

    const attack = ATTACKS[Math.floor(Math.random() * ATTACKS.length)];

    // Step toward human (move right)
    alienWrap.style.transition = 'transform 0.18s ease-out';
    alienWrap.style.transform  = 'translateX(55px)';

    setTimeout(() => {
      // Hit flash on human
      humanEl.style.transition = 'filter 0.08s, transform 0.08s';
      humanEl.style.filter     = 'brightness(5) hue-rotate(300deg)';
      humanEl.style.transform  = 'scaleX(1) translateX(-18px) scale(1.3)';

      // Hit effect on canvas
      spawnHitEffect('human', attack, '#FF3300');

      setTimeout(() => {
        humanEl.style.filter    = '';
        humanEl.style.transform = 'scaleX(1) scale(1)';

        // Step back
        alienWrap.style.transition = 'transform 0.2s cubic-bezier(0.34,1.4,0.64,1)';
        alienWrap.style.transform  = 'translateX(0)';

        setTimeout(() => { cb && cb(); }, 220);
      }, 130);
    }, 190);
  }

  // KO animation: loser staggers, flies off screen, canvas big explosion
  function animKO(who, cb) {
    const el   = who === 'alien' ? $('sent-alien')   : $('sent-human');
    const wrap = who === 'alien' ? $('sent-alien-wrap') : $('sent-human-wrap');
    if (!el || !wrap) { cb && cb(); return; }

    // Stagger shake
    el.style.transition = 'transform 0.1s steps(2)';
    el.style.transform  = (who === 'alien' ? 'scaleX(-1) ' : '') + 'translateX(12px) scale(1.2)';

    setTimeout(() => {
      el.style.transform = (who === 'alien' ? 'scaleX(-1) ' : '') + 'translateX(-12px) scale(1.2)';
      setTimeout(() => {
        // Fly off and spin
        const dir = who === 'alien' ? -1 : 1;
        wrap.style.transition = 'transform 0.6s cubic-bezier(0.4,0,1,1), opacity 0.6s ease';
        wrap.style.transform  = `translateX(${dir * 300}px) translateY(-60px) rotate(${dir * 360}deg)`;
        wrap.style.opacity    = '0';

        // Big KO explosion
        const xPct = who === 'alien' ? 28 : 72;
        spawnKOExplosion(xPct, who === 'alien'
          ? ['#9C27B0','#E040FB','#FFD700','#FF6F00']
          : ['#2196F3','#40C4FF','#FFFFFF','#FF3D00']);

        setTimeout(() => { cb && cb(); }, 700);
      }, 110);
    }, 110);
  }

  // ── Canvas: hit spark effect ───────────────────────────────
  function spawnHitEffect(target, label, color) {
    const d      = dom();
    const canvas = d.canvas;
    const wrap   = d.arenaWrap;
    if (!canvas || !wrap) return;

    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');

    // Position: near the target fighter (alien~28%, human~72%)
    const xPct   = target === 'alien' ? 0.30 : 0.70;
    const cx     = canvas.width  * xPct;
    const cy     = canvas.height * 0.52;

    // Spark particles
    const particles = [];
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        r: 3 + Math.random() * 5,
        life: 1,
        decay: 0.06 + Math.random() * 0.06,
        color,
      });
    }

    // Attack label
    let labelLife  = 1;
    const labelX   = cx + (target === 'alien' ? -20 : 20);
    let   labelY   = cy - 20;

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Sparks
      let any = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        any = true;
        p.x    += p.vx; p.y += p.vy; p.vy += 0.15;
        p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      // Hit label (e.g. "POW!")
      if (labelLife > 0) {
        any = true;
        labelY  -= 0.8;
        labelLife -= 0.04;
        ctx.globalAlpha = Math.max(0, labelLife);
        ctx.font        = 'bold 20px "Press Start 2P", monospace';
        ctx.fillStyle   = '#FFFFFF';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth   = 4;
        ctx.textAlign   = 'center';
        ctx.strokeText(label, labelX, labelY);
        ctx.fillText(label, labelX, labelY);
      }

      ctx.globalAlpha = 1;

      if (any) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(frame);
  }

  // ── Canvas: big KO explosion ───────────────────────────────
  function spawnKOExplosion(xPct, colours) {
    const d      = dom();
    const canvas = d.canvas;
    const wrap   = d.arenaWrap;
    if (!canvas || !wrap) return;

    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
    const ctx     = canvas.getContext('2d');
    const cx      = canvas.width  * (xPct / 100);
    const cy      = canvas.height * 0.52;

    const particles = [];
    for (let i = 0; i < 70; i++) {
      const angle = (Math.PI * 2 * i / 70) + (Math.random() - 0.5) * 0.4;
      const speed = 2 + Math.random() * 7;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        r: 4 + Math.random() * 9,
        life: 1,
        decay: 0.018 + Math.random() * 0.022,
        color: colours[Math.floor(Math.random() * colours.length)],
        square: Math.random() > 0.5,
      });
    }
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 9;
      particles.push({ x:cx, y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-4,
        r:2+Math.random()*3, life:1, decay:0.03+Math.random()*0.03, color:'#FFFFFF', square:false });
    }

    // "KO!" text
    let koLife = 1;
    let koY    = cy - 30;

    let ringR = 0, ringLife = 1;

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Shockwave
      if (ringLife > 0) {
        ringR   += 11; ringLife -= 0.045;
        [ringR, ringR-20, ringR-38].forEach((r, i) => {
          if (r <= 0) return;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(255,${180-i*40},80,${Math.max(0,ringLife-i*0.15)*0.85})`;
          ctx.lineWidth = 4 - i;
          ctx.stroke();
        });
      }

      // KO label
      if (koLife > 0) {
        koY    -= 1;
        koLife -= 0.025;
        const scale = 1 + (1 - koLife) * 0.5;
        ctx.globalAlpha = Math.max(0, koLife);
        ctx.save();
        ctx.translate(cx, koY);
        ctx.scale(scale, scale);
        ctx.font        = 'bold 36px "Press Start 2P", monospace';
        ctx.textAlign   = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 6;
        ctx.strokeText('K.O.!', 0, 0);
        ctx.fillStyle   = '#FFD700';
        ctx.fillText('K.O.!', 0, 0);
        ctx.restore();
      }

      let any = ringLife > 0 || koLife > 0;
      for (const p of particles) {
        if (p.life <= 0) continue;
        any = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.vx *= 0.97; p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.square) {
          const s = Math.max(1, p.r * p.life);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x-s/2, p.y-s/2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.r*p.life), 0, Math.PI*2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (any) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(frame);
  }

  // ── Finish ─────────────────────────────────────────────────
  function finishGame(completed, timedOut) {
    active = false;
    stopTimer();

    // Determine win/lose
    const won = completed || (currentIndex >= sentences.length && wrongCount < MAX_LIVES);

    if (won) {
      // Human wins: alien KO
      animating = true;
      animKO('alien', () => {
        animating = false;
        saveAndShowResult(true, timedOut);
      });
    } else {
      // Alien wins: human KO (only if not already done)
      if (!timedOut && wrongCount >= MAX_LIVES) {
        saveAndShowResult(false, false);
      } else {
        saveAndShowResult(false, timedOut);
      }
    }
  }

  function saveAndShowResult(won, timedOut) {
    const bonusPoints = won ? secondsLeft * PTS_BONUS_PER_SEC : 0;
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

    setTimeout(() => showResult(won, timedOut, finalScore, bonusPoints, elapsed), 800);
  }

  function showResult(won, timedOut, finalScore, bonusPoints, elapsed) {
    $('sent-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${won ? '🏆' : '💀'}</div>
        <div class="result-title">${won ? 'VICTORY!' : timedOut ? 'TIME UP!' : 'K.O.!'}</div>
        <div class="result-subtitle">${won
          ? 'The alien is defeated! You completed all sentences!' + (bonusPoints ? ' Bonus: +' + bonusPoints + ' pts' : '')
          : timedOut ? 'The clock ran out!'
          : 'The alien got 3 hits in — you were knocked out!'}</div>
        <div class="result-stats">
          <div class="result-stat"><div class="result-stat-value">${finalScore}</div><div class="result-stat-label">Score</div></div>
          <div class="result-stat"><div class="result-stat-value">${App.formatTime(elapsed)}</div><div class="result-stat-label">Time</div></div>
          <div class="result-stat"><div class="result-stat-value">${currentIndex}</div><div class="result-stat-label">Done</div></div>
          <div class="result-stat"><div class="result-stat-value">${wrongCount}</div><div class="result-stat-label">Hits taken</div></div>
          ${won && bonusPoints ? `<div class="result-stat"><div class="result-stat-value">+${bonusPoints}</div><div class="result-stat-label">Bonus</div></div>` : ''}
        </div>
        <div class="result-btns">
          <button class="btn-primary"   id="sent-play-again">PLAY AGAIN</button>
          <button class="btn-secondary" id="sent-home">HOME</button>
        </div>
      </div>`;
    $('sent-play-again').onclick = () => { reset(); start(); };
    $('sent-home').onclick       = () => App.quitGame();
  }

  // ── Reset ──────────────────────────────────────────────────
  function reset() {
    active = animating = false;
    stopTimer();
    sentences = []; currentIndex = 0; current = null;
    score = wrongCount = 0; secondsLeft = MAX_SECONDS;
    lives = MAX_LIVES; alienHP = humanHP = 100;

    const canvas = $('sent-arena-canvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    const c = $('sent-container');
    if (c && !$('sent-input')) c.innerHTML = sentOriginalHTML;
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
    const c = $('sent-container');
    if (c) sentOriginalHTML = c.innerHTML;
  });

  return { start, reset };
})();
