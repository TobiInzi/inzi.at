import { applyPalette, readPalette } from "../../lib/palette.js";
import { pickRandom } from "../../lib/math.js";
import { SequenceTimers } from "../../lib/sequence-timers.js";
import { PALETTES, PARTICLE_BURST } from "./config.js";
import { ParticleField } from "./particle-field.js";
import { TitleBurst } from "./title-burst.js";
import { renderTitleText } from "./title.js";

export const particleBurstScene = {
  id: "particle-burst",
  label: "Particle Burst",
  create(context) {
    return new ParticleBurstScene(context);
  },
};

class ParticleBurstScene {
  #config = PARTICLE_BURST;
  #context;
  #theme;
  #elements;
  #particles;
  #titleBurst;
  #timers = new SequenceTimers();
  #pointerMove;
  #pointerLeave;
  #state = { ready: false, exiting: false };

  constructor(context) {
    this.#context = context;

    applyPalette(pickRandom(PALETTES));
    this.#theme = readPalette();
    this.#elements = this.#buildDom(context.host);

    renderTitleText(this.#elements.titleText, this.#config.mainText);
    this.#elements.titleSubtext.textContent = this.#config.subText;

    this.#particles = new ParticleField({
      canvas: this.#elements.particleField,
      config: this.#config,
      theme: this.#theme,
      onRevealStart: () => this.#elements.title.classList.add("is-revealing"),
      onReady: () => this.#handleReady(),
    });

    this.#titleBurst = new TitleBurst({
      canvas: this.#elements.fillField,
      config: this.#config,
      theme: this.#theme,
      titleText: this.#elements.titleText,
    });

    this.#bindEvents();
  }

  start() {
    this.#particles.start();
  }

  resize(width, height, dpr) {
    this.#particles.resize(width, height, dpr);
    this.#titleBurst.resize(width, height, dpr);
  }

  pause() {
    this.#timers.pause();
  }

  resume(pausedMs) {
    this.#timers.resume();
    this.#particles.shiftTime(pausedMs);
    this.#titleBurst.shiftTime(pausedMs);
  }

  dispose() {
    this.#timers.clearAll();
    this.#particles.dispose();
    this.#titleBurst.dispose();
    this.#elements.root.remove();
  }

  #handleReady() {
    this.#state.ready = true;
    this.#elements.title.classList.add("is-ready");
    this.#elements.root.classList.add("is-ready");
    this.#context.onReady();
  }

  #bindEvents() {
    const begin = () => this.#beginExit();

    this.#elements.title.addEventListener("click", begin);
    this.#elements.hitTarget.addEventListener("click", begin);
    this.#elements.hitTarget.addEventListener("pointerdown", begin, { passive: true });

    this.#pointerMove = (event) => {
      if (!this.#state.exiting) {
        this.#particles.handlePointerMove(event);
      }
    };
    this.#pointerLeave = () => this.#particles.handlePointerLeave();
    document.addEventListener("pointermove", this.#pointerMove, { passive: true });
    document.addEventListener("pointerleave", this.#pointerLeave, { passive: true });
  }

  #beginExit() {
    if (!this.#state.ready || this.#state.exiting) {
      return;
    }

    this.#state.exiting = true;
    document.removeEventListener("pointermove", this.#pointerMove);
    document.removeEventListener("pointerleave", this.#pointerLeave);
    this.#context.onExitStart();

    this.#particles.stopForOpening();
    this.#titleBurst.prepare();

    requestAnimationFrame(() => {
      this.#elements.root.classList.add("is-opening");
      this.#titleBurst.start();
    });

    this.#timers.set("exit", () => this.#finishExit(), this.#config.exitMs);
  }

  #finishExit() {
    this.#elements.root.classList.add("is-filled");
    this.#titleBurst.stop();
    this.#context.onComplete(this.#theme.mainColor);
  }

  #buildDom(host) {
    const root = document.createElement("div");
    root.className = "particle-burst";

    const particleField = document.createElement("canvas");
    particleField.className = "particle-field";

    const fillField = document.createElement("canvas");
    fillField.className = "fill-field";
    fillField.setAttribute("aria-hidden", "true");

    const colorWash = document.createElement("div");
    colorWash.className = "color-wash";
    colorWash.setAttribute("aria-hidden", "true");

    const title = document.createElement("button");
    title.className = "main-title";
    title.type = "button";
    title.setAttribute("aria-label", "Enter site");

    const titleText = document.createElement("span");
    titleText.className = "main-title-text";

    const titleSubtext = document.createElement("span");
    titleSubtext.className = "main-title-subtext";

    title.append(titleText, titleSubtext);

    const hitTarget = document.createElement("button");
    hitTarget.className = "hit-target";
    hitTarget.type = "button";
    hitTarget.tabIndex = -1;
    hitTarget.setAttribute("aria-hidden", "true");

    root.append(particleField, fillField, colorWash, title, hitTarget);
    host.append(root);

    return { root, particleField, fillField, title, titleText, titleSubtext, hitTarget };
  }
}
