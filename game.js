/**
 * Pluffy Bird: Infernal Blaze 🔥
 * Core Game Engine
 */

(function () {
  'use strict';

  // --- CANVAS & SIZING ---
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('game-container');

  // Virtual Game Resolution (Logical coordinates)
  const GAME_WIDTH = 420;
  const GAME_HEIGHT = 700;

  let scale = 1;

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    scale = rect.width / GAME_WIDTH;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }

  window.addEventListener('resize', resizeCanvas);

  // --- UI ELEMENTS ---
  const hud = document.getElementById('hud');
  const scoreDisplay = document.getElementById('score-display');
  const bestDisplay = document.getElementById('best-display');
  const comboDisplay = document.getElementById('combo-display');
  const energyFill = document.getElementById('energy-fill');
  const energyText = document.getElementById('energy-text');
  const btnAudio = document.getElementById('btn-audio-toggle');

  const startScreen = document.getElementById('start-screen');
  const btnStart = document.getElementById('btn-start');

  const gameOverScreen = document.getElementById('game-over-screen');
  const finalScore = document.getElementById('final-score');
  const finalBest = document.getElementById('final-best');
  const finalDestroyed = document.getElementById('final-destroyed');
  const finalMedal = document.getElementById('final-medal');
  const btnRestart = document.getElementById('btn-restart');

  const touchFlapBtn = document.getElementById('touch-flap-btn');
  const touchFireBtn = document.getElementById('touch-fire-btn');

  // --- GAME STATES ---
  const STATE = {
    MENU: 0,
    PLAYING: 1,
    GAMEOVER: 2
  };

  let gameState = STATE.MENU;
  let score = 0;
  let bestScore = parseInt(localStorage.getItem('pluffy_best_score') || '0', 10);
  let pillarsBlasted = 0;
  let combo = 0;
  let comboTimer = 0;
  let canRestart = false;

  // Screen Shake
  let shakeTime = 0;
  let shakeIntensity = 0;

  function triggerShake(duration = 0.2, intensity = 6) {
    shakeTime = duration;
    shakeIntensity = intensity;
  }

  // --- PLUFFY BIRD CHARACTER ---
  const bird = {
    x: 100,
    y: 320,
    radius: 20,
    vy: 0,
    gravity: 0.44,
    jumpStrength: -7.8,
    rotation: 0,
    targetRotation: 0,
    wingAngle: 0,
    wingSpeed: 0.2,
    blinkTimer: 2.0,
    isBlinking: false,

    // Fire Powers
    energy: 100,
    maxEnergy: 100,
    energyRegen: 14, // per sec
    infernoMode: false,
    infernoTimer: 0,
    maxInfernoDuration: 6.0,

    reset() {
      this.x = 100;
      this.y = 320;
      this.vy = 0;
      this.rotation = 0;
      this.targetRotation = 0;
      this.wingAngle = 0;
      this.energy = 100;
      this.infernoMode = false;
      this.infernoTimer = 0;
    },

    flap() {
      this.vy = this.jumpStrength;
      this.targetRotation = -0.45;
      this.wingAngle = -Math.PI * 0.35;
      
      // Emit flap flame burst
      window.particleSystem.emitFlapBurst(this.x - 12, this.y + 8, this.infernoMode);
      window.soundEngine.playFlap();
    },

    shootFireball() {
      const cost = this.infernoMode ? 0 : 30;
      if (this.energy < cost && !this.infernoMode) return false;

      if (!this.infernoMode) {
        this.energy = Math.max(0, this.energy - cost);
      }

      const size = this.infernoMode ? 24 : 15;
      const speed = this.infernoMode ? 14 : 9;
      const isSuper = this.infernoMode;

      fireballs.push(new Fireball(this.x + 22, this.y, speed, size, isSuper));
      window.soundEngine.playFireball();

      // Recoil slightly
      this.vy -= 0.8;

      // Small blast in front of beak
      window.particleSystem.emitBirdFlame(this.x + 25, this.y, true);
      return true;
    },

    activateInferno() {
      this.infernoMode = true;
      this.infernoTimer = this.maxInfernoDuration;
      this.energy = this.maxEnergy;
      window.soundEngine.playPowerup();
      triggerShake(0.4, 10);
      window.particleSystem.emitExplosion(this.x, this.y, '#ffd700', 40);
      window.particleSystem.addFloatingText(this.x, this.y - 35, '🔥 SUPER INFERNO! 🔥', '#ffeb3b', 24);
    },

    update(dt) {
      // Energy regen
      if (!this.infernoMode) {
        this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * dt);
      } else {
        this.infernoTimer -= dt;
        if (this.infernoTimer <= 0) {
          this.infernoMode = false;
          window.particleSystem.addFloatingText(this.x, this.y - 25, 'Inferno Ended', '#ff8a80', 16);
        }
      }

      // Physics
      this.vy += this.gravity * (dt * 60);
      this.vy = Math.min(13, this.vy); // Terminal velocity
      this.y += this.vy * (dt * 60);

      // Rotation interpolation
      if (this.vy > 3) {
        this.targetRotation = Math.min(Math.PI * 0.45, (this.vy - 3) * 0.12);
      }
      this.rotation += (this.targetRotation - this.rotation) * 0.15;

      // Wing flap animation
      this.wingAngle += Math.cos(Date.now() * 0.02) * 0.2;

      // Blinking eye
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        setTimeout(() => { this.isBlinking = false; }, 120);
        this.blinkTimer = 2.5 + Math.random() * 2.5;
      }

      // Tail flame particles
      window.particleSystem.emitBirdFlame(
        this.x - 14 * Math.cos(this.rotation),
        this.y - 14 * Math.sin(this.rotation),
        this.infernoMode
      );
    },

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // Super Inferno Aura
      if (this.infernoMode) {
        const auraPulse = 1 + Math.sin(Date.now() * 0.015) * 0.18;
        ctx.save();
        ctx.shadowColor = '#ffea00';
        ctx.shadowBlur = 30 * auraPulse;
        ctx.beginPath();
        ctx.arc(0, 0, (this.radius + 8) * auraPulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 235, 59, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Bird Body (Chubby Fluffy Silhouette)
      const grad = ctx.createRadialGradient(-4, -6, 2, 0, 0, this.radius);
      if (this.infernoMode) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#fff176');
        grad.addColorStop(0.8, '#ff9100');
        grad.addColorStop(1, '#ff3d00');
      } else {
        grad.addColorStop(0, '#fff59d');
        grad.addColorStop(0.45, '#ffb300');
        grad.addColorStop(0.85, '#ff6f00');
        grad.addColorStop(1, '#d84315');
      }

      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = this.infernoMode ? '#ffe57f' : '#ff5722';
      ctx.shadowBlur = this.infernoMode ? 22 : 12;
      ctx.fill();

      // Wing (Flapping)
      ctx.save();
      ctx.translate(-6, 2);
      ctx.rotate(this.wingAngle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 8, -Math.PI * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = this.infernoMode ? '#ffe082' : '#ff8f00';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Cute Rosy Cheek
      ctx.beginPath();
      ctx.arc(4, 7, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 64, 129, 0.55)';
      ctx.fill();

      // Eye
      const eyeX = 8;
      const eyeY = -5;
      if (this.isBlinking) {
        ctx.beginPath();
        ctx.moveTo(eyeX - 5, eyeY);
        ctx.lineTo(eyeX + 5, eyeY);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#212121';
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Pupil looking forward
        ctx.beginPath();
        ctx.arc(eyeX + 2, eyeY, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#1a0d00';
        ctx.fill();

        // Eye glint
        ctx.beginPath();
        ctx.arc(eyeX + 3.2, eyeY - 1.5, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Fiery Beak
      ctx.beginPath();
      ctx.moveTo(this.radius - 3, -4);
      ctx.lineTo(this.radius + 12, 1);
      ctx.lineTo(this.radius - 3, 7);
      ctx.closePath();
      ctx.fillStyle = '#ff3d00';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.strokeStyle = '#ff9100';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Head Crest / Flame Feathers
      ctx.beginPath();
      ctx.moveTo(-6, -this.radius + 3);
      ctx.quadraticCurveTo(-14, -this.radius - 12, -4, -this.radius - 8);
      ctx.quadraticCurveTo(2, -this.radius - 15, 6, -this.radius + 2);
      ctx.fillStyle = this.infernoMode ? '#fff' : '#ff3d00';
      ctx.fill();

      ctx.restore();
    }
  };

  // --- FIREBALL PROJECTILE ---
  class Fireball {
    constructor(x, y, vx, size = 15, isSuper = false) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.size = size;
      this.isSuper = isSuper;
      this.alive = true;
      this.life = 1.8; // seconds max
    }

    update(dt) {
      this.life -= dt;
      this.x += this.vx * (dt * 60);

      window.particleSystem.emitFireballTrail(this.x - 6, this.y);

      if (this.x > GAME_WIDTH + 60 || this.life <= 0) {
        this.alive = false;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.shadowColor = this.isSuper ? '#ffffff' : '#ff9100';
      ctx.shadowBlur = this.isSuper ? 25 : 15;

      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
      if (this.isSuper) {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#ffea00');
        grad.addColorStop(1, 'rgba(255, 60, 0, 0.2)');
      } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#ffeb3b');
        grad.addColorStop(0.7, '#ff5722');
        grad.addColorStop(1, 'rgba(213, 0, 0, 0.1)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  let fireballs = [];

  // --- VOLCANIC MAGMA PILLARS (OBSTACLES) ---
  class MagmaPillar {
    constructor(x, gapY, gapHeight = 155, width = 64) {
      this.x = x;
      this.gapY = gapY; // center of gap
      this.gapHeight = gapHeight;
      this.width = width;
      this.passed = false;
      this.alive = true;
      this.isDamaged = false;
      this.glowOffset = Math.random() * 10;
    }

    get topHeight() {
      return this.gapY - this.gapHeight / 2;
    }

    get bottomY() {
      return this.gapY + this.gapHeight / 2;
    }

    update(dt, speed) {
      this.x -= speed * (dt * 60);
      if (this.x + this.width < -40) {
        this.alive = false;
      }
    }

    draw(ctx) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.004 + this.glowOffset);

      // Helper to draw basalt rock pillar with magma fissures
      const drawColumn = (px, py, pw, ph, isTop) => {
        if (ph <= 0) return;

        // Dark Basalt base
        const grad = ctx.createLinearGradient(px, py, px + pw, py);
        grad.addColorStop(0, '#1c1517');
        grad.addColorStop(0.3, '#2d2024');
        grad.addColorStop(0.7, '#241a1d');
        grad.addColorStop(1, '#110c0e');

        ctx.fillStyle = grad;
        ctx.fillRect(px, py, pw, ph);

        // Volcanic Rim Cap
        const capH = 18;
        const capY = isTop ? py + ph - capH : py;
        const capW = pw + 10;
        const capX = px - 5;

        ctx.fillStyle = '#3a272c';
        ctx.fillRect(capX, capY, capW, capH);
        ctx.strokeStyle = '#ff5722';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(capX, capY, capW, capH);

        // Magma fissure veins glowing inside
        ctx.save();
        ctx.strokeStyle = `rgba(255, ${Math.floor(100 + 80 * pulse)}, 0, ${0.7 + 0.3 * pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff6d00';
        ctx.shadowBlur = 10 * pulse;

        ctx.beginPath();
        // Vein 1
        ctx.moveTo(px + pw * 0.3, py);
        ctx.lineTo(px + pw * 0.45, py + ph * 0.4);
        ctx.lineTo(px + pw * 0.25, py + ph * 0.7);
        ctx.lineTo(px + pw * 0.5, py + ph);

        // Vein 2
        ctx.moveTo(px + pw * 0.7, py + ph * 0.2);
        ctx.lineTo(px + pw * 0.8, py + ph * 0.6);
        ctx.lineTo(px + pw * 0.65, py + ph * 0.9);
        ctx.stroke();

        ctx.restore();
      };

      // Top pillar
      drawColumn(this.x, 0, this.width, this.topHeight, true);

      // Bottom pillar
      drawColumn(this.x, this.bottomY, this.width, GAME_HEIGHT - this.bottomY, false);

      ctx.restore();
    }

    // Check collision with Pluffy
    collidesWithBird(b) {
      // Check top pillar
      if (b.x + b.radius * 0.8 > this.x && b.x - b.radius * 0.8 < this.x + this.width) {
        if (b.y - b.radius * 0.8 < this.topHeight || b.y + b.radius * 0.8 > this.bottomY) {
          return true;
        }
      }
      return false;
    }

    // Check collision with Fireball
    hitsFireball(fb) {
      if (fb.x + fb.size > this.x && fb.x - fb.size < this.x + this.width) {
        if (fb.y - fb.size < this.topHeight || fb.y + fb.size > this.bottomY) {
          return true;
        }
      }
      return false;
    }
  }

  let pillars = [];
  let pillarTimer = 0;
  const PILLAR_INTERVAL = 2.1; // seconds between pillars
  let pillarSpeed = 2.8;

  // --- COLLECTIBLE FIRE ORBS ---
  class FireOrb {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.baseY = y;
      this.radius = 12;
      this.alive = true;
      this.timeOffset = Math.random() * 10;
    }

    update(dt, speed) {
      this.x -= speed * (dt * 60);
      this.y = this.baseY + Math.sin(Date.now() * 0.005 + this.timeOffset) * 12;
      if (this.x < -30) this.alive = false;
    }

    draw(ctx) {
      ctx.save();
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = 18;

      const grad = ctx.createRadialGradient(this.x, this.y, 1, this.x, this.y, this.radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#ffeb3b');
      grad.addColorStop(0.8, '#ff5722');
      grad.addColorStop(1, 'rgba(255, 60, 0, 0)');

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Mini sparkle
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x - 3, this.y - 3, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    checkCollect(b) {
      const dist = Math.hypot(this.x - b.x, this.y - b.y);
      return dist < this.radius + b.radius;
    }
  }

  let fireOrbs = [];
  let orbsCollected = 0;

  // --- BACKGROUND VOLCANO & MAGMA RENDERING ---
  const background = {
    volcanoMountain1: [],
    volcanoMountain2: [],
    lavaWaveOffset: 0,

    init() {
      // Precompute distant mountain ridges
      this.volcanoMountain1 = [0, 80, 160, 240, 320, 420];
      this.volcanoMountain2 = [0, 60, 140, 210, 300, 380, 420];
      window.particleSystem.initAmbient(GAME_WIDTH, GAME_HEIGHT);
    },

    draw(ctx, dt) {
      this.lavaWaveOffset += dt * 3;

      // 1. Dark Fiery Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      skyGrad.addColorStop(0, '#0c0407');
      skyGrad.addColorStop(0.4, '#240a12');
      skyGrad.addColorStop(0.75, '#4a1017');
      skyGrad.addColorStop(1, '#7a190f');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // 2. Giant Blood-Red / Burning Moon
      ctx.save();
      const moonX = GAME_WIDTH * 0.78;
      const moonY = 120;
      const moonGrad = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 65);
      moonGrad.addColorStop(0, '#fff3e0');
      moonGrad.addColorStop(0.4, '#ff9800');
      moonGrad.addColorStop(0.8, '#d50000');
      moonGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = moonGrad;
      ctx.shadowColor = '#ff5722';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Far Silhouette Volcanoes
      ctx.fillStyle = '#1c0a10';
      ctx.beginPath();
      ctx.moveTo(0, GAME_HEIGHT - 120);
      ctx.lineTo(80, GAME_HEIGHT - 240);
      ctx.lineTo(160, GAME_HEIGHT - 160);
      ctx.lineTo(260, GAME_HEIGHT - 270); // Peak
      ctx.lineTo(360, GAME_HEIGHT - 150);
      ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - 220);
      ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
      ctx.lineTo(0, GAME_HEIGHT);
      ctx.fill();

      // Volcano Peak Molten Glow
      ctx.save();
      ctx.shadowColor = '#ff6d00';
      ctx.shadowBlur = 25;
      ctx.strokeStyle = '#ff9100';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(250, GAME_HEIGHT - 268);
      ctx.lineTo(270, GAME_HEIGHT - 268);
      ctx.stroke();
      ctx.restore();

      // 4. Ambient Rising Embers & Ash
      window.particleSystem.updateAmbient(GAME_WIDTH, GAME_HEIGHT, dt);
      window.particleSystem.drawAmbient(ctx);

      // 5. Boiling Magma Lava Floor
      const floorH = 65;
      const floorY = GAME_HEIGHT - floorH;

      const lavaGrad = ctx.createLinearGradient(0, floorY, 0, GAME_HEIGHT);
      lavaGrad.addColorStop(0, '#ff9100');
      lavaGrad.addColorStop(0.15, '#ff3d00');
      lavaGrad.addColorStop(0.6, '#b71c1c');
      lavaGrad.addColorStop(1, '#4a0000');

      ctx.fillStyle = lavaGrad;
      ctx.beginPath();
      ctx.moveTo(0, floorY);

      // Animated undulating magma surface wave
      for (let x = 0; x <= GAME_WIDTH; x += 15) {
        const waveY = floorY + Math.sin(x * 0.05 + this.lavaWaveOffset) * 4;
        ctx.lineTo(x, waveY);
      }
      ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
      ctx.lineTo(0, GAME_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Magma crust glow on top
      ctx.save();
      ctx.shadowColor = '#ffe082';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#fff59d';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  };

  background.init();

  // --- GAME ACTIONS & CONTROLS ---
  function handleFlap() {
    if (gameState === STATE.PLAYING) {
      bird.flap();
    } else if (gameState === STATE.MENU) {
      startGame();
    } else if (gameState === STATE.GAMEOVER) {
      restartGame();
    }
  }

  function handleFire() {
    if (gameState === STATE.PLAYING) {
      bird.shootFireball();
    }
  }

  // Keyboard Listeners
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      handleFlap();
    } else if (e.code === 'KeyF' || e.code === 'KeyX' || e.code === 'Enter') {
      e.preventDefault();
      handleFire();
    }
  });

  // Canvas / Screen Click & Tap
  canvas.addEventListener('pointerdown', (e) => {
    // Primary click / tap
    if (e.button === 0) {
      handleFlap();
    } else if (e.button === 2) {
      e.preventDefault();
      handleFire();
    }
  });

  // Prevent default context menu on right click for instant fire shooting
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // On-screen touch buttons
  touchFlapBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    handleFlap();
  });

  touchFireBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    handleFire();
  });

  // Button clicks
  btnStart.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
  });

  btnRestart.addEventListener('click', (e) => {
    e.stopPropagation();
    restartGame();
  });

  btnAudio.addEventListener('click', (e) => {
    e.stopPropagation();
    const isMuted = window.soundEngine.toggleMute();
    btnAudio.textContent = isMuted ? '🔇' : '🔊';
  });

  // --- GAME FLOW LOGIC ---
  function startGame() {
    gameState = STATE.PLAYING;
    score = 0;
    pillarsBlasted = 0;
    combo = 0;
    comboTimer = 0;
    orbsCollected = 0;
    pillarSpeed = 2.8;

    pillars = [];
    fireballs = [];
    fireOrbs = [];
    pillarTimer = 0.5;

    bird.reset();
    bird.flap();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    updateHUD();
    window.soundEngine.startBgm();
  }

  function triggerGameOver() {
    gameState = STATE.GAMEOVER;
    window.soundEngine.playHit();
    triggerShake(0.5, 14);

    // Save High Score
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('pluffy_best_score', bestScore.toString());
    }

    // Explosion where bird dies
    window.particleSystem.emitExplosion(bird.x, bird.y, '#ff3d00', 35);

    // Prepare Game Over UI
    finalScore.textContent = score;
    finalBest.textContent = bestScore;
    finalDestroyed.textContent = pillarsBlasted;

    // Medal Calculation
    let medal = '🥉 Embers';
    if (score >= 40) medal = '👑 Phoenix Lord';
    else if (score >= 20) medal = '🥇 True Blaze';
    else if (score >= 10) medal = '🥈 Wildfire';
    finalMedal.textContent = medal;

    canRestart = false;

    setTimeout(() => {
      gameOverScreen.classList.remove('hidden');
      canRestart = true;
    }, 600);
  }

  function restartGame() {
    if (!canRestart) return;
    window.particleSystem.clear();
    startGame();
  }

  function addScore(pts = 1, isBlasted = false) {
    if (isBlasted) {
      combo++;
      comboTimer = 3.0; // 3 sec window
      const multiplier = Math.min(4, combo);
      score += pts * multiplier;
      pillarsBlasted++;

      const comboText = combo > 1 ? `x${multiplier} COMBO!` : `BLAST! +${pts}`;
      window.particleSystem.addFloatingText(bird.x + 30, bird.y - 20, comboText, '#ffeb3b', 20);
    } else {
      score += pts;
      window.soundEngine.playScore();
    }

    // Dynamic difficulty speedup
    if (score % 6 === 0 && pillarSpeed < 4.8) {
      pillarSpeed += 0.12;
    }

    updateHUD();
  }

  function updateHUD() {
    scoreDisplay.textContent = score;
    bestDisplay.textContent = bestScore;

    // Energy meter
    const energyPct = Math.floor((bird.energy / bird.maxEnergy) * 100);
    energyFill.style.width = `${energyPct}%`;

    if (bird.infernoMode) {
      energyText.textContent = `RAMPAGE! ${Math.ceil(bird.infernoTimer)}s`;
      energyText.style.color = '#ffeb3b';
      energyFill.style.background = 'linear-gradient(90deg, #fff, #ffd700, #ff5722)';
    } else if (bird.energy >= 30) {
      energyText.textContent = 'FIRE READY';
      energyText.style.color = '#ffcc80';
      energyFill.style.background = 'linear-gradient(90deg, #ff1100, #ff8c00, #ffea00)';
    } else {
      energyText.textContent = 'CHARGING...';
      energyText.style.color = '#888';
      energyFill.style.background = 'linear-gradient(90deg, #555, #888)';
    }

    // Combo badge
    if (combo >= 2 && comboTimer > 0) {
      comboDisplay.classList.remove('hidden');
      comboDisplay.textContent = `x${Math.min(4, combo)} COMBO!`;
    } else {
      comboDisplay.classList.add('hidden');
    }
  }

  // --- SPAWNING SYSTEM ---
  function spawnPillar() {
    const minGapY = 160;
    const maxGapY = GAME_HEIGHT - 220;
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);
    const gapHeight = Math.max(140, 165 - score * 0.8); // slight narrowing as score increases

    pillars.push(new MagmaPillar(GAME_WIDTH + 20, gapY, gapHeight));

    // 40% chance to spawn a bonus Fire Orb in the gap!
    if (Math.random() < 0.45) {
      fireOrbs.push(new FireOrb(GAME_WIDTH + 55, gapY));
    }
  }

  // --- MAIN UPDATE & DRAW LOOP ---
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    // 1. Update Game
    if (gameState === STATE.PLAYING) {
      // Combo decay timer
      if (comboTimer > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) {
          combo = 0;
          updateHUD();
        }
      }

      // Bird update
      bird.update(dt);

      // Floor & Ceiling death checks
      const floorY = GAME_HEIGHT - 65;
      if (bird.y + bird.radius >= floorY) {
        bird.y = floorY - bird.radius;
        triggerGameOver();
      } else if (bird.y - bird.radius <= 0) {
        bird.y = bird.radius;
        bird.vy = 0;
      }

      // Pillars spawn & update
      pillarTimer -= dt;
      if (pillarTimer <= 0) {
        spawnPillar();
        pillarTimer = Math.max(1.4, PILLAR_INTERVAL - score * 0.02);
      }

      for (let i = pillars.length - 1; i >= 0; i--) {
        const p = pillars[i];
        p.update(dt, pillarSpeed);

        // Check passing score
        if (!p.passed && p.x + p.width < bird.x) {
          p.passed = true;
          addScore(1, false);
        }

        // Collision with bird
        if (p.collidesWithBird(bird)) {
          if (bird.infernoMode) {
            // Smash right through in Inferno Rampage!
            p.alive = false;
            window.soundEngine.playExplosion();
            triggerShake(0.35, 12);
            window.particleSystem.emitExplosion(p.x + p.width / 2, bird.y, '#ffd700', 36);
            addScore(3, true);
          } else {
            triggerGameOver();
          }
        }

        // Collision with fireballs
        for (let f = fireballs.length - 1; f >= 0; f--) {
          const fb = fireballs[f];
          if (p.hitsFireball(fb)) {
            fb.alive = false;
            p.alive = false; // Shatter the entire magma pillar!
            window.soundEngine.playExplosion();
            triggerShake(0.3, 9);
            window.particleSystem.emitExplosion(p.x + p.width / 2, fb.y, '#ff3d00', 32);
            addScore(2, true);
            break;
          }
        }

        if (!p.alive) {
          pillars.splice(i, 1);
        }
      }

      // Fireballs update
      for (let i = fireballs.length - 1; i >= 0; i--) {
        fireballs[i].update(dt);
        if (!fireballs[i].alive) {
          fireballs.splice(i, 1);
        }
      }

      // Fire Orbs update & collection
      for (let i = fireOrbs.length - 1; i >= 0; i--) {
        const orb = fireOrbs[i];
        orb.update(dt, pillarSpeed);

        if (orb.checkCollect(bird)) {
          orb.alive = false;
          orbsCollected++;
          bird.energy = Math.min(bird.maxEnergy, bird.energy + 40);
          window.soundEngine.playScore();
          window.particleSystem.emitBirdFlame(orb.x, orb.y, true);
          window.particleSystem.addFloatingText(orb.x, orb.y, '+ORB!', '#ffeb3b', 18);

          // Every 3 Orbs collected = SUPER INFERNO!
          if (orbsCollected % 3 === 0) {
            bird.activateInferno();
          }
        }

        if (!orb.alive) {
          fireOrbs.splice(i, 1);
        }
      }

      updateHUD();
    } else if (gameState === STATE.MENU) {
      // Gentle float hover in menu
      bird.y = 320 + Math.sin(Date.now() * 0.004) * 14;
      bird.targetRotation = 0;
      bird.rotation = Math.sin(Date.now() * 0.003) * 0.08;
      window.particleSystem.emitBirdFlame(bird.x - 14, bird.y, false);
    }

    // Particles & FX update
    window.particleSystem.update(dt);

    // Screen shake update
    if (shakeTime > 0) {
      shakeTime -= dt;
    }

    // 2. Draw Game
    ctx.save();

    // Apply Screen Shake
    if (shakeTime > 0) {
      const offsetX = (Math.random() - 0.5) * shakeIntensity * 2;
      const offsetY = (Math.random() - 0.5) * shakeIntensity * 2;
      ctx.translate(offsetX, offsetY);
    }

    // Clear and draw background
    background.draw(ctx, dt);

    // Draw Pillars
    for (let p of pillars) {
      p.draw(ctx);
    }

    // Draw Fire Orbs
    for (let orb of fireOrbs) {
      orb.draw(ctx);
    }

    // Draw Fireballs
    for (let fb of fireballs) {
      fb.draw(ctx);
    }

    // Draw Pluffy Bird
    if (gameState !== STATE.GAMEOVER || shakeTime > 0.1) {
      bird.draw(ctx);
    }

    // Draw Particles & Floating Texts
    window.particleSystem.draw(ctx);

    ctx.restore();

    requestAnimationFrame(gameLoop);
  }

  // --- INITIALIZATION ---
  resizeCanvas();
  bestDisplay.textContent = bestScore;
  requestAnimationFrame(gameLoop);

})();
