import { pickRandom } from "../lib/math.js";

const MAX_DEVICE_PIXEL_RATIO = 2;

// Runs the staged pipeline: scene (stage 1) -> transition (stage 2) -> portfolio (stage 3).
// Scenes and transitions are interchangeable modules sharing a small lifecycle contract.
export class Orchestrator {
  #stage;
  #portfolio;
  #scenes;
  #transitions;
  #selector;
  #scene = null;
  #transition = null;
  #activeSceneId = null;
  #phase = "scene";
  #state = {
    width: 0,
    height: 0,
    dpr: 1,
    resizeFrame: 0,
    hiddenAt: 0,
    pausedAnimations: [],
  };

  constructor({ stage, portfolio, scenes, transitions }) {
    this.#stage = stage;
    this.#portfolio = portfolio;
    this.#scenes = scenes;
    this.#transitions = transitions;
  }

  run() {
    document.body.classList.add("stage-active");
    this.#selector = this.#buildSelector();
    this.#bindEvents();
    this.#measure();
    this.#mountScene(pickRandom(this.#scenes));

    requestAnimationFrame(() => {
      this.#stage.classList.add("is-visible");
      this.#scene.start();
    });
  }

  #mountScene(descriptor) {
    this.#activeSceneId = descriptor.id;
    this.#scene = descriptor.create({
      host: this.#stage,
      onReady: () => this.#handleSceneReady(),
      onExitStart: () => this.#handleSceneExitStart(),
      onComplete: (color) => this.#handleSceneComplete(color),
    });
    this.#scene.resize(this.#state.width, this.#state.height, this.#state.dpr);
  }

  #handleSceneReady() {
    this.#updateSelectorActive();
    this.#selector.classList.add("is-visible");
  }

  #handleSceneExitStart() {
    this.#selector.classList.remove("is-visible");
  }

  #handleSceneComplete(color) {
    this.#stage.style.background = color;
    this.#scene.dispose();
    this.#scene = null;
    this.#phase = "transition";
    this.#mountTransition(pickRandom(this.#transitions), color);
  }

  #mountTransition(descriptor, color) {
    this.#transition = descriptor.create({
      host: this.#stage,
      color,
      onComplete: () => this.#handleTransitionComplete(),
    });
    this.#transition.resize(this.#state.width, this.#state.height, this.#state.dpr);
    this.#transition.start();
  }

  #handleTransitionComplete() {
    this.#portfolio.classList.add("is-revealed");
    this.#portfolio.removeAttribute("aria-hidden");
    this.#stage.classList.add("is-done");
    this.#stage.setAttribute("aria-hidden", "true");
    document.body.classList.remove("stage-active");

    this.#transition.dispose();
    this.#transition = null;
    this.#phase = "done";
  }

  #buildSelector() {
    const selector = document.createElement("div");
    selector.className = "stage-selector";
    selector.setAttribute("role", "group");
    selector.setAttribute("aria-label", "Choose intro animation");

    for (const scene of this.#scenes) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-selector__button";
      button.textContent = scene.label;
      button.dataset.sceneId = scene.id;
      button.addEventListener("click", () => this.#selectScene(scene.id));
      selector.append(button);
    }

    this.#stage.append(selector);
    return selector;
  }

  #updateSelectorActive() {
    for (const button of this.#selector.querySelectorAll(".stage-selector__button")) {
      button.classList.toggle("is-active", button.dataset.sceneId === this.#activeSceneId);
    }
  }

  #selectScene(id) {
    if (this.#phase !== "scene") {
      return;
    }

    const descriptor = this.#scenes.find((scene) => scene.id === id);
    if (!descriptor) {
      return;
    }

    this.#selector.classList.remove("is-visible");
    this.#scene.dispose();
    this.#scene = null;
    this.#stage.style.removeProperty("background");

    this.#mountScene(descriptor);
    this.#scene.start();
  }

  #bindEvents() {
    window.addEventListener("resize", () => this.#scheduleResize());
    document.addEventListener("visibilitychange", () => this.#handleVisibilityChange());
  }

  #scheduleResize() {
    if (this.#state.resizeFrame !== 0) {
      return;
    }

    this.#state.resizeFrame = requestAnimationFrame(() => {
      this.#state.resizeFrame = 0;
      this.#measure();
      this.#scene?.resize(this.#state.width, this.#state.height, this.#state.dpr);
      this.#transition?.resize(this.#state.width, this.#state.height, this.#state.dpr);
    });
  }

  #measure() {
    this.#state.width = window.innerWidth;
    this.#state.height = window.innerHeight;
    this.#state.dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  }

  #handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      this.#state.hiddenAt = performance.now();
      this.#scene?.pause();
      this.#transition?.pause();
      this.#pauseAnimations();
      return;
    }

    const pausedMs = this.#state.hiddenAt === 0 ? 0 : performance.now() - this.#state.hiddenAt;
    this.#state.hiddenAt = 0;
    this.#scene?.resume(pausedMs);
    this.#transition?.resume(pausedMs);
    this.#resumeAnimations();
  }

  #pauseAnimations() {
    if (typeof document.getAnimations !== "function") {
      return;
    }

    this.#state.pausedAnimations = document
      .getAnimations()
      .filter((animation) => animation.playState === "running");

    for (const animation of this.#state.pausedAnimations) {
      animation.pause();
    }
  }

  #resumeAnimations() {
    for (const animation of this.#state.pausedAnimations) {
      animation.play();
    }

    this.#state.pausedAnimations = [];
  }
}
