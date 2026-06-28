import { clearCanvas, resizeCanvasLayer } from "../../lib/canvas.js";
import { easeInOutCubic, randomBetween, shuffle } from "../../lib/math.js";

export class TitleBurst {
  #canvas;
  #context;
  #config;
  #theme;
  #titleText;
  #disposed = false;
  #state = {
    width: 0,
    height: 0,
    circles: [],
    frame: 0,
    startedAt: 0,
  };

  constructor({ canvas, config, theme, titleText }) {
    this.#canvas = canvas;
    this.#context = canvas.getContext("2d");
    this.#config = config;
    this.#theme = theme;
    this.#titleText = titleText;
  }

  resize(width, height, dpr) {
    if (this.#disposed) {
      return;
    }

    this.#state.width = width;
    this.#state.height = height;
    resizeCanvasLayer(this.#canvas, this.#context, width, height, dpr);
    this.clear();
  }

  dispose() {
    this.#disposed = true;
    this.#state.circles = [];
    this.#canvas.width = 0;
    this.#canvas.height = 0;
  }

  prepare() {
    const letters = Array.from(this.#titleText.querySelectorAll(".main-title-letter"));
    const activeLetters = letters.filter((letter) => !letter.classList.contains("is-space"));
    const targets = this.#createBurstTargets(activeLetters.length);

    this.#state.circles = [];
    this.clear();

    activeLetters.forEach((letter, index) => {
      const rect = letter.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const target = targets[index];
      const delay = index * 18;
      const fadeDelay =
        this.#config.circleFillDelayMs + this.#config.letterSwallowDelayMs + delay;

      letter.style.setProperty("--letter-x", `${target.x - startX}px`);
      letter.style.setProperty("--letter-y", `${target.y - startY}px`);
      letter.style.setProperty("--letter-rotation", `${randomBetween(-36, 36)}deg`);
      letter.style.setProperty("--letter-scale", randomBetween(0.85, 1.15).toFixed(2));
      letter.style.setProperty("--letter-delay", `${delay}ms`);
      letter.style.setProperty("--letter-fade-delay", `${fadeDelay}ms`);

      this.#state.circles.push({
        x: target.x,
        y: target.y,
        delay: this.#config.circleFillDelayMs + delay,
        radius: this.#getViewportCoverRadius(target.x, target.y),
      });
    });
  }

  start() {
    if (this.#state.frame !== 0) {
      cancelAnimationFrame(this.#state.frame);
    }

    this.#state.startedAt = performance.now();
    this.#state.frame = requestAnimationFrame((now) => this.#draw(now));
  }

  stop() {
    if (this.#state.frame !== 0) {
      cancelAnimationFrame(this.#state.frame);
      this.#state.frame = 0;
    }

    this.clear();
  }

  clear() {
    clearCanvas(this.#context, this.#state.width, this.#state.height);
  }

  shiftTime(milliseconds) {
    if (this.#state.startedAt !== 0) {
      this.#state.startedAt += milliseconds;
    }
  }

  #draw(now) {
    this.#state.frame = 0;
    this.clear();

    let isComplete = true;
    this.#context.fillStyle = this.#theme.mainColor;

    for (const circle of this.#state.circles) {
      const progress = (now - this.#state.startedAt - circle.delay) / this.#config.circleFillMs;

      if (progress <= 0) {
        isComplete = false;
        continue;
      }

      const clampedProgress = Math.min(progress, 1);
      const radius = circle.radius * easeInOutCubic(clampedProgress);

      this.#context.beginPath();
      this.#context.arc(circle.x, circle.y, radius, 0, Math.PI * 2);
      this.#context.fill();

      if (clampedProgress < 1) {
        isComplete = false;
      }
    }

    if (!isComplete) {
      this.#state.frame = requestAnimationFrame((nextNow) => this.#draw(nextNow));
    }
  }

  #createBurstTargets(count) {
    if (count === 0) {
      return [];
    }

    const aspectRatio = this.#state.height > 0 ? this.#state.width / this.#state.height : 1;
    const columns = Math.max(1, Math.ceil(Math.sqrt(count * aspectRatio)));
    const rows = Math.max(1, Math.ceil(count / columns));
    const margin = Math.max(34, Math.min(this.#state.width, this.#state.height) * 0.08);
    const usableWidth = Math.max(this.#state.width - margin * 2, columns);
    const usableHeight = Math.max(this.#state.height - margin * 2, rows);
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

  #getViewportCoverRadius(x, y) {
    return Math.max(
      Math.hypot(x, y),
      Math.hypot(this.#state.width - x, y),
      Math.hypot(x, this.#state.height - y),
      Math.hypot(this.#state.width - x, this.#state.height - y)
    );
  }
}
