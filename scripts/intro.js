(() => {
  const INTRO = {
    mainText: "click to start",
    subText: "or choose another theme",
    particleCount: 20,
    warmupMs: 2600,
    gatherMs: 2300,
    collideMs: 1450,
    explodeMs: 650,
    trailMs: 850,
    trailEveryMs: 250,
    cursorParticleLifeMs: 520,
    cursorParticleMax: 36,
    cursorSpawnEveryMs: 34,
    cursorActiveMs: 140,
    maxDevicePixelRatio: 2,
  };

  const HOME_SEQUENCE = {
    circleFillDelayMs: 430,
    letterSwallowDelayMs: 850,
    introExitMs: 1850,
    tipChangeMs: 950,
    tipFadeOutMs: 2300,
    dropStartMs: 2700,
    dotShrinkMs: 320,
    dropMorphAfterFallMs: 110,
    dropFallMs: 1120,
    dropHideMs: 55,
    blackWipeMs: 980,
  };

  const START_PAGES = [
    {
      name: "ember",
      pageBg: "#0d090a",
      mainColor: "#e84d36",
      textOnMain: "#050505",
    },
    {
      name: "moss",
      pageBg: "#07110c",
      mainColor: "#62d383",
      textOnMain: "#050505",
    },
    {
      name: "glacier",
      pageBg: "#071015",
      mainColor: "#69d7ef",
      textOnMain: "#050505",
    },
    {
      name: "sunset",
      pageBg: "#150b0f",
      mainColor: "#ff9f5a",
      textOnMain: "#050505",
    },
  ];

  const intro = document.querySelector("#intro");
  const title = document.querySelector("#mainTitle");
  const titleText = document.querySelector("#mainTitleText");
  const titleSubtext = document.querySelector("#mainTitleSubtext");
  const arrivalTip = document.querySelector("#arrivalTip");
  const arrivalSpinner = document.querySelector(".arrival-spinner");
  const arrivalDrop = document.querySelector(".arrival-drop");
  const hitTarget = document.querySelector("#introHitTarget");
  const canvas = document.querySelector("#particleField");
  const context = canvas.getContext("2d", { alpha: false });
  const startPage = chooseStartPage();

  applyStartPage(startPage);

  const theme = readTheme();
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    particles: [],
    cursorParticles: [],
    cursorX: 0,
    cursorY: 0,
    cursorActive: false,
    cursorVisible: false,
    cursorFrame: 0,
    cursorLastMoveAt: 0,
    cursorLastSpawnAt: 0,
    cursorLastTime: performance.now(),
    dropFillFrame: 0,
    startedAt: performance.now(),
    lastTime: performance.now(),
    hiddenAt: 0,
    revealing: false,
    ready: false,
    settled: false,
    opening: false,
    completed: false,
    pausedAnimations: [],
  };
  const timers = new Map();

  renderTitleText(INTRO.mainText);
  titleSubtext.textContent = INTRO.subText;

  function chooseStartPage() {
    const index = Math.floor(Math.random() * START_PAGES.length);

    return START_PAGES[index];
  }

  function applyStartPage(page) {
    const root = document.documentElement;

    root.style.setProperty("--page-bg", page.pageBg);
    root.style.setProperty("--main-color", page.mainColor);
    root.style.setProperty("--text-on-main", page.textOnMain);
    root.dataset.startPage = page.name;
  }

  function readTheme() {
    const styles = getComputedStyle(document.documentElement);

    return {
      pageBg: styles.getPropertyValue("--page-bg").trim(),
      mainColor: styles.getPropertyValue("--main-color").trim(),
    };
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function renderTitleText(text) {
    titleText.textContent = "";

    for (const character of text) {
      const letter = document.createElement("span");
      letter.className = "main-title-letter";
      letter.textContent = character === " " ? "\u00a0" : character;

      if (character === " ") {
        letter.classList.add("is-space");
      }

      titleText.append(letter);
    }
  }

  function easeInOutCubic(progress) {
    return progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - ((-2 * progress + 2) ** 3) / 2;
  }

  function easeInOutSine(progress) {
    return -(Math.cos(Math.PI * progress) - 1) / 2;
  }

  function chooseStartPosition() {
    return {
      x: randomBetween(0, state.width),
      y: randomBetween(0, state.height),
    };
  }

  function makeParticle() {
    const position = chooseStartPosition();
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(32, 68);

    return {
      x: position.x,
      y: position.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      seed: randomBetween(0, Math.PI * 2),
      size: randomBetween(3, 5),
      color: theme.mainColor,
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

  function resizeCanvas() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, INTRO.maxDevicePixelRatio);

    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;

    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    context.fillStyle = theme.pageBg;
    context.fillRect(0, 0, state.width, state.height);
  }

  function clearParticleField() {
    context.fillStyle = theme.pageBg;
    context.fillRect(0, 0, state.width, state.height);
  }

  function resetParticles() {
    const count = Math.min(INTRO.particleCount, Math.max(10, Math.floor(state.width / 82)));
    state.particles = Array.from({ length: count }, makeParticle);
  }

  function drawPixelDiamond(x, y, size) {
    const pixel = Math.max(2, Math.round(size));
    const left = Math.round(x - pixel / 2);
    const top = Math.round(y - pixel / 2);

    context.fillRect(left, top - pixel, pixel, pixel);
    context.fillRect(left - pixel, top, pixel, pixel);
    context.fillRect(left, top, pixel, pixel);
    context.fillRect(left + pixel, top, pixel, pixel);
    context.fillRect(left, top + pixel, pixel, pixel);
  }

  function rememberTrail(particle, now) {
    if (now - particle.lastTrailAt < INTRO.trailEveryMs) {
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

  function drawParticleTrail(particle, now) {
    context.fillStyle = particle.color;
    particle.trail = particle.trail.filter((trailPoint) => {
      const age = now - trailPoint.createdAt;

      if (age > INTRO.trailMs) {
        return false;
      }

      context.globalAlpha = (1 - age / INTRO.trailMs) * 0.26;
      drawPixelDiamond(trailPoint.x, trailPoint.y, trailPoint.size);
      return true;
    });

    context.globalAlpha = 1;
  }

  function drawParticle(particle, elapsed) {
    const blink = 0.75 + Math.sin(elapsed * 0.008 + particle.seed) * 0.25;

    context.globalAlpha = blink;
    context.fillStyle = particle.color;
    drawPixelDiamond(particle.x, particle.y, particle.size);
    context.globalAlpha = 1;
  }

  function spawnCursorParticle(now) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(8, 28);

    state.cursorParticles.push({
      x: state.cursorX + randomBetween(-3, 3),
      y: state.cursorY + randomBetween(-3, 3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      seed: randomBetween(0, Math.PI * 2),
      size: randomBetween(2.8, 4.4),
      color: theme.mainColor,
      createdAt: now,
    });

    if (state.cursorParticles.length > INTRO.cursorParticleMax) {
      state.cursorParticles.splice(0, state.cursorParticles.length - INTRO.cursorParticleMax);
    }
  }

  function updateCursorParticles(now, delta) {
    if (now - state.cursorLastMoveAt > INTRO.cursorActiveMs) {
      state.cursorActive = false;
    }

    if (
      state.cursorActive &&
      !state.opening &&
      now - state.cursorLastSpawnAt >= INTRO.cursorSpawnEveryMs
    ) {
      state.cursorLastSpawnAt = now;
      spawnCursorParticle(now);
    }

    state.cursorParticles = state.cursorParticles.filter((particle) => {
      const age = now - particle.createdAt;

      if (age > INTRO.cursorParticleLifeMs) {
        return false;
      }

      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= 0.985;
      particle.vy *= 0.985;

      return true;
    });
  }

  function drawCursorParticles(now) {
    for (const particle of state.cursorParticles) {
      const age = now - particle.createdAt;
      const life = Math.max(0, 1 - age / INTRO.cursorParticleLifeMs);
      const blink = 0.72 + Math.sin(now * 0.012 + particle.seed) * 0.28;

      context.globalAlpha = life * blink;
      context.fillStyle = particle.color;
      drawPixelDiamond(particle.x, particle.y, particle.size);
    }

    if (state.cursorVisible && !state.opening) {
      const blink = 0.78 + Math.sin(now * 0.01) * 0.22;

      context.globalAlpha = blink;
      context.fillStyle = theme.mainColor;
      drawPixelDiamond(state.cursorX, state.cursorY, 4.4);
    }

    context.globalAlpha = 1;
  }

  function clearCursorParticles() {
    state.cursorActive = false;
    state.cursorVisible = false;
    state.cursorParticles = [];
  }

  function updateParticle(particle, elapsed, delta) {
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    const gatherStart = INTRO.warmupMs;
    const collideStart = INTRO.warmupMs + INTRO.gatherMs;
    const explodeStart = collideStart + INTRO.collideMs;
    const driftX = Math.sin(elapsed * 0.0022 + particle.seed) * 14;
    const driftY = Math.cos(elapsed * 0.0019 + particle.seed) * 12;

    if (elapsed < gatherStart) {
      const margin = 16;

      particle.x += (particle.vx + driftX) * delta;
      particle.y += (particle.vy + driftY) * delta;

      if (particle.x < -margin) particle.x = state.width + margin;
      if (particle.x > state.width + margin) particle.x = -margin;
      if (particle.y < -margin) particle.y = state.height + margin;
      if (particle.y > state.height + margin) particle.y = -margin;

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
      const progress = (elapsed - gatherStart) / INTRO.gatherMs;
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
      return;
    }

    if (elapsed >= explodeStart) {
      if (!particle.exploded) {
        const outwardAngle =
          Math.atan2(particle.y - centerY, particle.x - centerX) +
          randomBetween(-0.55, 0.55);
        const explodeSpeed = randomBetween(650, 1080) * particle.chaos;

        particle.vx = Math.cos(outwardAngle) * explodeSpeed;
        particle.vy = Math.sin(outwardAngle) * explodeSpeed;
        particle.exploded = true;
      }

      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      return;
    }

    const collideProgress = Math.min((elapsed - collideStart) / INTRO.collideMs, 1);
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

  function beginTitleReveal() {
    if (state.revealing) {
      return;
    }

    state.revealing = true;
    title.classList.add("is-revealing");
  }

  function revealTitle() {
    if (state.ready) {
      return;
    }

    state.ready = true;
    state.settled = true;
    clearParticleField();
    intro.classList.add("is-ready");
    title.classList.add("is-ready");
  }

  function animate(now) {
    if (state.opening) {
      return;
    }

    const delta = Math.min((now - state.lastTime) / 1000, 0.033);
    const elapsed = now - state.startedAt;
    state.lastTime = now;
    const explodeStart = INTRO.warmupMs + INTRO.gatherMs + INTRO.collideMs;

    context.fillStyle = theme.pageBg;
    context.fillRect(0, 0, state.width, state.height);

    for (const particle of state.particles) {
      updateParticle(particle, elapsed, delta);
      rememberTrail(particle, now);
      drawParticleTrail(particle, now);
      drawParticle(particle, elapsed);
    }

    updateCursorParticles(now, delta);
    drawCursorParticles(now);

    if (elapsed > explodeStart) {
      beginTitleReveal();
    }

    if (elapsed > INTRO.warmupMs + INTRO.gatherMs + INTRO.collideMs + INTRO.explodeMs) {
      revealTitle();
    }

    if (state.settled) {
      return;
    }

    requestAnimationFrame(animate);
  }

  function openHome() {
    if (state.opening || !state.ready) {
      return;
    }

    state.opening = true;
    clearCursorParticles();
    clearParticleField();
    prepareLetterBurst();
    requestAnimationFrame(() => {
      intro.classList.add("is-opening");
    });

    setSequenceTimer("introExit", () => {
      intro.classList.add("is-filled");
      document.body.classList.add("site-open");
      intro.classList.add("is-done");
      intro.setAttribute("aria-hidden", "true");
      setSequenceTimer("tipChange", showSecondArrivalTip, HOME_SEQUENCE.tipChangeMs);
      setSequenceTimer("tipFadeOut", hideArrivalTip, HOME_SEQUENCE.tipFadeOutMs);
      setSequenceTimer("dropStart", startWaterDrop, HOME_SEQUENCE.dropStartMs);
    }, HOME_SEQUENCE.introExitMs);
  }

  function setSequenceTimer(name, callback, delay) {
    clearSequenceTimer(name);

    timers.set(name, {
      callback,
      id: 0,
      remaining: delay,
      startedAt: 0,
    });
    resumeSequenceTimer(name);
  }

  function clearSequenceTimer(name) {
    const timer = timers.get(name);

    if (!timer) {
      return;
    }

    window.clearTimeout(timer.id);
    timers.delete(name);
  }

  function pauseSequenceTimers() {
    const now = performance.now();

    for (const timer of timers.values()) {
      if (timer.id === 0) {
        continue;
      }

      window.clearTimeout(timer.id);
      timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
      timer.id = 0;
    }
  }

  function resumeSequenceTimers() {
    for (const name of timers.keys()) {
      resumeSequenceTimer(name);
    }
  }

  function resumeSequenceTimer(name) {
    const timer = timers.get(name);

    if (!timer || timer.id !== 0) {
      return;
    }

    timer.startedAt = performance.now();
    timer.id = window.setTimeout(() => {
      timers.delete(name);
      timer.callback();
    }, timer.remaining);
  }

  function pauseVisualAnimations() {
    if (typeof document.getAnimations !== "function") {
      return;
    }

    state.pausedAnimations = document
      .getAnimations()
      .filter((animation) => animation.playState === "running");

    for (const animation of state.pausedAnimations) {
      animation.pause();
    }
  }

  function resumeVisualAnimations() {
    for (const animation of state.pausedAnimations) {
      animation.play();
    }

    state.pausedAnimations = [];
  }

  function showSecondArrivalTip() {
    arrivalTip.classList.add("is-changing");

    setSequenceTimer("tipSwap", () => {
      arrivalTip.textContent = "have fun";
      arrivalTip.classList.remove("is-changing");
    }, 460);
  }

  function hideArrivalTip() {
    arrivalTip.classList.add("is-exiting");
  }

  function startWaterDrop() {
    document.body.classList.add("site-dot-ready");

    setSequenceTimer("dropFall", () => {
      setDropFallMotion();
      document.body.classList.add("site-drop-falling");
      setSequenceTimer("dropMorph", () => {
        document.body.classList.add("site-drop-ready");
      }, HOME_SEQUENCE.dropMorphAfterFallMs);
      state.dropFillFrame = requestAnimationFrame(watchDropFillLine);
    }, HOME_SEQUENCE.dotShrinkMs);
  }

  function prepareLetterBurst() {
    const oldFills = intro.querySelectorAll(".letter-fill");

    for (const fill of oldFills) {
      fill.remove();
    }

    const letters = Array.from(titleText.querySelectorAll(".main-title-letter"));
    const activeLetters = letters.filter((letter) => !letter.classList.contains("is-space"));
    const targets = createBurstTargets(activeLetters.length);

    activeLetters.forEach((letter, index) => {
      const rect = letter.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const target = targets[index];
      const targetX = target.x;
      const targetY = target.y;
      const delay = index * 18;
      const fadeDelay =
        HOME_SEQUENCE.circleFillDelayMs + HOME_SEQUENCE.letterSwallowDelayMs + delay;

      letter.style.setProperty("--letter-x", `${targetX - startX}px`);
      letter.style.setProperty("--letter-y", `${targetY - startY}px`);
      letter.style.setProperty("--letter-rotation", `${randomBetween(-36, 36)}deg`);
      letter.style.setProperty("--letter-scale", randomBetween(0.85, 1.15).toFixed(2));
      letter.style.setProperty("--letter-delay", `${delay}ms`);
      letter.style.setProperty("--letter-fade-delay", `${fadeDelay}ms`);

      intro.append(createLetterFill(targetX, targetY, HOME_SEQUENCE.circleFillDelayMs + delay));
    });
  }

  function createBurstTargets(count) {
    if (count === 0) {
      return [];
    }

    const aspectRatio = state.height > 0 ? state.width / state.height : 1;
    const columns = Math.max(1, Math.ceil(Math.sqrt(count * aspectRatio)));
    const rows = Math.max(1, Math.ceil(count / columns));
    const margin = Math.max(34, Math.min(state.width, state.height) * 0.08);
    const usableWidth = Math.max(state.width - margin * 2, columns);
    const usableHeight = Math.max(state.height - margin * 2, rows);
    const cellWidth = usableWidth / columns;
    const cellHeight = usableHeight / rows;
    const targets = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        targets.push({
          x: margin + cellWidth * (column + randomBetween(0.18, 0.82)),
          y: margin + cellHeight * (row + randomBetween(0.18, 0.82)),
        });
      }
    }

    return shuffle(targets).slice(0, count);
  }

  function shuffle(items) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const item = shuffled[index];

      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = item;
    }

    return shuffled;
  }

  function createLetterFill(x, y, delay) {
    const fill = document.createElement("span");
    fill.className = "letter-fill";
    fill.setAttribute("aria-hidden", "true");
    fill.style.setProperty("--fill-x", `${x}px`);
    fill.style.setProperty("--fill-y", `${y}px`);
    fill.style.setProperty("--fill-delay", `${delay}ms`);

    return fill;
  }

  function startFinalTransition(origin = getLiveDropContactPoint()) {
    if (state.completed) {
      return;
    }

    setFinalFillOrigin(origin);
    document.body.classList.add("site-finalizing");
    setSequenceTimer("dropHide", () => {
      document.body.classList.add("site-drop-hidden");
    }, HOME_SEQUENCE.dropHideMs);

    setSequenceTimer("finalDone", () => {
      state.completed = true;
      document.body.classList.add("site-final");
    }, HOME_SEQUENCE.blackWipeMs);
  }

  function setFinalFillOrigin(origin) {
    const root = document.documentElement;

    root.style.setProperty("--final-fill-x", `${origin.x}px`);
    root.style.setProperty("--final-fill-y", `${origin.y}px`);
  }

  function setDropFallMotion() {
    const fillLineY = window.innerHeight * 0.8;
    const dropRect = arrivalDrop.getBoundingClientRect();
    const distanceToFillLine = Math.max(0, fillLineY - dropRect.bottom);
    const fallDistance = Math.max(
      distanceToFillLine + window.innerHeight * 0.35,
      window.innerHeight - dropRect.top + dropRect.height
    );

    arrivalSpinner.style.setProperty("--drop-fall-ms", `${HOME_SEQUENCE.dropFallMs}ms`);
    arrivalSpinner.style.setProperty("--drop-fall-y", `${fallDistance}px`);
  }

  function watchDropFillLine() {
    state.dropFillFrame = 0;

    if (state.completed) {
      return;
    }

    const fillLineY = window.innerHeight * 0.8;
    const dropOrigin = getLiveDropContactPoint();

    if (document.body.classList.contains("site-drop-ready") && dropOrigin.y >= fillLineY) {
      startFinalTransition({
        x: dropOrigin.x,
        y: fillLineY + getRenderedDropSize(),
      });
      return;
    }

    state.dropFillFrame = requestAnimationFrame(watchDropFillLine);
  }

  function getLiveDropContactPoint() {
    const rect = arrivalDrop.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    };
  }

  function getRenderedDropSize() {
    const rect = arrivalDrop.getBoundingClientRect();

    return rect.height;
  }

  function requestCursorFrame() {
    if (state.cursorFrame !== 0 || state.opening || !state.settled) {
      return;
    }

    state.cursorLastTime = performance.now();
    state.cursorFrame = requestAnimationFrame(animateCursor);
  }

  function animateCursor(now) {
    state.cursorFrame = 0;

    if (state.opening || !state.settled) {
      return;
    }

    const delta = Math.min((now - state.cursorLastTime) / 1000, 0.033);
    state.cursorLastTime = now;

    clearParticleField();
    updateCursorParticles(now, delta);
    drawCursorParticles(now);

    if (state.cursorActive || state.cursorParticles.length > 0) {
      requestCursorFrame();
    }
  }

  function handlePointerMove(event) {
    if (state.opening || state.completed) {
      return;
    }

    state.cursorX = event.clientX;
    state.cursorY = event.clientY;
    state.cursorActive = true;
    state.cursorVisible = true;
    state.cursorLastMoveAt = performance.now();

    if (state.settled) {
      requestCursorFrame();
    }
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    resetParticles();
  });

  document.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.addEventListener(
    "pointerleave",
    () => {
      state.cursorActive = false;
      state.cursorVisible = false;

      if (state.settled && !state.opening) {
        clearParticleField();
      }
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      state.hiddenAt = performance.now();
      pauseSequenceTimers();
      pauseVisualAnimations();
      return;
    }

    if (state.hiddenAt !== 0) {
      const pausedFor = performance.now() - state.hiddenAt;

      state.startedAt += pausedFor;
      state.lastTime = performance.now();
      state.hiddenAt = 0;
    }

    resumeVisualAnimations();
    resumeSequenceTimers();
  });

  title.addEventListener("click", openHome);
  hitTarget.addEventListener("click", openHome);
  hitTarget.addEventListener("pointerdown", openHome);
  hitTarget.addEventListener("mousedown", openHome);
  hitTarget.addEventListener("touchstart", openHome);

  resizeCanvas();
  resetParticles();

  requestAnimationFrame(() => {
    intro.classList.add("is-visible");
    requestAnimationFrame(animate);
  });
})();
