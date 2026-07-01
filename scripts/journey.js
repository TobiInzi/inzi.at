// Me-section scroller. The first part is intentionally almost empty: just the
// shader and a small "Scroll to explore" cue. After that, scroll progress drives
// sticky chapter text plus a tiny line cue so the page always feels alive.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const PROMPT_HIDE_AT = 0.035;
const INTRO_END = 0.06;
const HOLD_BAND = 1.25;
const MOVE_BAND = 0.85;

export function initJourneyPath(reducedMotion = false) {
  const content = document.querySelector(".content");
  const panel = document.querySelector(".me-panel");
  const journey = document.querySelector(".journey");
  const stage = journey && journey.querySelector(".journey-stage");
  const prompt = journey && journey.querySelector(".journey-prompt");
  const progress = document.querySelector(".journey-progress");
  const progressLine = progress && progress.querySelector(".journey-progress-line");
  const scenes = journey
    ? [...journey.querySelectorAll(".scene")].map((el) => ({
        el,
      }))
    : [];

  if (!content || !panel || !journey || !stage || !scenes.length) {
    return { refresh() {} };
  }

  const n = scenes.length;
  let queued = false;

  function scrollProgress() {
    const contentTop = content.getBoundingClientRect().top;
    const journeyRect = journey.getBoundingClientRect();
    const travel = Math.max(1, journeyRect.height - stage.getBoundingClientRect().height);
    return clamp((contentTop - journeyRect.top) / travel, 0, 1);
  }

  function cursor(t) {
    if (n === 1) return 0;

    const total = n * HOLD_BAND + (n - 1) * MOVE_BAND;
    let x = t * total;

    for (let i = 0; i < n; i++) {
      if (x <= HOLD_BAND) return i;
      x -= HOLD_BAND;

      if (i < n - 1) {
        if (x <= MOVE_BAND) return i + easeInOut(x / MOVE_BAND);
        x -= MOVE_BAND;
      }
    }

    return n - 1;
  }

  function setIntro(t) {
    if (!prompt) return;

    prompt.classList.toggle("is-hidden", t > PROMPT_HIDE_AT);
  }

  function setContinuousMotion(t) {
    const progressT = clamp((t - PROMPT_HIDE_AT) / (1 - PROMPT_HIDE_AT), 0, 1);

    if (progress) {
      progress.classList.toggle("is-visible", t > PROMPT_HIDE_AT);
    }
    if (progressLine) progressLine.style.transform = `scaleX(${progressT})`;
  }

  function update() {
    queued = false;
    if (panel.hidden) {
      if (progress) progress.classList.remove("is-visible");
      return;
    }

    const raw = scrollProgress();
    const storyT = clamp((raw - INTRO_END) / (1 - INTRO_END), 0, 1);
    const c = cursor(storyT);
    const active = clamp(Math.round(c), 0, n - 1);
    const hasStarted = storyT > 0;

    setIntro(raw);
    setContinuousMotion(raw);

    for (let i = 0; i < n; i++) {
      const s = scenes[i];
      const isActive = hasStarted && i === active;
      s.el.classList.toggle("is-active", isActive);
      s.el.setAttribute("aria-hidden", isActive ? "false" : "true");
    }
  }

  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  content.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("resize", refresh);
  refresh();

  return { refresh };
}
