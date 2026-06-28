export class PortfolioSequence {
  #config;
  #timers;
  #arrivalTip;
  #arrivalSpinner;
  #arrivalDrop;
  #state = {
    completed: false,
    dropFillFrame: 0,
  };

  constructor({ config, timers, arrivalTip, arrivalSpinner, arrivalDrop }) {
    this.#config = config;
    this.#timers = timers;
    this.#arrivalTip = arrivalTip;
    this.#arrivalSpinner = arrivalSpinner;
    this.#arrivalDrop = arrivalDrop;
  }

  get isComplete() {
    return this.#state.completed;
  }

  start() {
    this.#timers.set("tipChange", () => this.#showSecondArrivalTip(), this.#config.tipChangeMs);
    this.#timers.set("tipFadeOut", () => this.#hideArrivalTip(), this.#config.tipFadeOutMs);
    this.#timers.set("dropStart", () => this.#startWaterDrop(), this.#config.dropStartMs);
  }

  #showSecondArrivalTip() {
    this.#arrivalTip.classList.add("is-changing");

    this.#timers.set("tipSwap", () => {
      this.#arrivalTip.textContent = "have fun";
      this.#arrivalTip.classList.remove("is-changing");
    }, 460);
  }

  #hideArrivalTip() {
    this.#arrivalTip.classList.add("is-exiting");
  }

  #startWaterDrop() {
    document.body.classList.add("site-dot-ready");

    this.#timers.set("dropFall", () => {
      this.#setDropFallMotion();
      document.body.classList.add("site-drop-falling");
      this.#timers.set("dropMorph", () => {
        document.body.classList.add("site-drop-ready");
      }, this.#config.dropMorphAfterFallMs);
      this.#state.dropFillFrame = requestAnimationFrame(() => this.#watchDropFillLine());
    }, this.#config.dotShrinkMs);
  }

  #setDropFallMotion() {
    const fillLineY = window.innerHeight * 0.8;
    const dropRect = this.#arrivalDrop.getBoundingClientRect();
    const distanceToFillLine = Math.max(0, fillLineY - dropRect.bottom);
    const fallDistance = Math.max(
      distanceToFillLine + window.innerHeight * 0.35,
      window.innerHeight - dropRect.top + dropRect.height
    );

    this.#arrivalSpinner.style.setProperty("--drop-fall-ms", `${this.#config.dropFallMs}ms`);
    this.#arrivalSpinner.style.setProperty("--drop-fall-y", `${fallDistance}px`);
  }

  #watchDropFillLine() {
    this.#state.dropFillFrame = 0;

    if (this.#state.completed) {
      return;
    }

    const fillLineY = window.innerHeight * 0.8;
    const dropOrigin = this.#getLiveDropContactPoint();

    if (document.body.classList.contains("site-drop-ready") && dropOrigin.y >= fillLineY) {
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

    this.#setFinalFillOrigin(origin);
    document.body.classList.add("site-finalizing");
    this.#timers.set("dropHide", () => {
      document.body.classList.add("site-drop-hidden");
    }, this.#config.dropHideMs);

    this.#timers.set("finalDone", () => {
      this.#state.completed = true;
      document.body.classList.add("site-final");
    }, this.#config.blackWipeMs);
  }

  #setFinalFillOrigin(origin) {
    const root = document.documentElement;

    root.style.setProperty("--final-fill-x", `${origin.x}px`);
    root.style.setProperty("--final-fill-y", `${origin.y}px`);
  }

  #getLiveDropContactPoint() {
    const rect = this.#arrivalDrop.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    };
  }

  #getRenderedDropSize() {
    return this.#arrivalDrop.getBoundingClientRect().height;
  }
}
