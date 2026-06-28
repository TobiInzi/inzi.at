import { SequenceTimers } from "../../lib/sequence-timers.js";
import { WATER_DROP } from "./config.js";
import { WaterDropSequence } from "./sequence.js";

export const waterDropTransition = {
  id: "water-drop",
  label: "Water Drop",
  create(context) {
    return new WaterDropTransition(context);
  },
};

class WaterDropTransition {
  #config = WATER_DROP;
  #context;
  #timers = new SequenceTimers();
  #elements;
  #sequence;

  constructor(context) {
    this.#context = context;
    this.#elements = this.#buildDom(context.host);
    this.#sequence = new WaterDropSequence({
      config: this.#config,
      timers: this.#timers,
      root: this.#elements.root,
      tip: this.#elements.tip,
      spinner: this.#elements.spinner,
      drop: this.#elements.drop,
      onComplete: () => this.#context.onComplete(),
    });
  }

  start() {
    requestAnimationFrame(() => {
      this.#elements.root.classList.add("is-active");
      this.#sequence.start();
    });
  }

  resize() {
    // Drop geometry is read live from the DOM each frame, so nothing to do here.
  }

  pause() {
    this.#timers.pause();
  }

  resume() {
    this.#timers.resume();
  }

  dispose() {
    this.#sequence.dispose();
    this.#elements.root.remove();
  }

  #buildDom(host) {
    const root = document.createElement("div");
    root.className = "water-drop";

    const loader = document.createElement("div");
    loader.className = "arrival-loader";

    const tip = document.createElement("p");
    tip.className = "arrival-tip";
    tip.textContent = this.#config.firstTip;

    const spinner = document.createElement("span");
    spinner.className = "arrival-spinner";
    spinner.setAttribute("aria-hidden", "true");

    const ring = document.createElement("span");
    ring.className = "arrival-ring";

    const drop = document.createElement("img");
    drop.className = "arrival-drop";
    drop.src = this.#config.dropAsset;
    drop.alt = "";

    spinner.append(ring, drop);
    loader.append(tip, spinner);

    const wipe = document.createElement("div");
    wipe.className = "water-drop__wipe";
    wipe.setAttribute("aria-hidden", "true");

    root.append(loader, wipe);
    host.append(root);

    return { root, tip, spinner, drop, wipe };
  }
}
