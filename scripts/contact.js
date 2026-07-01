// Contact reveal: the sidebar's "Contact" control isn't a section — clicking it
// turns its text into a single orb that splits into five, which arc along their own
// curved paths (trailing behind them) to the lower-right corner and settle as the
// social icons. From then on they're the normal, accent-tinted, slowly bobbing
// links. State lives only in memory, so a reload resets it (like the ignite orb).

const TRAVEL_DUR = 1.5; // sec for one orb's flight to the corner
const STAGGER = 0.14; // sec between each orb launching, so they fan out
const SEED_HOLD = 0.8; // sec the single seed orb swells + holds before splitting
const CURVE = 0.32; // arc bow as a fraction of the flight distance
const TRAIL_LIFE = 0.5; // sec a trail dot lingers
const TRAIL_GAP = 0.035; // sec between dropped trail dots
const FADE_MS = 320; // orb/seed fade-out (matches the CSS opacity transition)

const easeInOut = (t) => t * t * (3 - 2 * t);
const nowSec = () => performance.now() / 1000;

// Reveal the sidebar Contact control's fly-in. `reducedMotion` skips straight to the
// settled state. No-ops (leaving the links shown by the noscript fallback) if the
// markup is missing.
export function initContact(reducedMotion = false) {
  const btn = document.querySelector(".contact-link");
  const socials = document.querySelector(".socials");
  if (!btn || !socials) return;
  const icons = [...socials.querySelectorAll(".social")];
  if (!icons.length) return;

  // Hidden + inert until revealed. They stay laid out (just transparent) so we can
  // measure each icon's resting corner position for the fly-in targets.
  socials.style.pointerEvents = "none";
  for (const a of icons) {
    a.setAttribute("tabindex", "-1");
    a.setAttribute("aria-hidden", "true");
  }

  let revealed = false;
  let byKeyboard = false;

  // Icons are settled and interactive; hand the corner over to the normal behaviour.
  function finish() {
    socials.style.pointerEvents = "";
    for (const a of icons) {
      a.style.opacity = "1";
      a.removeAttribute("tabindex");
      a.removeAttribute("aria-hidden");
    }
    btn.remove();
    if (byKeyboard) icons[0].focus(); // the activated control is gone; keep focus
  }

  function makeOrb(x, y, extra) {
    const el = document.createElement("span");
    el.className = extra ? `contact-orb ${extra}` : "contact-orb";
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1)`;
    document.body.appendChild(el);
    return el;
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    if (reducedMotion) {
      finish();
      return;
    }

    // Source: the Contact button's centre. Targets: each icon's resting centre.
    const b = btn.getBoundingClientRect();
    const src = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    // Measure each icon's RESTING centre (subtract the live bob offset) so an orb
    // lands on the point the icon drifts around, not wherever the wave has it that
    // instant — otherwise the hand-off would look a few pixels off.
    const targets = icons.map((a) => {
      const r = a.getBoundingClientRect();
      const tf = getComputedStyle(a).transform;
      const ty = tf && tf !== "none" ? new DOMMatrixReadOnly(tf).m42 : 0;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 - ty };
    });

    // The text becomes the seed orb: fade the label, pop the orb in at its spot.
    btn.classList.add("is-morphing");
    const seed = makeOrb(src.x, src.y, "contact-seed");
    seed.style.transform = `translate(${src.x}px, ${src.y}px) translate(-50%, -50%) scale(0)`;
    seed.offsetWidth; // force a reflow so the scale-up transition actually runs
    // swell past the flyer size so the text-to-orb morph reads clearly before the split
    seed.style.transform = `translate(${src.x}px, ${src.y}px) translate(-50%, -50%) scale(1.25)`;

    // One flyer per icon, each with its own perpendicular bow (alternating sides,
    // growing with index) so the five trace visibly different arcs.
    const flyers = targets.map((t, i) => {
      const dx = t.x - src.x;
      const dy = t.y - src.y;
      const len = Math.hypot(dx, dy) || 1;
      const bow = (i % 2 ? 1 : -1) * (0.55 + (i / targets.length) * 0.9) * len * CURVE;
      return {
        t,
        cx: (src.x + t.x) / 2 + (-dy / len) * bow,
        cy: (src.y + t.y) / 2 + (dx / len) * bow,
        launch: SEED_HOLD + i * STAGGER,
        el: null,
        lastTrail: 0,
        arrived: false,
      };
    });

    const trail = []; // { el, born, x, y }
    const t0 = nowSec();
    let seedGone = false;

    function tick() {
      const now = nowSec() - t0;

      // Retire the seed and hide the (now text-less) button once the orbs peel off.
      if (!seedGone && now >= SEED_HOLD) {
        seedGone = true;
        seed.style.opacity = "0";
        window.setTimeout(() => seed.remove(), FADE_MS);
        btn.style.visibility = "hidden";
      }

      let allDone = true;
      for (let i = 0; i < flyers.length; i++) {
        const f = flyers[i];
        if (f.arrived) continue;
        const lt = now - f.launch;
        if (lt < 0) {
          allDone = false;
          continue; // not launched yet
        }
        const e = Math.min(1, lt / TRAVEL_DUR);
        const ee = easeInOut(e);
        const u = 1 - ee;
        const x = u * u * src.x + 2 * u * ee * f.cx + ee * ee * f.t.x;
        const y = u * u * src.y + 2 * u * ee * f.cy + ee * ee * f.t.y;
        if (!f.el) f.el = makeOrb(x, y);
        f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1)`;

        if (now - f.lastTrail >= TRAIL_GAP) {
          f.lastTrail = now;
          const el = makeOrb(x, y);
          el.className = "contact-trail";
          trail.push({ el, born: now, x, y });
        }

        if (e >= 1) {
          f.arrived = true;
          const el = f.el;
          el.style.opacity = "0";
          window.setTimeout(() => el.remove(), FADE_MS);
          icons[i].style.opacity = "1"; // fade the real icon in as the orb fades out
        } else {
          allDone = false;
        }
      }

      for (let j = trail.length - 1; j >= 0; j--) {
        const d = trail[j];
        const age = (now - d.born) / TRAIL_LIFE;
        if (age >= 1) {
          d.el.remove();
          trail.splice(j, 1);
          continue;
        }
        d.el.style.opacity = String((1 - age) * 0.5);
        d.el.style.transform = `translate(${d.x}px, ${d.y}px) translate(-50%, -50%) scale(${1 - age * 0.5})`;
      }

      if (allDone && seedGone) {
        for (const d of trail) d.el.remove();
        finish();
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  btn.addEventListener("click", (e) => {
    byKeyboard = e.detail === 0; // keyboard activation reports detail 0
    reveal();
  });
}
