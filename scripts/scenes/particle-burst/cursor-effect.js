import { drawPixelDiamond } from "../../lib/canvas.js";
import { randomBetween } from "../../lib/math.js";

export class CursorEffect {
  #context;
  #config;
  #theme;
  #clearField;
  #getStatus;
  #state = {
    particles: [],
    x: 0,
    y: 0,
    active: false,
    visible: false,
    frame: 0,
    lastMoveAt: 0,
    lastSpawnAt: 0,
    lastTime: performance.now(),
  };

  constructor({ context, config, theme, clearField, getStatus }) {
    this.#context = context;
    this.#config = config;
    this.#theme = theme;
    this.#clearField = clearField;
    this.#getStatus = getStatus;
  }

  handlePointerMove(event) {
    if (this.#getStatus().opening) {
      return;
    }

    this.#state.x = event.clientX;
    this.#state.y = event.clientY;
    this.#state.active = true;
    this.#state.visible = true;
    this.#state.lastMoveAt = performance.now();

    if (this.#getStatus().settled) {
      this.#requestFrame();
    }
  }

  handlePointerLeave() {
    this.#state.active = false;
    this.#state.visible = false;

    const { opening, settled } = this.#getStatus();
    if (settled && !opening) {
      this.#clearField();
    }
  }

  updateAndDraw(now, delta) {
    this.#updateParticles(now, delta);
    this.#drawParticles(now);
  }

  clear() {
    this.#state.active = false;
    this.#state.visible = false;
    this.#state.particles = [];
  }

  shiftTime() {
    if (this.#state.frame !== 0) {
      this.#state.lastTime = performance.now();
    }
  }

  #requestFrame() {
    const { opening, settled } = this.#getStatus();

    if (this.#state.frame !== 0 || opening || !settled) {
      return;
    }

    this.#state.lastTime = performance.now();
    this.#state.frame = requestAnimationFrame((now) => this.#animate(now));
  }

  #animate(now) {
    this.#state.frame = 0;

    const { opening, settled } = this.#getStatus();
    if (opening || !settled) {
      return;
    }

    const delta = Math.min((now - this.#state.lastTime) / 1000, 0.033);
    this.#state.lastTime = now;

    this.#clearField();
    this.updateAndDraw(now, delta);

    if (this.#state.active || this.#state.particles.length > 0) {
      this.#requestFrame();
    }
  }

  #updateParticles(now, delta) {
    if (now - this.#state.lastMoveAt > this.#config.cursorActiveMs) {
      this.#state.active = false;
    }

    if (
      this.#state.active &&
      !this.#getStatus().opening &&
      now - this.#state.lastSpawnAt >= this.#config.cursorSpawnEveryMs
    ) {
      this.#state.lastSpawnAt = now;
      this.#spawnParticle(now);
    }

    this.#state.particles = this.#state.particles.filter((particle) => {
      const age = now - particle.createdAt;

      if (age > this.#config.cursorParticleLifeMs) {
        return false;
      }

      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= 0.985;
      particle.vy *= 0.985;

      return true;
    });
  }

  #spawnParticle(now) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(8, 28);

    this.#state.particles.push({
      x: this.#state.x + randomBetween(-3, 3),
      y: this.#state.y + randomBetween(-3, 3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      seed: randomBetween(0, Math.PI * 2),
      size: randomBetween(2.8, 4.4),
      color: this.#theme.mainColor,
      createdAt: now,
    });

    if (this.#state.particles.length > this.#config.cursorParticleMax) {
      this.#state.particles.splice(
        0,
        this.#state.particles.length - this.#config.cursorParticleMax
      );
    }
  }

  #drawParticles(now) {
    for (const particle of this.#state.particles) {
      const age = now - particle.createdAt;
      const life = Math.max(0, 1 - age / this.#config.cursorParticleLifeMs);
      const blink = 0.72 + Math.sin(now * 0.012 + particle.seed) * 0.28;

      this.#context.globalAlpha = life * blink;
      this.#context.fillStyle = particle.color;
      drawPixelDiamond(this.#context, particle.x, particle.y, particle.size);
    }

    if (this.#state.visible && !this.#getStatus().opening) {
      const blink = 0.78 + Math.sin(now * 0.01) * 0.22;

      this.#context.globalAlpha = blink;
      this.#context.fillStyle = this.#theme.mainColor;
      drawPixelDiamond(this.#context, this.#state.x, this.#state.y, 4.4);
    }

    this.#context.globalAlpha = 1;
  }
}
