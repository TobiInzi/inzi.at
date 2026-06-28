import { drawPixelDiamond, fillCanvas, resizeCanvasLayer } from "./canvas.js";
import { CursorEffect } from "./cursor-effect.js";
import { easeInOutCubic, easeInOutSine, randomBetween } from "./math.js";
import { prefersReducedMotion } from "./motion.js";

export class ParticleField {
  #canvas;
  #context;
  #config;
  #theme;
  #onRevealStart;
  #onReady;
  #cursor;
  #state;
  #disposed = false;
  #reduceMotion = false;
  #maxExplodeTailMs = 0;
  #exitMargin = 16;

  constructor({ canvas, config, theme, onRevealStart, onReady }) {
    this.#canvas = canvas;
    this.#context = canvas.getContext("2d", { alpha: false });
    this.#config = config;
    this.#theme = theme;
    this.#onRevealStart = onRevealStart;
    this.#onReady = onReady;
    this.#state = {
      width: 0,
      height: 0,
      dpr: 1,
      particles: [],
      startedAt: performance.now(),
      lastTime: performance.now(),
      revealing: false,
      ready: false,
      settled: false,
      opening: false,
    };
    this.#reduceMotion = prefersReducedMotion();
    this.#maxExplodeTailMs = this.#config.trailMs + 1600;
    this.#cursor = new CursorEffect({
      context: this.#context,
      config,
      theme,
      clearField: () => this.clear(),
      getStatus: () => ({
        opening: this.#state.opening,
        settled: this.#state.settled,
      }),
    });
  }

  get isReady() {
    return this.#state.ready;
  }

  resize(width, height, dpr) {
    if (this.#disposed) {
      return;
    }

    const previousWidth = this.#state.width;
    const previousHeight = this.#state.height;

    this.#state.width = width;
    this.#state.height = height;
    this.#state.dpr = dpr;
    resizeCanvasLayer(this.#canvas, this.#context, width, height, dpr);
    this.clear();

    if (this.#state.particles.length === 0 || previousWidth === 0 || previousHeight === 0) {
      this.#resetParticles();
      return;
    }

    this.#rescaleParticles(previousWidth, previousHeight, width, height);
  }

  dispose() {
    this.#disposed = true;
    this.#cursor.clear();
    this.#state.particles = [];
    this.#canvas.width = 0;
    this.#canvas.height = 0;
  }

  start() {
    requestAnimationFrame((now) => {
      this.#state.startedAt = now;
      this.#state.lastTime = now;
      this.#animate(now);
    });
  }

  stopForOpening() {
    this.#state.opening = true;
    this.#cursor.clear();
    this.clear();
  }

  shiftTime(milliseconds) {
    this.#state.startedAt += milliseconds;
    this.#state.lastTime = performance.now();
    this.#cursor.shiftTime();
  }

  handlePointerMove(event) {
    this.#cursor.handlePointerMove(event);
  }

  handlePointerLeave() {
    this.#cursor.handlePointerLeave();
  }

  clear() {
    fillCanvas(this.#context, this.#state.width, this.#state.height, this.#theme.pageBg);
  }

  #resetParticles() {
    const count = Math.min(
      this.#config.particleCount,
      Math.max(10, Math.floor(this.#state.width / 82))
    );

    this.#state.particles = Array.from({ length: count }, () => this.#makeParticle());
  }

  #rescaleParticles(previousWidth, previousHeight, width, height) {
    const scaleX = width / previousWidth;
    const scaleY = height / previousHeight;

    for (const particle of this.#state.particles) {
      particle.x *= scaleX;
      particle.y *= scaleY;
    }
  }

  #makeParticle() {
    const position = {
      x: randomBetween(0, this.#state.width),
      y: randomBetween(0, this.#state.height),
    };
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(32, 68);

    return {
      x: position.x,
      y: position.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      seed: randomBetween(0, Math.PI * 2),
      size: randomBetween(3, 5),
      color: this.#theme.mainColor,
      chaos: randomBetween(0.7, 1.35),
      magneticSpin: Math.random() < 0.5 ? -1 : 1,
      nucleusRadius: randomBetween(24, 70),
      nucleusAngle: randomBetween(0, Math.PI * 2),
      nucleusSpeed: randomBetween(4.8, 9.5),
      wobble: randomBetween(12, 35),
      exploded: false,
      trail: [],
      lastTrailAt: 0,
    };
  }

  #animate(now) {
    if (this.#state.opening) {
      return;
    }

    const delta = Math.min((now - this.#state.lastTime) / 1000, 0.033);
    const elapsed = now - this.#state.startedAt;
    const explodeStart = this.#config.warmupMs + this.#config.gatherMs + this.#config.collideMs;
    this.#state.lastTime = now;
    this.clear();

    for (const particle of this.#state.particles) {
      this.#updateParticle(particle, elapsed, delta);
      this.#rememberTrail(particle, now);
      this.#drawParticleTrail(particle, now);
      this.#drawParticle(particle, elapsed);
    }

    this.#cursor.updateAndDraw(now, delta);

    if (elapsed > explodeStart) {
      this.#beginTitleReveal();
    }

    if (elapsed > explodeStart + this.#config.explodeMs) {
      this.#markReady();
    }

    if (this.#state.ready) {
      const tail = elapsed - explodeStart - this.#config.explodeMs;

      if (this.#reduceMotion || tail > this.#maxExplodeTailMs || this.#fieldIsEmpty()) {
        this.#settle();
        return;
      }
    }

    requestAnimationFrame((nextNow) => this.#animate(nextNow));
  }

  #updateParticle(particle, elapsed, delta) {
    const centerX = this.#state.width / 2;
    const centerY = this.#state.height / 2;
    const gatherStart = this.#config.warmupMs;
    const collideStart = this.#config.warmupMs + this.#config.gatherMs;
    const explodeStart = collideStart + this.#config.collideMs;
    const driftX = Math.sin(elapsed * 0.0022 + particle.seed) * 14;
    const driftY = Math.cos(elapsed * 0.0019 + particle.seed) * 12;

    if (elapsed < gatherStart) {
      this.#moveDriftingParticle(particle, delta, driftX, driftY);
      return;
    }

    const dx = centerX - particle.x;
    const dy = centerY - particle.y;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const normalX = dx / distance;
    const normalY = dy / distance;
    const tangentX = -normalY * particle.magneticSpin;
    const tangentY = normalX * particle.magneticSpin;

    if (elapsed < collideStart) {
      this.#moveGatheringParticle({
        particle,
        elapsed,
        delta,
        collideStart,
        distance,
        normalX,
        normalY,
        tangentX,
        tangentY,
      });
      return;
    }

    if (elapsed >= explodeStart) {
      this.#moveExplodingParticle(particle, delta, centerX, centerY);
      return;
    }

    this.#moveOrbitingParticle(particle, elapsed, delta, centerX, centerY, collideStart);
  }

  #moveDriftingParticle(particle, delta, driftX, driftY) {
    const margin = 16;

    particle.x += (particle.vx + driftX) * delta;
    particle.y += (particle.vy + driftY) * delta;

    if (particle.x < -margin) particle.x = this.#state.width + margin;
    if (particle.x > this.#state.width + margin) particle.x = -margin;
    if (particle.y < -margin) particle.y = this.#state.height + margin;
    if (particle.y > this.#state.height + margin) particle.y = -margin;
  }

  #moveGatheringParticle({
    particle,
    elapsed,
    delta,
    collideStart,
    distance,
    normalX,
    normalY,
    tangentX,
    tangentY,
  }) {
    const progress = (elapsed - this.#config.warmupMs) / this.#config.gatherMs;
    const eased = easeInOutSine(progress);
    const remaining = Math.max((collideStart - elapsed) / 1000, 0.35);
    const radialSpeed = Math.max(130, ((distance - 30) / remaining) * 1.18);
    const swirlSpeed =
      (65 + 90 * (1 - eased) + 45 * Math.sin(progress * Math.PI)) *
      particle.chaos *
      (0.75 + Math.sin(elapsed * 0.003 + particle.seed) * 0.25);
    const desiredVx = normalX * radialSpeed + tangentX * swirlSpeed;
    const desiredVy = normalY * radialSpeed + tangentY * swirlSpeed;
    const steer = 2.8 + eased * 4.2;

    particle.vx += (desiredVx - particle.vx) * Math.min(1, steer * delta);
    particle.vy += (desiredVy - particle.vy) * Math.min(1, steer * delta);
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
  }

  #moveExplodingParticle(particle, delta, centerX, centerY) {
    if (!particle.exploded) {
      const outwardAngle =
        Math.atan2(particle.y - centerY, particle.x - centerX) + randomBetween(-0.55, 0.55);
      const explodeSpeed = randomBetween(700, 1150) * particle.chaos;

      particle.vx = Math.cos(outwardAngle) * explodeSpeed;
      particle.vy = Math.sin(outwardAngle) * explodeSpeed;
      particle.exploded = true;
    }

    const accel = 1 + 1.8 * delta;
    particle.vx *= accel;
    particle.vy *= accel;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
  }

  #moveOrbitingParticle(particle, elapsed, delta, centerX, centerY, collideStart) {
    const collideProgress = Math.min((elapsed - collideStart) / this.#config.collideMs, 1);
    const eased = easeInOutCubic(collideProgress);
    const acceleration = easeInOutSine(collideProgress);
    const nucleusPull = (180 + acceleration * 860) * particle.chaos;
    const angularPull =
      (45 + acceleration * 280 + Math.sin(elapsed * 0.006 + particle.seed) * 90 * acceleration) *
      particle.chaos;
    const targetAngle =
      particle.nucleusAngle +
      collideProgress * particle.nucleusSpeed * particle.magneticSpin +
      Math.sin(collideProgress * 18 + particle.seed) * 0.9;
    const radius =
      particle.nucleusRadius * (1 - eased * 0.45) +
      Math.sin(collideProgress * 24 + particle.seed) * particle.wobble * (1 - eased * 0.25);
    const targetX = centerX + Math.cos(targetAngle) * radius;
    const targetY = centerY + Math.sin(targetAngle) * radius;
    const targetDx = targetX - particle.x;
    const targetDy = targetY - particle.y;
    const targetDistance = Math.max(Math.hypot(targetDx, targetDy), 1);
    const targetNormalX = targetDx / targetDistance;
    const targetNormalY = targetDy / targetDistance;
    const targetTangentX = -targetNormalY * particle.magneticSpin;
    const targetTangentY = targetNormalX * particle.magneticSpin;
    const targetSpeed = Math.min(targetDistance * (8 + acceleration * 16), nucleusPull * 1.7);
    const desiredVx = targetNormalX * targetSpeed + targetTangentX * angularPull;
    const desiredVy = targetNormalY * targetSpeed + targetTangentY * angularPull;
    const steer = 3.2 + acceleration * 8.8;

    particle.vx += (desiredVx - particle.vx) * Math.min(1, steer * delta);
    particle.vy += (desiredVy - particle.vy) * Math.min(1, steer * delta);
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
  }

  #rememberTrail(particle, now) {
    if (now - particle.lastTrailAt < this.#config.trailEveryMs) {
      return;
    }

    if (!this.#isOnScreen(particle.x, particle.y, 0)) {
      return;
    }

    particle.lastTrailAt = now;
    particle.trail.push({
      x: particle.x,
      y: particle.y,
      size: particle.size * 0.72,
      createdAt: now,
    });
  }

  #drawParticleTrail(particle, now) {
    this.#context.fillStyle = particle.color;
    particle.trail = particle.trail.filter((trailPoint) => {
      const age = now - trailPoint.createdAt;

      if (age > this.#config.trailMs) {
        return false;
      }

      this.#context.globalAlpha = (1 - age / this.#config.trailMs) * 0.26;
      drawPixelDiamond(this.#context, trailPoint.x, trailPoint.y, trailPoint.size);
      return true;
    });

    this.#context.globalAlpha = 1;
  }

  #drawParticle(particle, elapsed) {
    const blink = 0.75 + Math.sin(elapsed * 0.008 + particle.seed) * 0.25;

    this.#context.globalAlpha = blink;
    this.#context.fillStyle = particle.color;
    drawPixelDiamond(this.#context, particle.x, particle.y, particle.size);
    this.#context.globalAlpha = 1;
  }

  #beginTitleReveal() {
    if (this.#state.revealing) {
      return;
    }

    this.#state.revealing = true;
    this.#onRevealStart();
  }

  #markReady() {
    if (this.#state.ready) {
      return;
    }

    this.#state.ready = true;
    this.#onReady();
  }

  #settle() {
    if (this.#state.settled) {
      return;
    }

    this.#state.settled = true;
    this.clear();
  }

  #isOnScreen(x, y, margin) {
    return (
      x >= -margin &&
      x <= this.#state.width + margin &&
      y >= -margin &&
      y <= this.#state.height + margin
    );
  }

  #fieldIsEmpty() {
    for (const particle of this.#state.particles) {
      if (this.#isOnScreen(particle.x, particle.y, this.#exitMargin)) {
        return false;
      }

      for (const point of particle.trail) {
        if (this.#isOnScreen(point.x, point.y, this.#exitMargin)) {
          return false;
        }
      }
    }

    return true;
  }

}
