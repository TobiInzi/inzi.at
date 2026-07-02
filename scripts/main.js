// Entry point: boots the background nebula, the floating icon field, the ignite
// orb, and the section tabs, then wires the cross-cutting bits (ignite, boot
// reveal, a throttled resize, and the hidden-tab animation freeze).
import { initNebula } from "./nebula.js";
import { initOrb } from "./orb.js";
import { initField } from "./field.js";
import { initTabs } from "./tabs.js";
import { initJourneyPath } from "./journey.js";
import { initCursor } from "./cursor.js";
import { initContact } from "./contact.js";
import { runCharge } from "./charge.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Boot intro cadence — single source of truth. The staggered line animation is
// timed entirely by the --boot-line-* custom properties in main.css; we read those
// same values here so the orb reveal and the end of the one-shot boot state can't
// drift out of sync with the CSS when the timing is tuned.
const rootStyle = getComputedStyle(document.documentElement);
const cssMs = (name, fallback) => {
  const v = rootStyle.getPropertyValue(name).trim();
  if (!v) return fallback;
  return parseFloat(v) * (v.endsWith("ms") ? 1 : 1000);
};
const BOOT_LINE_DELAY = cssMs("--boot-line-delay", 500); // beat before the first line
const BOOT_LINE_STAGGER = cssMs("--boot-line-stagger", 1200); // gap between lines
const BOOT_LINE_DUR = cssMs("--boot-line-dur", 1050); // per-line animation length
const LAST_LINE_END = BOOT_LINE_DELAY + 2 * BOOT_LINE_STAGGER + BOOT_LINE_DUR; // 3rd line settled
const ORB_REVEAL_MS = LAST_LINE_END + 300; // then hold a short beat and pop the orb in
const BOOT_END_MS = LAST_LINE_END + 150; // drop is-booting once the cascade has finished
const ORB_INTRO_MS = 1600; // orb-arrive animation (1.35s) + a small buffer
const igniter = document.querySelector(".igniter");
const content = document.querySelector(".content");
const contentInner = document.querySelector(".content-inner");
const colorHint = document.querySelector(".color-hint");

// The upper-centre "Choose a color" hint: revealed once the icons settle after ignite,
// then gone for good on the first pick. hintActive tracks the "settled, not yet picked"
// window so tab switches can hide/restore it; hintDismissed makes the removal permanent.
let hintActive = false;
let hintDismissed = false;
function showColorHint() {
  if (hintDismissed) return;
  hintActive = true;
  if (colorHint) colorHint.classList.add("is-visible");
}
function dismissColorHint() {
  hintDismissed = true;
  hintActive = false;
  if (colorHint) colorHint.classList.remove("is-visible");
}

// The field fires its shockwaves through the nebula, so build the nebula first.
const nebula = initNebula(reducedMotion);
const field = initField({ nebula, reducedMotion, onFirstPick: dismissColorHint });
const journey = initJourneyPath(reducedMotion);
initCursor(reducedMotion); // ring follower + click flash/burst, tinted by --accent
initContact(reducedMotion); // Contact control flies the social icons into the corner

let orb = null; // the WebGL vortex on the igniter; set once its canvas has layout
let lenis = null; // smooth-scroll instance; stays null under reduced motion / if the import fails

// Smooth scrolling, site-wide. .content is the only scroll container on the page
// (the sidebar/rail are fixed pillars), so wrapping it with Lenis makes every
// section glide — the Me-section journey rides on it, and any future scrolling
// panel inherits it for free. Self-hosted (assets/vendor) and loaded lazily; if
// the import fails for any reason we silently keep native scroll, and journey.js
// reads the scroll position either way, so nothing breaks.
if (!reducedMotion && content && contentInner) {
  import("../assets/vendor/lenis-1.3.25.mjs")
    .then(({ default: Lenis }) => {
      lenis = new Lenis({
        wrapper: content,
        content: contentInner,
        lerp: 0.052, // lower = smoother, slower-settling glide
        wheelMultiplier: 0.62,
        touchMultiplier: 0.8,
      });
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    })
    .catch(() => {}); // import failed → keep native scroll
}

// Carry the background's signature band with the scroll: on the short Home panel
// it barely moves, but scrolling the tall Me journey drifts it up and off screen.
if (content && nebula) {
  content.addEventListener(
    "scroll",
    () => nebula.setScroll(content.scrollTop / window.innerHeight),
    { passive: true }
  );
}

function positionIgniter() {
  const { x, y } = field.getTarget();
  igniter.style.left = `${x}px`;
  igniter.style.top = `${y}px`;
}

// One-time "ignite", in two beats. Click starts the CHARGE: the intro copy clears
// and scripts/charge.js draws a torrent of coloured orbs into the main orb, which
// brightens + tightens as it loads (for a few seconds). When the load is full it
// DETONATES — a full-screen rainbow shockwave, the orb pops + fades out, and the
// field bursts the icons into their drift band.
let charging = false;
let chargeCtl = null; // the running charge's pause control (null when idle / done)
let activeSection = "1"; // which panel is showing, so off-screen work can be paused

// Pause the whole ignite charge whenever Home isn't the visible, active panel — the Me
// tab is open, or the tab is hidden/minimised — so the charging orbs freeze and it
// never detonates off-screen; it resumes exactly where it left off. While paused the
// (frozen) charge orbs are hidden too, so they don't sit as static dots over Me.
function syncChargePause() {
  if (!chargeCtl) return;
  const pause = document.hidden || activeSection !== "1";
  chargeCtl.setPaused(pause);
  document.body.classList.toggle("charge-paused", pause);
}

function ignite() {
  if (charging || field.isIgnited()) return;
  charging = true;
  if (orb) orb.beginCharge(); // freeze the hovered size first, so the shrink starts from it
  igniter.classList.remove("orb-intro"); // drop the intro so the charge/fire isn't outranked
  igniter.style.pointerEvents = "none"; // no re-clicks / hover flips mid-charge
  document.body.classList.add("is-ignited"); // clears the intro copy now
  // One-shot: the exit animation runs only while this is set, so returning to Home later
  // (which re-displays the panel) doesn't replay it — the lines just stay cleared.
  document.body.classList.add("hint-clearing");
  window.setTimeout(() => document.body.classList.remove("hint-clearing"), 700);
  chargeCtl = runCharge({ igniter, orb, reducedMotion, onComplete: explode });
  syncChargePause(); // in case ignite fires while already hidden (unlikely, but safe)
}

// The detonation: fired once the charge is full (or immediately under reduced motion).
function explode() {
  chargeCtl = null; // charge is done — nothing left to pause
  document.body.classList.remove("charge-paused");
  // Rainbow shockwave from the orb's centre — it now sweeps the whole screen, but
  // the signature lines stay hidden until a coloured orb is picked.
  if (nebula) {
    const r = igniter.getBoundingClientRect();
    nebula.igniteWave([
      (r.left + r.width / 2) / window.innerWidth,
      1 - (r.top + r.height / 2) / window.innerHeight,
    ]);
  }
  igniter.classList.add("is-firing"); // pops and fades the (charged, bright) orb out
  window.setTimeout(() => {
    igniter.remove();
    if (orb) orb.stop(); // tear down the orb's WebGL loop + context
  }, 480);
  field.ignite(showColorHint); // burst the icons out; show the colour hint once they settle
}
igniter.addEventListener("click", ignite);

// Boot: place the icons (hidden), then once the logos have decoded settle the
// real layout and reveal the ignite orb. Everything else waits for the click.
field.measureField(); // initial geometry; icons are placed once their logos decode

const imgs = [...document.querySelectorAll(".field .type img")];

Promise.all(
  imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {})))
).then(() => {
  field.measureField();
  field.seedIcons(); // band "home" spots; icons stay hidden until the orb is clicked
  field.renderAll();
  positionIgniter();
  orb = initOrb(igniter, reducedMotion); // start the rainbow vortex (or null)
  if (!orb) igniter.classList.add("no-gl"); // CSS fallback if WebGL is unavailable

  // Reveal + pop the orb in as the finale — only after the intro copy has cascaded in
  // (ORB_REVEAL_MS is derived to land a beat after the last line settles), so it doesn't
  // arrive before the text. The orb-intro class plays the pop once; dropping it after the
  // animation finishes (ORB_INTRO_MS) means returning to Home later won't replay the
  // intro. Instant under reduced motion, or if image decoding ran past the reveal mark.
  const revealOrb = () => {
    igniter.classList.add("is-shown");
    igniter.classList.add("orb-intro");
    window.setTimeout(() => igniter.classList.remove("orb-intro"), ORB_INTRO_MS);
  };
  const wait = reducedMotion ? 0 : Math.max(0, ORB_REVEAL_MS - performance.now());
  window.setTimeout(revealOrb, wait);
});

// End the one-time boot intro once the staggered lines have played, so later tab
// switches use the normal panel rise instead of re-running the first-load cascade.
window.setTimeout(() => document.body.classList.remove("is-booting"), BOOT_END_MS);

// Tabs: the field only exists on the Home panel, so refresh its geometry when
// Home becomes visible again, keep the (pre-ignite) orb centred, and run the
// drift loop only while Home is showing.
initTabs((id) => {
  activeSection = id;
  syncChargePause(); // pause the charge if we just left Home mid-ignite (resume on return)
  // Replay the panel's rise on every switch (the first load skips this and runs the
  // staggered boot intro instead). Toggling the class + a reflow restarts the animation.
  const active = document.querySelector(`.panel[data-section="${id}"]`);
  if (active) {
    active.classList.remove("animate-in");
    void active.offsetWidth; // force reflow so re-adding restarts the animation
    active.classList.add("animate-in");
  }
  // The colour hint is body-level (fixed), so mirror the Home panel's visibility.
  if (colorHint) colorHint.classList.toggle("is-visible", id === "1" && hintActive);
  if (id === "1") {
    field.measureField();
    if (!field.isIgnited()) {
      positionIgniter();
      if (orb) orb.resize();
    }
    field.startField();
    journey.refresh();
  } else {
    field.stopField();
    journey.refresh();
  }
  if (lenis) {
    lenis.resize(); // the active panel's height (the scroll length) just changed
    lenis.scrollTo(0, { immediate: true }); // start each panel from the top
  } else if (content) {
    content.scrollTop = 0; // native fallback (Lenis blocked/offline or reduced motion)
  }
});

// Throttled resize: coalesce the burst of resize events to one update per frame
// so we don't re-allocate the WebGL canvases + re-measure layout dozens of times
// per second during a drag.
let resizeQueued = false;
window.addEventListener("resize", () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    field.onResize();
    journey.refresh();
    if (!field.isIgnited()) {
      positionIgniter(); // keep the orb centred until it's clicked
      if (orb) orb.resize();
    }
    if (nebula) nebula.resize(); // resize + repaint the background canvas
  });
});

// Freeze the page animations/transitions while the tab is hidden.
document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("frozen", document.hidden);
  syncChargePause(); // freeze the charge while the tab is hidden; resume when it's back
});

// React to the OS reduced-motion setting flipping mid-session. reducedMotion is read
// once at boot and threaded through every subsystem (loops, waves, Lenis, cursor);
// re-wiring them all to toggle live is a large surface, so a one-time reload cleanly
// re-boots the page into the correct mode instead.
window
  .matchMedia("(prefers-reduced-motion: reduce)")
  .addEventListener("change", () => location.reload());
