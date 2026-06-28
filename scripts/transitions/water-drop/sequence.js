export class WaterDropSequence {
  #config;
  #timers;
  #root;
  #tip;
  #spinner;
  #drop;
  #onComplete;
  #state = {
    completed: false,
    dropFillFrame: 0,
  };

  constructor({ config, timers, root, tip, spinner, drop, onComplete }) {
    this.#config = config;
    this.#timers = timers;
    this.#root = root;
    this.#tip = tip;
    this.#spinner = spinner;
    this.#drop = drop;
    this.#onComplete = onComplete;
  }

  start() {
    this.#timers.set("tipChange", () => this.#showSecondTip(), this.#config.tipChangeMs);
    this.#timers.set("tipFadeOut", () => this.#hideTip(), this.#config.tipFadeOutMs);
    this.#timers.set("dropStart", () => this.#startWaterDrop(), this.#config.dropStartMs);
  }

  dispose() {
    if (this.#state.dropFillFrame !== 0) {
      cancelAnimationFrame(this.#state.dropFillFrame);
      this.#state.dropFillFrame = 0;
    }

    this.#timers.clearAll();
    this.#state.completed = true;
  }

  #showSecondTip() {
    this.#tip.classList.add("is-changing");

    this.#timers.set("tipSwap", () => {
      this.#tip.textContent = this.#config.secondTip;
      this.#tip.classList.remove("is-changing");
    }, this.#config.tipSwapMs);
  }

  #hideTip() {
    this.#tip.classList.add("is-exiting");
  }

  #startWaterDrop() {
    this.#root.classList.add("dot-ready");

    this.#timers.set("dropFall", () => {
      this.#setDropFallMotion();
      this.#root.classList.add("drop-falling");
      this.#timers.set("dropMorph", () => {
        this.#root.classList.add("drop-ready");
      }, this.#config.dropMorphAfterFallMs);
      this.#state.dropFillFrame = requestAnimationFrame(() => this.#watchDropFillLine());
    }, this.#config.dotShrinkMs);
  }

  #setDropFallMotion() {
    const fillLineY = window.innerHeight * 0.8;
    const dropRect = this.#drop.getBoundingClientRect();
    const distanceToFillLine = Math.max(0, fillLineY - dropRect.bottom);
    const fallDistance = Math.max(
      distanceToFillLine + window.innerHeight * 0.35,
      window.innerHeight - dropRect.top + dropRect.height
    );

    this.#spinner.style.setProperty("--drop-fall-ms", `${this.#config.dropFallMs}ms`);
    this.#spinner.style.setProperty("--drop-fall-y", `${fallDistance}px`);
  }

  #watchDropFillLine() {
    this.#state.dropFillFrame = 0;

    if (this.#state.completed) {
      return;
    }

    const fillLineY = window.innerHeight * 0.8;
    const dropOrigin = this.#getLiveDropContactPoint();

    if (this.#root.classList.contains("drop-ready") && dropOrigin.y >= fillLineY) {
      this.#startFinalTransition({
        x: dropOrigin.x,
        y: fillLineY + this.#getRenderedDropSize(),
      });
      return;
    }

    this.#state.dropFillFrame = requestAnimationFrame(() => this.#watchDropFillLine());
  }

  #startFinalTransition(origin = this.#getLiveDropContactPoint()) {
    if (this.#state.completed) {
      return;
    }

    this.#setWipeOrigin(origin);
    this.#root.classList.add("finalizing");
    this.#timers.set("dropHide", () => {
      this.#root.classList.add("drop-hidden");
    }, this.#config.dropHideMs);

    this.#timers.set("finalDone", () => {
      this.#state.completed = true;
      this.#root.classList.add("final");
      this.#onComplete();
    }, this.#config.blackWipeMs);
  }

  #setWipeOrigin(origin) {
    this.#root.style.setProperty("--wipe-x", `${origin.x}px`);
    this.#root.style.setProperty("--wipe-y", `${origin.y}px`);
  }

  #getLiveDropContactPoint() {
    const rect = this.#drop.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    };
  }

  #getRenderedDropSize() {
    return this.#drop.getBoundingClientRect().height;
  }
}
