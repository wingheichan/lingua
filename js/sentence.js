// ============================================================
//  LINGUA QUEST - Missing Word Game
//  Full canvas fighting engine (Street Fighter / Tekken style)
//  - Drawn sprites with idle/walk/attack/hurt/death animations
//  - Alien LEFT faces right, Human RIGHT faces left
//  - Game loop at 60fps with requestAnimationFrame
//  - Correct → human attacks alien; Wrong → alien attacks human
//  - 3 hits = KO; complete all sentences = VICTORY
// ============================================================

const SentenceGame = (() => {

  // ── Game constants ─────────────────────────────────────────
  const WORD_TARGET       = 20;
  const MAX_SECONDS       = 60;
  const PTS_CORRECT       = 10;
  const PTS_BONUS_PER_SEC = 5;
  const MAX_WRONG         = 3;

  // ── State ──────────────────────────────────────────────────
  let sentences    = [];
  let currentIndex = 0;
  let current      = null;
  let score        = 0;
  let wrongCount   = 0;
  let secondsLeft  = MAX_SECONDS;
  let timerInterval= null;
  let active       = false;
  let inputLocked  = false;

  // Canvas / game loop
  let canvas, ctx, animFrame;
  let lastTime = 0;

  // Fighter instances
  let alien, human;

  const $ = id => document.getElementById(id);

  // ════════════════════════════════════════════════════════════
  //  FIGHTER CLASS — canvas-drawn animated sprite
  // ════════════════════════════════════════════════════════════
  class Fighter {
    constructor(cfg) {
      this.x       = cfg.x;
      this.y       = cfg.y;
      this.width   = cfg.width  || 80;
      this.height  = cfg.height || 120;
      this.color   = cfg.color;          // main body colour
      this.color2  = cfg.color2;         // accent colour
      this.facing  = cfg.facing;         // 'right' | 'left'
      this.name    = cfg.name;
      this.isAlien = cfg.isAlien || false;

      this.hp      = 100;
      this.maxHP   = 100;

      // Animation state
      this.state   = 'idle';   // idle | walk | attack | hurt | death | victory
      this.frame   = 0;
      this.frameT  = 0;       // time accumulator ms
      this.frameDur= 80;      // ms per frame

      // Attack hitbox (active frames only)
      this.hitbox     = null;   // { x, y, w, h } world coords
      this.hitActive  = false;
      this.hitFrame   = 3;      // frame on which hit box activates
      this.attackFrames = 7;

      // Hurt flash
      this.hurtTimer  = 0;

      // Particle effects owned by this fighter
      this.particles  = [];

      // Walk bob
      this.bobT = 0;

      // Walk-to target (set externally to trigger smooth movement)
      this.restX      = this.x;    // set after construction
      this.walkTarget = null;      // null = not walking
      this.walkSpeed  = 0;
      this.onArrival  = null;      // callback when walkTarget reached
    }

    // ── Idle animation frames ────────────────────────────────
    get idleFrames() { return 6; }
    get attackTotalFrames() { return this.attackFrames; }
    get hurtFrames() { return 4; }
    get deathFrames() { return 12; }

    setState(s) {
      if (this.state === 'death') return; // dead stays dead
      this.state = s;
      this.frame = 0;
      this.frameT = 0;
      if (s !== 'attack') { this.hitbox = null; this.hitActive = false; }
    }

    update(dt) {
      // Particle update
      this.particles = this.particles.filter(p => p.life > 0);
      this.particles.forEach(p => {
        p.x    += p.vx * dt * 0.06;
        p.y    += p.vy * dt * 0.06;
        p.vy   += 0.3 * dt * 0.06;
        p.life -= p.decay * dt * 0.06;
      });

      this.bobT += dt * 0.004;

      if (this.hurtTimer > 0) this.hurtTimer -= dt;

      // Smooth walk toward walkTarget
      if (this.walkTarget !== null && this.state !== 'attack' &&
          this.state !== 'hurt' && this.state !== 'death') {
        const dist = this.walkTarget - this.x;
        const step = this.walkSpeed * dt * 0.06;
        if (Math.abs(dist) <= Math.max(step, 1.5)) {
          this.x = this.walkTarget;
          this.walkTarget = null;
          this.walkSpeed  = 0;
          if (this.state === 'walk') this.setState('idle');
          if (this.onArrival) { const fn = this.onArrival; this.onArrival = null; fn(); }
        } else {
          this.x += Math.sign(dist) * step;
          if (this.state !== 'walk') this.setState('walk');
        }
      }

      this.frameT += dt;
      if (this.frameT >= this.frameDur) {
        this.frameT -= this.frameDur;
        this.frame++;

        switch (this.state) {
          case 'idle':
            this.frame %= this.idleFrames;
            break;

          case 'walk':
            this.frame %= 6;
            break;

          case 'attack':
            if (this.frame === this.hitFrame) {
              this.hitActive = true;
              this.spawnHitbox();
            }
            if (this.frame > this.hitFrame) {
              this.hitActive = false;
              this.hitbox = null;
            }
            if (this.frame >= this.attackTotalFrames) {
              this.setState('idle');
            }
            break;

          case 'hurt':
            if (this.frame >= this.hurtFrames) this.setState('idle');
            break;

          case 'death':
            if (this.frame >= this.deathFrames) this.frame = this.deathFrames - 1;
            break;

          case 'victory':
            this.frame %= 8;
            break;
        }
      }
    }

    spawnHitbox() {
      const reach = 70;
      if (this.facing === 'right') {
        this.hitbox = { x: this.x + this.width, y: this.y + 20, w: reach, h: 40 };
      } else {
        this.hitbox = { x: this.x - reach, y: this.y + 20, w: reach, h: 40 };
      }
    }

    checkHit(other) {
      if (!this.hitActive || !this.hitbox) return false;
      const h = this.hitbox;
      return (
        h.x < other.x + other.width  &&
        h.x + h.w > other.x          &&
        h.y < other.y + other.height &&
        h.y + h.h > other.y
      );
    }

    spawnHitParticles(x, y) {
      const colors = this.isAlien
        ? ['#FF3300','#FF8800','#FFCC00','#FFFFFF']
        : ['#4488FF','#88CCFF','#FFFFFF','#00FFAA'];
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 4;
        this.particles.push({
          x, y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
          r: 3 + Math.random() * 5,
          life: 1,
          decay: 0.025 + Math.random() * 0.03,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }

    // ── Draw ─────────────────────────────────────────────────
    draw(ctx) {
      ctx.save();

      // Flip context if facing left
      const flip = this.facing === 'left';
      const cx   = this.x + this.width / 2;
      const cy   = this.y;
      if (flip) {
        ctx.translate(cx * 2, 0);
        ctx.scale(-1, 1);
      }

      // Hurt flash
      if (this.hurtTimer > 0 && Math.floor(this.hurtTimer / 60) % 2 === 0) {
        ctx.filter = 'brightness(3) saturate(0)';
      }

      const x = this.x, y = this.y;
      const w = this.width, h = this.height;
      const f = this.frame;

      // Death: fall sideways
      if (this.state === 'death') {
        const progress = f / this.deathFrames;
        ctx.translate(x + w/2, y + h);
        ctx.rotate(progress * Math.PI / 2 * (this.facing === 'right' ? 1 : -1));
        ctx.translate(-(x + w/2), -(y + h));
        ctx.globalAlpha = Math.max(0.1, 1 - progress * 0.7);
      }

      // ── Draw the fighter body ────────────────────────────
      this._drawBody(ctx, x, y, w, h, f);

      ctx.filter = 'none';
      ctx.restore();

      // Draw particles (not affected by flip)
      this.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw hit label
      if (this._hitLabel) {
        this._hitLabel.life -= 0.018;
        this._hitLabel.y    -= 0.4;
        if (this._hitLabel.life > 0) {
          ctx.globalAlpha = this._hitLabel.life;
          ctx.font        = 'bold 18px "Press Start 2P", monospace';
          ctx.textAlign   = 'center';
          ctx.strokeStyle = '#000';
          ctx.lineWidth   = 5;
          ctx.strokeText(this._hitLabel.text, this._hitLabel.x, this._hitLabel.y);
          ctx.fillStyle   = '#FFD700';
          ctx.fillText(this._hitLabel.text, this._hitLabel.x, this._hitLabel.y);
          ctx.globalAlpha = 1;
        } else {
          this._hitLabel = null;
        }
      }
    }

    showHitLabel(text, x, y) {
      this._hitLabel = { text, x, y, life: 1 };
    }

    _drawBody(ctx, x, y, w, h, f) {
      const isAlien = this.isAlien;
      const c1 = this.color;
      const c2 = this.color2;
      const shadow = '#00000066';

      // Bob / breathing
      const bob    = Math.sin(this.bobT) * 3;
      const squat  = Math.abs(Math.sin(this.bobT)) * 2;
      const by     = y + bob;  // body y with bob
      const bh     = h - squat;

      // ── IDLE / WALK ──────────────────────────────────────
      if (this.state === 'idle' || this.state === 'walk' || this.state === 'victory') {
        const wf    = this.state === 'walk' ? f : 0;
        const legOff= this.state === 'walk' ? Math.sin(f * 1.2) * 14 : 0;

        // Shadow on ground
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.ellipse(x + w/2, y + h + 4, w * 0.45, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.fillStyle = c2;
        ctx.fillRect(x + 8,       by + bh * 0.72, 18, bh * 0.3 + legOff);
        ctx.fillRect(x + w - 26,  by + bh * 0.72, 18, bh * 0.3 - legOff);

        // Feet
        ctx.fillStyle = '#2a1500';
        ctx.fillRect(x + 4,      by + bh - 2 + Math.max(0, legOff),  22, 10);
        ctx.fillRect(x + w - 26, by + bh - 2 + Math.max(0, -legOff), 22, 10);

        // Torso
        const torsoW = w * 0.72, torsoX = x + w * 0.14;
        ctx.fillStyle = c1;
        ctx.fillRect(torsoX, by + bh * 0.26, torsoW, bh * 0.48);

        // Arms (swing with walk)
        const armSwing = this.state === 'walk' ? Math.sin(f * 1.2) * 10 : 0;
        ctx.fillStyle  = c1;
        ctx.fillRect(x,         by + bh * 0.27, 14, bh * 0.35 - armSwing);
        ctx.fillRect(x + w - 14, by + bh * 0.27, 14, bh * 0.35 + armSwing);

        // Hands
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(x + 7, by + bh * 0.60 - armSwing * 0.3, 9, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + w - 7, by + bh * 0.60 + armSwing * 0.3, 9, 0, Math.PI*2); ctx.fill();

        // Neck
        ctx.fillStyle = c1;
        ctx.fillRect(x + w*0.38, by + bh * 0.18, w * 0.24, bh * 0.10);

        // Head
        this._drawHead(ctx, x, by, w, bh, c1, c2, isAlien, f);

        // Victory: raise arms
        if (this.state === 'victory') {
          const vf = Math.sin(f * 0.9) * 20;
          ctx.fillStyle = c1;
          ctx.fillRect(x,          by + bh * 0.27 - vf, 14, 40);
          ctx.fillRect(x + w - 14, by + bh * 0.27 - vf, 14, 40);
          ctx.fillStyle = c2;
          ctx.beginPath(); ctx.arc(x + 7, by + bh * 0.27 - vf, 9, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + w - 7, by + bh * 0.27 - vf, 9, 0, Math.PI*2); ctx.fill();
        }
      }

      // ── ATTACK ───────────────────────────────────────────
      else if (this.state === 'attack') {
        // Body lean forward during attack
        const lean = f < this.hitFrame ? f * 3 : (this.attackTotalFrames - f) * 2;

        // Shadow
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.ellipse(x + w/2 + lean, y + h + 4, w * 0.45, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Back leg
        ctx.fillStyle = c2;
        ctx.fillRect(x + 8, by + bh * 0.72, 18, bh * 0.28);
        ctx.fillStyle = '#2a1500';
        ctx.fillRect(x + 4, by + bh - 2, 22, 10);

        // Front leg (kick if attack frame)
        if (f >= this.hitFrame - 1) {
          // Kick leg extends forward
          ctx.fillStyle = c2;
          ctx.save();
          ctx.translate(x + w - 18 + lean, by + bh * 0.72);
          ctx.rotate(-0.5);
          ctx.fillRect(0, 0, 18, bh * 0.35);
          ctx.fillStyle = '#2a1500';
          ctx.fillRect(-2, bh * 0.32, 22, 10);
          ctx.restore();
        } else {
          ctx.fillStyle = c2;
          ctx.fillRect(x + w - 26, by + bh * 0.72, 18, bh * 0.28);
          ctx.fillStyle = '#2a1500';
          ctx.fillRect(x + w - 26, by + bh - 2, 22, 10);
        }

        // Torso (leaned)
        ctx.fillStyle = c1;
        ctx.fillRect(x + lean * 0.5, by + bh * 0.26, w * 0.72, bh * 0.48);

        // Punch arm extends forward
        const punchExt = f >= this.hitFrame ? 32 + lean : lean;
        ctx.fillStyle  = c1;
        ctx.fillRect(x + w * 0.7 + punchExt, by + bh * 0.28, 36, 16); // punch fist forearm
        ctx.fillStyle  = c2;
        ctx.beginPath(); ctx.arc(x + w * 0.7 + punchExt + 36, by + bh * 0.36, 12, 0, Math.PI*2); ctx.fill();

        // Back arm
        ctx.fillStyle = c1;
        ctx.fillRect(x - 4, by + bh * 0.27, 14, bh * 0.3);
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(x + 3, by + bh * 0.56, 9, 0, Math.PI*2); ctx.fill();

        // Neck + head
        ctx.fillStyle = c1;
        ctx.fillRect(x + w * 0.38 + lean * 0.3, by + bh * 0.18, w * 0.24, bh * 0.10);
        this._drawHead(ctx, x + lean * 0.3, by, w, bh, c1, c2, isAlien, f);
      }

      // ── HURT ─────────────────────────────────────────────
      else if (this.state === 'hurt') {
        const reelBack = f * 8;

        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.ellipse(x + w/2 - reelBack * 0.3, y + h + 4, w*0.45, 6, 0, 0, Math.PI*2);
        ctx.fill();

        // Stagger back
        const bx = x - reelBack;
        ctx.fillStyle = c2;
        ctx.fillRect(bx + 8,      by + bh*0.72, 18, bh*0.28);
        ctx.fillRect(bx + w - 26, by + bh*0.72, 18, bh*0.28);
        ctx.fillStyle = '#2a1500';
        ctx.fillRect(bx + 4,      by + bh - 2, 22, 10);
        ctx.fillRect(bx + w - 26, by + bh - 2, 22, 10);
        ctx.fillStyle = c1;
        ctx.fillRect(bx + w*0.14, by + bh*0.26, w*0.72, bh*0.48);
        // Arms flung back
        ctx.fillStyle = c1;
        ctx.fillRect(bx - 10,       by + bh*0.22, 14, bh*0.28);
        ctx.fillRect(bx + w - 4,    by + bh*0.22, 14, bh*0.28);
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(bx - 3, by + bh*0.50, 9, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + w + 3, by + bh*0.50, 9, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = c1;
        ctx.fillRect(bx + w*0.38, by + bh*0.18, w*0.24, bh*0.10);
        this._drawHead(ctx, bx, by, w, bh, c1, c2, isAlien, f);
      }
    }

    // ── Head drawing (shared by states) ──────────────────────
    _drawHead(ctx, x, y, w, h, c1, c2, isAlien, f) {
      const headW = w * 0.52, headH = h * 0.22;
      const hx    = x + (w - headW) / 2;
      const hy    = y + h * 0.02;
      const blink = (f % 8 === 0) ? 2 : 0;

      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.roundRect(hx, hy, headW, headH, 6);
      ctx.fill();

      if (isAlien) {
        // ── Alien head ──────────────────────────────────────
        // Big oval alien head
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.ellipse(x + w/2, hy + headH * 0.4, headW * 0.65, headH * 0.72, 0, 0, Math.PI*2);
        ctx.fill();

        // Alien eyes (large, black, with glow)
        const eyeGlow = this.state === 'attack' ? '#FF4400' : (this.state === 'hurt' ? '#FF0000' : '#00FF44');
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(x + w*0.35, hy + headH*0.3, 9, 7, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + w*0.65, hy + headH*0.3, 9, 7,  0.3, 0, Math.PI*2); ctx.fill();
        // Iris glow
        ctx.fillStyle = eyeGlow;
        ctx.beginPath(); ctx.ellipse(x + w*0.35, hy + headH*0.3, 5, 4, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + w*0.65, hy + headH*0.3, 5, 4,  0.3, 0, Math.PI*2); ctx.fill();

        // Alien mouth slit
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w*0.38, hy + headH*0.62);
        ctx.lineTo(x + w*0.62, hy + headH*0.62);
        ctx.stroke();

        // Antennae
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x+w*0.42, hy); ctx.lineTo(x+w*0.38, hy-12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+w*0.58, hy); ctx.lineTo(x+w*0.64, hy-12); ctx.stroke();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(x+w*0.38, hy-13, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+w*0.64, hy-13, 3, 0, Math.PI*2); ctx.fill();

      } else {
        // ── Human head ──────────────────────────────────────
        ctx.fillStyle = '#FDBCB4'; // skin
        ctx.beginPath();
        ctx.roundRect(hx, hy, headW, headH, 8);
        ctx.fill();

        // Hair
        ctx.fillStyle = c2;
        ctx.fillRect(hx, hy, headW, headH * 0.32);
        ctx.beginPath(); ctx.arc(hx, hy + headH*0.16, headH*0.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(hx + headW, hy + headH*0.16, headH*0.2, 0, Math.PI*2); ctx.fill();

        // Eyes
        ctx.fillStyle = this.state === 'hurt' ? '#FF4444' : '#222';
        const eyeY = hy + headH * 0.52;
        ctx.beginPath(); ctx.ellipse(hx + headW*0.3, eyeY, 5, 5 - blink, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(hx + headW*0.7, eyeY, 5, 5 - blink, 0, 0, Math.PI*2); ctx.fill();
        // Eye shine
        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.arc(hx + headW*0.3 + 2, eyeY - 1, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(hx + headW*0.7 + 2, eyeY - 1, 1.5, 0, Math.PI*2); ctx.fill();

        // Mouth
        ctx.strokeStyle = this.state === 'attack' ? '#e74c3c' : '#8B4513';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        if (this.state === 'attack') {
          ctx.moveTo(hx + headW*0.3, hy + headH*0.78);
          ctx.lineTo(hx + headW*0.7, hy + headH*0.78);
        } else {
          ctx.arc(hx + headW/2, hy + headH*0.70, headW*0.22, 0.2, Math.PI - 0.2);
        }
        ctx.stroke();
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  BACKGROUND DRAWING
  // ════════════════════════════════════════════════════════════
  function drawBackground(ctx, W, H) {
    // Sky gradient (purple/sunset)
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    sky.addColorStop(0,   '#1a0030');
    sky.addColorStop(0.5, '#5B0089');
    sky.addColorStop(1,   '#C2410C');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.75);

    // Moon
    ctx.fillStyle   = '#FFFDE0';
    ctx.shadowBlur  = 20;
    ctx.shadowColor = '#FFFDE0';
    ctx.beginPath(); ctx.arc(W * 0.15, H * 0.12, 22, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur  = 0;
    // Moon crater
    ctx.fillStyle = '#EEE8C0';
    ctx.beginPath(); ctx.arc(W * 0.15 + 6, H * 0.12 - 4, 6, 0, Math.PI*2); ctx.fill();

    // Stars (deterministic)
    ctx.fillStyle = '#FFFFFF';
    const starSeed = [
      [0.25,0.06],[0.38,0.04],[0.52,0.09],[0.65,0.03],[0.75,0.07],
      [0.85,0.12],[0.90,0.05],[0.45,0.15],[0.60,0.14],[0.30,0.14],
    ];
    starSeed.forEach(([sx, sy]) => {
      ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.001 + sx * 100) * 0.3;
      ctx.beginPath(); ctx.arc(sx * W, sy * H, 1.2, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Distant mountains silhouette
    ctx.fillStyle = '#2D0050';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.58);
    ctx.lineTo(W * 0.08, H * 0.40);
    ctx.lineTo(W * 0.18, H * 0.52);
    ctx.lineTo(W * 0.30, H * 0.36);
    ctx.lineTo(W * 0.42, H * 0.50);
    ctx.lineTo(W * 0.55, H * 0.32);
    ctx.lineTo(W * 0.67, H * 0.48);
    ctx.lineTo(W * 0.78, H * 0.38);
    ctx.lineTo(W * 0.88, H * 0.52);
    ctx.lineTo(W, H * 0.44);
    ctx.lineTo(W, H * 0.75); ctx.lineTo(0, H * 0.75);
    ctx.closePath(); ctx.fill();

    // Arena floor (pixel tiles)
    const floorY = H * 0.75;
    const floorH = H - floorY;
    ctx.fillStyle = '#2D2040';
    ctx.fillRect(0, floorY, W, floorH);
    ctx.fillStyle = '#3D3060';
    ctx.fillRect(0, floorY, W, 8);

    // Tile grid
    ctx.strokeStyle = '#1A1030';
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 0.4;
    for (let tx = 0; tx < W; tx += 80) {
      ctx.beginPath(); ctx.moveTo(tx, floorY); ctx.lineTo(tx, H); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, floorY + floorH * 0.5); ctx.lineTo(W, floorY + floorH * 0.5); ctx.stroke();
    ctx.globalAlpha = 1;

    // Centre line glow
    ctx.strokeStyle = 'rgba(255,215,0,0.25)';
    ctx.lineWidth   = 3;
    ctx.beginPath(); ctx.moveTo(W/2, floorY); ctx.lineTo(W/2, H); ctx.stroke();

    // Crowd silhouettes (left & right, gap in middle)
    ctx.fillStyle = '#1A0028';
    const drawCrowdHead = (cx, cy, r) => {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    };
    const leftCrowd  = [[0.04,0.66],[0.09,0.63],[0.14,0.67],[0.20,0.64],[0.26,0.67],[0.32,0.63]];
    const rightCrowd = [[0.68,0.63],[0.74,0.67],[0.80,0.64],[0.86,0.67],[0.91,0.63],[0.96,0.66]];
    [...leftCrowd, ...rightCrowd].forEach(([cx,cy]) => drawCrowdHead(cx*W, cy*H, 10 + Math.random()*4));

    // Spotlight cones
    const drawSpot = (sx, ex, col) => {
      const grad = ctx.createLinearGradient(sx, 0, ex, floorY);
      grad.addColorStop(0, col.replace(')', ',0.0)').replace('rgb', 'rgba'));
      grad.addColorStop(1, col.replace(')', ',0.06)').replace('rgb', 'rgba'));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(ex - 80, floorY);
      ctx.lineTo(ex + 80, floorY);
      ctx.closePath();
      ctx.fill();
    };
    drawSpot(W * 0.25, W * 0.38, 'rgb(255,200,50)');
    drawSpot(W * 0.75, W * 0.62, 'rgb(180,100,255)');
  }

  // ════════════════════════════════════════════════════════════
  //  HP BARS
  // ════════════════════════════════════════════════════════════
  function updateHPBars() {
    const ah = $('sent-alien-hp');
    const hh = $('sent-human-hp');
    if (!alien || !human) return;

    const alienPct = Math.max(0, alien.hp / alien.maxHP * 100);
    const humanPct = Math.max(0, human.hp / human.maxHP * 100);

    if (ah) {
      ah.style.width      = alienPct + '%';
      ah.style.background = alienPct > 50 ? '#17DD62' : alienPct > 25 ? '#FFD700' : '#FF2200';
    }
    if (hh) {
      hh.style.width      = humanPct + '%';
      hh.style.background = humanPct > 50 ? '#17DD62' : humanPct > 25 ? '#FFD700' : '#FF2200';
    }
  }

  // ════════════════════════════════════════════════════════════
  //  GAME LOOP
  // ════════════════════════════════════════════════════════════
  function startGameLoop() {
    lastTime = performance.now();
    function loop(ts) {
      const dt = Math.min(ts - lastTime, 50); // cap at 50ms
      lastTime = ts;

      if (!canvas) return;

      // Sync canvas pixel size to its CSS-rendered size every frame
      resizeCanvas();

      // If fighters were placed with zero dimensions, re-place them
      if (alien && alien.width < 1) setupFighters();

      const W = canvas.width, H = canvas.height;
      if (W < 10 || H < 10) { animFrame = requestAnimationFrame(loop); return; }
      ctx.clearRect(0, 0, W, H);

      drawBackground(ctx, W, H);
      if (alien) alien.update(dt);
      if (human) human.update(dt);

      // Floor shadow for fighters
      const floorY = H * 0.75;

      if (alien) alien.draw(ctx);
      if (human) human.draw(ctx);

      // Debug hitbox (disabled in production)
      // if (alien?.hitActive && alien.hitbox) { ... }

      animFrame = requestAnimationFrame(loop);
    }
    animFrame = requestAnimationFrame(loop);
  }

  function stopGameLoop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  }

  // ════════════════════════════════════════════════════════════
  //  SENTENCE GAME LOGIC
  // ════════════════════════════════════════════════════════════

  function buildList(pool) {
    const result = [];
    while (result.length < WORD_TARGET) result.push(...shuffle([...pool]));
    return result.slice(0, WORD_TARGET);
  }

  function setupCanvas() {
    canvas = $('sent-arena-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrap = $('sent-arena-wrap');
    let W = 800, H = 300;
    if (wrap) {
      const r = wrap.getBoundingClientRect();
      if (r.width  > 10) W = Math.floor(r.width);
      if (r.height > 10) H = Math.floor(r.height);
      // fallback: offsetWidth
      if (W < 10) W = wrap.offsetWidth  || 800;
      if (H < 10) H = wrap.offsetHeight || 300;
    }
    // Only resize if dimensions actually changed (avoids clearing mid-frame)
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }
  }

  function setupFighters() {
    if (!canvas) return;
    resizeCanvas();   // ensure canvas has real pixel dimensions before placing fighters
    const W = canvas.width  || 800;
    const H = canvas.height || 300;
    const floorY = H * 0.75;
    const fH     = Math.min(120, H * 0.48);
    const fW     = fH * 0.65;

    // Alien: left side, faces RIGHT
    alien = new Fighter({
      x:       W * 0.12,
      y:       floorY - fH,
      width:   fW,
      height:  fH,
      color:   '#3DD68C',
      color2:  '#00FF88',
      facing:  'right',
      name:    'ALIEN',
      isAlien: true,
    });
    alien.restX = W * 0.12;   // home position

    // Human: right side, faces LEFT
    human = new Fighter({
      x:       W * 0.76 - fW,
      y:       floorY - fH,
      width:   fW,
      height:  fH,
      color:   '#3498DB',
      color2:  '#8B4513',
      facing:  'left',
      name:    'HUMAN',
      isAlien: false,
    });
    human.restX = W * 0.76 - fW;  // home position
  }

  function start() {
    const sub = App.state.selectedSubcategory;
    sentences    = buildList(sub.sentences);
    currentIndex = 0;
    score        = 0;
    wrongCount   = 0;
    secondsLeft  = MAX_SECONDS;
    active       = true;
    inputLocked  = false;

    const d = {
      btnQuit:  $('sent-quit'),
      submitBtn:$('sent-submit'),
      input:    $('sent-input'),
    };
    if (d.btnQuit)   d.btnQuit.onclick   = () => App.quitGame();
    if (d.submitBtn) d.submitBtn.onclick = () => checkAnswer();
    if (d.input)     d.input.addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });

    // Defer canvas setup to next paint so the arena div has real dimensions
    requestAnimationFrame(() => {
      setupCanvas();
      setupFighters();
      startGameLoop();
    });
    updateHPBars();
    updateTimerDisplay();
    startTimer();
    loadSentence();
    if (d.input) d.input.focus();
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
    const el = $('sent-timer');
    if (!el) return;
    el.textContent = App.formatTime(secondsLeft);
    el.style.color = secondsLeft <= 10 ? 'var(--redstone)' : 'var(--gold)';
  }

  function timeUp() {
    active = false;
    stopTimer();
    inputLocked = true;
    const fb = $('sent-feedback');
    if (fb) { fb.textContent = '⏰ Time is up!'; fb.className = 'sent-feedback wrong'; }
    const inp = $('sent-input');
    if (inp) inp.disabled = true;
    setTimeout(() => finishGame(false, true), 900);
  }

  // ── Load sentence ──────────────────────────────────────────
  function loadSentence() {
    const pb = $('sent-progress-bar');
    const pt = $('sent-progress-text');
    const sc = $('sent-score');
    const se = $('sent-sentence');
    const hi = $('sent-hint');
    const tr = $('sent-transl');
    const ip = $('sent-input');
    const fb = $('sent-feedback');

    if (currentIndex >= sentences.length) { finishGame(true, false); return; }
    current = sentences[currentIndex];

    if (pb) pb.style.width  = Math.round(currentIndex / sentences.length * 100) + '%';
    if (pt) pt.textContent  = (currentIndex + 1) + ' / ' + sentences.length;
    if (sc) sc.textContent  = score;
    if (se) se.innerHTML    = current.sentence.replace('___', '<span class="sent-blank">___</span>');
    if (hi) hi.textContent  = current.hint;
    if (tr) tr.textContent  = '(' + current.translation + ')';
    if (ip) { ip.value = ''; ip.disabled = false; }
    if (fb) { fb.textContent = ''; fb.className = 'sent-feedback'; }
    inputLocked = false;
    if (ip) ip.focus();
  }

  // ── Check answer ───────────────────────────────────────────
  const PUNCH_LABELS = ['POW!','WHAM!','SMASH!','CRACK!','BAM!','HIT!','KICK!','COMBO!'];

  function checkAnswer() {
    if (!active || inputLocked) return;
    const ip    = $('sent-input');
    const fb    = $('sent-feedback');
    const se    = $('sent-sentence');
    const typed = ip ? ip.value.trim() : '';
    if (!typed) return;

    if (typed.toLowerCase() === current.answer.toLowerCase()) {
      // ── CORRECT ─────────────────────────────────────────
      score += PTS_CORRECT;
      if ($('sent-score')) $('sent-score').textContent = score;
      if (fb) { fb.textContent = '✓ Correct!'; fb.className = 'sent-feedback correct'; }
      if (se) se.innerHTML = current.sentence.replace('___',
        '<span class="sent-answer-fill">' + current.answer + '</span>');
      if (ip) ip.disabled = true;
      inputLocked = true;

      // Damage alien HP
      const hpPerSentence = 100 / sentences.length;
      alien.hp = Math.max(0, alien.hp - hpPerSentence);
      updateHPBars();

      // Human attacks alien
      triggerAttack(human, alien, () => {
        currentIndex++;
        setTimeout(() => loadSentence(), 200);
      });

    } else {
      // ── WRONG ────────────────────────────────────────────
      wrongCount++;
      if (fb) { fb.textContent = '✗ Try again!'; fb.className = 'sent-feedback wrong'; }
      if (ip) {
        ip.classList.remove('sent-shake');
        void ip.offsetWidth;
        ip.classList.add('sent-shake');
        ip.value = '';
      }

      // Damage human HP
      const hpPerHit = Math.floor(100 / MAX_WRONG);
      human.hp = Math.max(0, human.hp - hpPerHit);
      updateHPBars();

      inputLocked = true;
      triggerAttack(alien, human, () => {
        inputLocked = false;
        if (wrongCount >= MAX_WRONG) {
          // Human KO
          human.setState('death');
          setTimeout(() => finishGame(false, false), 1200);
        } else {
          if (ip) ip.focus();
        }
      });
    }
  }

  // ── Trigger an attack sequence ─────────────────────────────
  // Walk the attacker close to the defender, punch, then walk back home
  function triggerAttack(attacker, defender, cb) {
    // Step 1: walk attacker to striking distance
    const gap      = 8;   // pixels gap between fighters when in contact
    const strikeX  = attacker.facing === 'right'
      ? defender.x - attacker.width - gap
      : defender.x + defender.width + gap;

    attacker.walkTarget = strikeX;
    attacker.walkSpeed  = 320;   // px per second (fast charge)
    attacker.setState('walk');

    attacker.onArrival = () => {
      // Step 2: attack
      attacker.setState('attack');
      attacker.frameDur = 55;

      const hitDelay = attacker.hitFrame * attacker.frameDur;
      setTimeout(() => {
        // Impact point on defender body
        const hx = attacker.facing === 'right'
          ? defender.x + 10
          : defender.x + defender.width - 10;
        const hy = defender.y + defender.height * 0.32;

        attacker.spawnHitParticles(hx, hy);
        const label = PUNCH_LABELS[Math.floor(Math.random() * PUNCH_LABELS.length)];
        attacker.showHitLabel(label, hx + (attacker.facing === 'right' ? 30 : -30), hy - 24);

        // Defender hurt
        defender.setState('hurt');
        defender.hurtTimer = 500;

        setTimeout(() => {
          // Step 3: walk attacker back home
          attacker.frameDur   = 80;
          attacker.walkTarget = attacker.restX;
          attacker.walkSpeed  = 240;   // walk back a bit slower
          attacker.setState('walk');

          attacker.onArrival = () => {
            attacker.setState('idle');
            cb && cb();
          };
        }, 320);
      }, hitDelay);
    };
  }

  // ── Finish ─────────────────────────────────────────────────
  function finishGame(completed, timedOut) {
    active = false;
    stopTimer();
    inputLocked = true;

    const won = completed;

    if (won) {
      // Alien gets KO'd
      alien.setState('death');
      human.setState('victory');
      // Big explosion on alien
      setTimeout(() => {
        alien.spawnHitParticles(alien.x + alien.width/2, alien.y + alien.height/2);
        alien.spawnHitParticles(alien.x + alien.width/2, alien.y + alien.height/2);
        alien.spawnHitParticles(alien.x + alien.width/2, alien.y + alien.height/2);
        alien.showHitLabel('K.O.!', alien.x + alien.width/2, alien.y - 10);
      }, 200);
    } else if (!timedOut) {
      // Human got KO'd (already set above)
      alien.setState('victory');
    }

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

    setTimeout(() => showResult(won, timedOut, finalScore, bonusPoints, elapsed), 1500);
  }

  function showResult(won, timedOut, finalScore, bonusPoints, elapsed) {
    stopGameLoop();
    $('sent-container').innerHTML = `
      <div class="result-screen">
        <div class="result-icon">${won ? '🏆' : '💀'}</div>
        <div class="result-title">${won ? 'VICTORY!' : timedOut ? 'TIME UP!' : 'K.O.!'}</div>
        <div class="result-subtitle">${won
          ? 'Alien defeated! All sentences complete!' + (bonusPoints ? ' Bonus: +' + bonusPoints + ' pts' : '')
          : timedOut ? 'Clock ran out!' : 'Three hits taken — knocked out!'}</div>
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
    active = inputLocked = false;
    stopTimer();
    stopGameLoop();
    sentences = []; currentIndex = 0; current = null;
    score = wrongCount = 0; secondsLeft = MAX_SECONDS;
    alien = null; human = null;
    canvas = null; ctx = null;

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
