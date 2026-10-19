/**
 * Pluffy Bird: Infernal Blaze
 * Particle Engine & Visual Effects
 */

class Particle {
  constructor(x, y, vx, vy, size, color, life, type = 'fire') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.maxSize = size;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.type = type; // 'fire', 'smoke', 'spark', 'debris', 'ring'
    this.alpha = 1;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.1;
  }

  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.rotation += this.rotSpeed;

    const progress = Math.max(0, this.life / this.maxLife);

    if (this.type === 'fire') {
      this.size = this.maxSize * progress;
      this.alpha = Math.min(1, progress * 1.5);
      this.vy -= 0.04 * (dt * 60); // rise upwards
    } else if (this.type === 'smoke') {
      this.size = this.maxSize * (1 + (1 - progress) * 1.5);
      this.alpha = progress * 0.4;
      this.vy -= 0.02 * (dt * 60);
    } else if (this.type === 'spark') {
      this.size = this.maxSize * progress;
      this.alpha = progress;
      this.vy += 0.05 * (dt * 60); // slight gravity
    } else if (this.type === 'debris') {
      this.alpha = Math.min(1, progress * 1.2);
      this.vy += 0.25 * (dt * 60); // gravity
    } else if (this.type === 'ring') {
      this.size = this.maxSize * (1 + (1 - progress) * 3);
      this.alpha = progress * 0.8;
    }

    return this.life > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));

    if (this.type === 'ring') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.lineWidth = 4 * (this.life / this.maxLife);
      ctx.strokeStyle = this.color;
      ctx.stroke();
    } else if (this.type === 'debris') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else {
      // Soft radial glow for fire & sparks
      const grad = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, Math.max(1, this.size)
      );
      grad.addColorStop(0, this.color);
      grad.addColorStop(0.5, this.type === 'smoke' ? 'rgba(50, 40, 45, 0.5)' : 'rgba(255, 60, 0, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(1, this.size), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color = '#ffd54f', fontSize = 18) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.fontSize = fontSize;
    this.life = 1.0;
    this.maxLife = 1.0;
  }

  update(dt) {
    this.life -= dt;
    this.y -= 35 * dt;
    return this.life > 0;
  }

  draw(ctx) {
    ctx.save();
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${this.fontSize}px 'Fredoka One', sans-serif`;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.ambientEmbers = [];
    this.maxAmbient = 45;
  }

  initAmbient(width, height) {
    this.ambientEmbers = [];
    for (let i = 0; i < this.maxAmbient; i++) {
      this.ambientEmbers.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.8,
        size: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.6,
        color: Math.random() > 0.4 ? '#ff7700' : '#ffea00'
      });
    }
  }

  updateAmbient(width, height, dt) {
    for (let ember of this.ambientEmbers) {
      ember.x += ember.vx * dt * 60;
      ember.y += ember.vy * dt * 60;
      ember.alpha += (Math.random() - 0.5) * 0.05;
      if (ember.alpha < 0.2) ember.alpha = 0.2;
      if (ember.alpha > 0.9) ember.alpha = 0.9;

      if (ember.y < -10) {
        ember.y = height + 10;
        ember.x = Math.random() * width;
      }
      if (ember.x < -10) ember.x = width + 10;
      if (ember.x > width + 10) ember.x = -10;
    }
  }

  drawAmbient(ctx) {
    ctx.save();
    for (let ember of this.ambientEmbers) {
      ctx.globalAlpha = ember.alpha;
      ctx.fillStyle = ember.color;
      ctx.shadowColor = '#ff5500';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Emit Pluffy tail flame
  emitBirdFlame(x, y, isInferno = false) {
    const count = isInferno ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const vx = -2 - Math.random() * 3;
      const vy = (Math.random() - 0.5) * 1.5;
      const size = (isInferno ? 12 : 7) + Math.random() * 5;
      const life = 0.25 + Math.random() * 0.2;
      const color = isInferno
        ? (Math.random() > 0.3 ? '#ffffff' : '#ffd700')
        : (Math.random() > 0.5 ? '#ffeb3b' : '#ff5722');
      this.particles.push(new Particle(x, y, vx, vy, size, color, life, 'fire'));
    }

    // Occasional smoke puff
    if (Math.random() < 0.35) {
      this.particles.push(new Particle(
        x - 5, y,
        -1.5 - Math.random(),
        (Math.random() - 0.5) * 0.8,
        9 + Math.random() * 6,
        'rgba(80, 50, 50, 0.6)',
        0.45,
        'smoke'
      ));
    }
  }

  // Emit burst when bird flaps
  emitFlapBurst(x, y, isInferno = false) {
    const num = isInferno ? 16 : 9;
    for (let i = 0; i < num; i++) {
      const angle = Math.PI * 0.5 + (Math.random() - 0.5) * 1.8;
      const speed = 2 + Math.random() * 4;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 5 + Math.random() * 6;
      const color = Math.random() > 0.4 ? '#ffb300' : '#ff3d00';
      this.particles.push(new Particle(x, y, vx, vy, size, color, 0.35 + Math.random() * 0.2, 'fire'));
    }
  }

  // Fireball projectile sparks
  emitFireballTrail(x, y) {
    for (let i = 0; i < 3; i++) {
      const vx = -3 - Math.random() * 2;
      const vy = (Math.random() - 0.5) * 2;
      const size = 6 + Math.random() * 6;
      const color = Math.random() > 0.5 ? '#fff176' : '#ff6f00';
      this.particles.push(new Particle(x, y, vx, vy, size, color, 0.2 + Math.random() * 0.15, 'fire'));
    }
  }

  // Fiery explosion when obstacle or enemy is blasted
  emitExplosion(x, y, color = '#ff3d00', intensity = 28) {
    // Blast shockwave ring
    this.particles.push(new Particle(x, y, 0, 0, 15, '#ffaa00', 0.35, 'ring'));

    // High velocity fire burst
    for (let i = 0; i < intensity; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 8 + Math.random() * 12;
      const col = Math.random() > 0.6 ? '#fff' : (Math.random() > 0.3 ? '#ff9100' : '#d50000');
      this.particles.push(new Particle(x, y, vx, vy, size, col, 0.4 + Math.random() * 0.3, 'fire'));
    }

    // Basalt / magma rock debris
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 2;
      const size = 4 + Math.random() * 6;
      const debColor = Math.random() > 0.5 ? '#ff3d00' : '#3e2723';
      this.particles.push(new Particle(x, y, vx, vy, size, debColor, 0.6 + Math.random() * 0.4, 'debris'));
    }

    // Heavy dark smoke
    for (let i = 0; i < 8; i++) {
      const vx = (Math.random() - 0.5) * 2.5;
      const vy = -1 - Math.random() * 2;
      const size = 15 + Math.random() * 15;
      this.particles.push(new Particle(x, y, vx, vy, size, 'rgba(60, 40, 40, 0.5)', 0.6 + Math.random() * 0.3, 'smoke'));
    }
  }

  // Floating score / text notice
  addFloatingText(x, y, text, color = '#ffd54f', fontSize = 18) {
    this.floatingTexts.push(new FloatingText(x, y, text, color, fontSize));
  }

  update(dt) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt)) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      if (!this.floatingTexts[i].update(dt)) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // Render particles using additive blending for vibrant glowing fire
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let p of this.particles) {
      if (p.type !== 'smoke' && p.type !== 'debris') {
        p.draw(ctx);
      }
    }
    ctx.restore();

    // Render smoke and debris with normal blend mode
    for (let p of this.particles) {
      if (p.type === 'smoke' || p.type === 'debris') {
        p.draw(ctx);
      }
    }

    // Draw floating texts
    for (let ft of this.floatingTexts) {
      ft.draw(ctx);
    }
  }

  clear() {
    this.particles = [];
    this.floatingTexts = [];
  }
}

window.particleSystem = new ParticleSystem();
