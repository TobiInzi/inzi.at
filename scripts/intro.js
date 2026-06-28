import { HOME_SEQUENCE, INTRO, START_PAGES } from "./intro/config.js";
import { scaleDurations } from "./intro/motion.js";
import { ParticleField } from "./intro/particle-field.js";
import { PortfolioSequence } from "./intro/portfolio-sequence.js";
import { SequenceTimers } from "./intro/sequence-timers.js";
import { chooseStartPage, applyStartPage, readTheme } from "./intro/theme.js";
import { TitleBurst } from "./intro/title-burst.js";
import { renderTitleText } from "./intro/title.js";

const SELECTORS = {
  main: "#portfolioMain",
  intro: "#intro",
  title: "#mainTitle",
  titleText: "#mainTitleText",
  titleSubtext: "#mainTitleSubtext",
  hitTarget: "#introHitTarget",
  particleField: "#particleField",
  letterFillField: "#letterFillField",
  arrivalTip: "#arrivalTip",
  arrivalSpinner: ".arrival-spinner",
  arrivalDrop: ".arrival-drop",
};

const elements = getElements(SELECTORS);
const timers = new SequenceTimers();
const startPage = chooseStartPage(START_PAGES);

scaleDurations([INTRO, HOME_SEQUENCE]);
applyStartPage(startPage);
renderTitleText(elements.titleText, INTRO.mainText);
elements.titleSubtext.textContent = INTRO.subText;

const theme = readTheme();
const state = {
  width: 0,
  height: 0,
  dpr: 1,
  hiddenAt: 0,
  opening: false,
  resizeFrame: 0,
  pausedAnimations: [],
};

const particles = new ParticleField({
  canvas: elements.particleField,
  config: INTRO,
  theme,
  onRevealStart: () => {
    elements.title.classList.add("is-revealing");
  },
  onReady: () => {
    elements.intro.classList.add("is-ready");
    elements.title.classList.add("is-ready");
  },
});

const titleBurst = new TitleBurst({
  canvas: elements.letterFillField,
  config: HOME_SEQUENCE,
  theme,
  titleText: elements.titleText,
});

const portfolioSequence = new PortfolioSequence({
  config: HOME_SEQUENCE,
  timers,
  arrivalTip: elements.arrivalTip,
  arrivalSpinner: elements.arrivalSpinner,
  arrivalDrop: elements.arrivalDrop,
});

bindEvents();
resize();

requestAnimationFrame(() => {
  elements.intro.classList.add("is-visible");
  particles.start();
});

function getElements(selectors) {
  return Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => {
      const element = document.querySelector(selector);

      if (!element) {
        throw new Error(`Missing intro element: ${selector}`);
      }

      return [key, element];
    })
  );
}

function bindEvents() {
  window.addEventListener("resize", scheduleResize);
  document.addEventListener(
    "pointermove",
    (event) => {
      if (!state.opening) {
        particles.handlePointerMove(event);
      }
    },
    { passive: true }
  );
  document.addEventListener(
    "pointerleave",
    () => {
      particles.handlePointerLeave();
    },
    { passive: true }
  );
  document.addEventListener("visibilitychange", handleVisibilityChange);

  elements.title.addEventListener("click", openHome);
  elements.hitTarget.addEventListener("click", openHome);
  elements.hitTarget.addEventListener("pointerdown", openHome, { passive: true });
}

function scheduleResize() {
  if (state.resizeFrame !== 0) {
    return;
  }

  state.resizeFrame = requestAnimationFrame(() => {
    state.resizeFrame = 0;
    resize();
  });
}

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, INTRO.maxDevicePixelRatio);
  particles.resize(state.width, state.height, state.dpr);
  titleBurst.resize(state.width, state.height, state.dpr);
}

function openHome() {
  if (state.opening || !particles.isReady) {
    return;
  }

  state.opening = true;
  particles.stopForOpening();
  titleBurst.prepare();

  requestAnimationFrame(() => {
    elements.intro.classList.add("is-opening");
    titleBurst.start();
  });

  timers.set("introExit", finishIntro, HOME_SEQUENCE.introExitMs);
}

function finishIntro() {
  elements.intro.classList.add("is-filled");
  document.body.classList.add("site-open");
  elements.intro.classList.add("is-done");
  elements.intro.setAttribute("aria-hidden", "true");
  elements.main.removeAttribute("aria-hidden");
  titleBurst.stop();
  titleBurst.dispose();
  particles.dispose();
  portfolioSequence.start();
}

function handleVisibilityChange() {
  if (document.visibilityState === "hidden") {
    state.hiddenAt = performance.now();
    timers.pause();
    pauseVisualAnimations();
    return;
  }

  if (state.hiddenAt !== 0) {
    const pausedFor = performance.now() - state.hiddenAt;

    particles.shiftTime(pausedFor);
    titleBurst.shiftTime(pausedFor);
    state.hiddenAt = 0;
  }

  resumeVisualAnimations();
  timers.resume();
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
