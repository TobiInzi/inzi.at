// Accent type selector: pick a type to tint the site, click it again to clear.
const STORAGE_KEY = "tobiinzi:accent";

const root = document.documentElement;
const palette = document.querySelector(".palette");
const buttons = [...palette.querySelectorAll(".type")];

function applyAccent(color) {
  if (color) {
    root.style.setProperty("--accent", color);
    root.classList.add("has-accent");
  } else {
    root.style.removeProperty("--accent");
    root.classList.remove("has-accent");
  }
}

function setActive(active) {
  for (const button of buttons) {
    const isActive = button === active;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function select(button) {
  setActive(button);
  applyAccent(button.dataset.color);
  localStorage.setItem(STORAGE_KEY, button.dataset.color);
}

function clear() {
  setActive(null);
  applyAccent(null);
  localStorage.removeItem(STORAGE_KEY);
}

// Restore a previously chosen accent.
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  const button = buttons.find((b) => b.dataset.color === saved);
  if (button) select(button);
}

palette.addEventListener("click", (event) => {
  const button = event.target.closest(".type");
  if (!button) return;

  if (button.classList.contains("is-active")) {
    clear();
  } else {
    select(button);
  }
});

// Section switching: the left-pillar links swap the visible panel in the main
// area and reset its scroll position.
const sectionNav = document.querySelector(".sections");
const sectionLinks = [...sectionNav.querySelectorAll(".section-link")];
const panels = [...document.querySelectorAll(".panel")];
const content = document.querySelector(".content");

function showSection(id) {
  for (const link of sectionLinks) {
    const current = link.dataset.section === id;
    link.classList.toggle("is-current", current);
    if (current) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
  for (const panel of panels) {
    const active = panel.dataset.section === id;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }
  content.scrollTop = 0;
}

sectionNav.addEventListener("click", (event) => {
  const link = event.target.closest(".section-link");
  if (!link) return;
  showSection(link.dataset.section);
});

// Idle micro-animations: the icons rest for 1–3s, play one random animation,
// then rest again. Some animations roll across the whole row as a wave (via a
// per-icon stagger), others hit a single random icon.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// duration must match the matching .anim-* rule in main.css.
const ANIMATIONS = [
  { cls: "anim-jump", scope: "all", stagger: 70, duration: 600 }, // wave hop, front→back
  { cls: "anim-pulse", scope: "all", stagger: 70, duration: 650 }, // pulse swelling across the row
  { cls: "anim-flip", scope: "all", stagger: 95, duration: 750 }, // flip one after another
  { cls: "anim-swing", scope: "all", stagger: 60, duration: 850 }, // pendulum ripple
  { cls: "anim-spin", scope: "all", stagger: 0, duration: 800 }, // whole row spins together
  { cls: "anim-wobble", scope: "all", stagger: 0, duration: 700 }, // whole row wiggles together
  { cls: "anim-jump", scope: "one", stagger: 0, duration: 600 }, // a single icon jumps
  { cls: "anim-pop", scope: "one", stagger: 0, duration: 450 }, // a single icon pops
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

function runAnimation(anim) {
  const targets = anim.scope === "one" ? [pickOne(buttons)] : buttons;
  const reverse = anim.stagger > 0 && Math.random() < 0.5; // roll either direction
  let maxDelay = 0;

  targets.forEach((el, i) => {
    const order = reverse ? targets.length - 1 - i : i;
    const delay = order * anim.stagger;
    maxDelay = Math.max(maxDelay, delay);
    el.style.animationDelay = `${delay}ms`;
    void el.offsetWidth; // restart the animation if it was just removed
    el.classList.add(anim.cls);
  });

  window.setTimeout(() => {
    for (const el of targets) {
      el.classList.remove(anim.cls);
      el.style.removeProperty("animation-delay");
    }
    scheduleNext();
  }, maxDelay + anim.duration + 60);
}

function scheduleNext() {
  window.setTimeout(() => runAnimation(pickOne(ANIMATIONS)), randInt(1000, 3000));
}

if (!reduceMotion.matches) {
  scheduleNext();
}
