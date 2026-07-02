// Main-orb charge-up (the ignite sequence): when the orb is clicked, small coloured
// orbs appear all over the screen, linger a moment where they materialise, then flow
// straight into the main orb and are absorbed. The main orb brightens and tightens
// as it "loads" (driven shader-side via orb.setCharge). Once the charge is full we
// STOP spawning, everything still on screen rushes in, and only when none are left
// does main.js detonate it. Self-contained: runCharge() owns it all.
import { clamp, rnd, nowSec, easeInOut } from "./util.js";

const CHARGE_SEC = 5.0; // load-up length before spawning stops (tunable)
const SPAWN_RATE_START = 10; // incoming orbs per second at the start (sparse)
const SPAWN_RATE_END = 28; // per second in the dense finale
const HOLD_MIN = 0.4; // sec a fresh orb lingers where it appears before it flows in
const HOLD_MAX = 1.0; // (so it reads as "appear, then move" rather than instantly flying)
const ORB_MIN_DUR = 0.55; // sec for the fastest orb to travel to the core
const ORB_MAX_DUR = 1.25; // sec for the slowest (also the max drain tail after full)

// Run the charge-up over `igniter` (the orb's element), ramping `orb`'s charge (may
// be null if WebGL is unavailable). `onComplete` fires once the load is full AND
// every orb has landed — main.js explodes the orb then. Under reduced motion there's
// no build-up: it completes immediately so ignite stays instant.
export function runCharge({ igniter, orb, reducedMotion, onComplete }) {
  const done = () => onComplete && onComplete();
  if (reducedMotion || !igniter) {
    done();
    return;
  }

  // Absorption point: the orb's centre. It doesn't move during the charge (the Home
  // panel is static), so measure once.
  const r = igniter.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const halfDiag = Math.hypot(window.innerWidth, window.innerHeight) / 2;

  // The incoming orbs pull from the type icons' own colours (read straight off their
  // --type-color, like field.js), so the charge gathers the site's real palette and
  // can't drift from the markup. Fallback keeps it working if the icons are missing.
  const palette = [...document.querySelectorAll(".type")]
    .map((b) => b.style.getPropertyValue("--type-color").trim())
    .filter(Boolean);
  if (!palette.length) palette.push("#e8e9e8");

  const particles = [];
  // Charge time so far, EXCLUDING any paused spells (Me tab open, or the tab hidden),
  // so the load-up freezes and resumes cleanly instead of jumping ahead / detonating
  // off-screen when you come back. Advanced by the (capped) frame dt only while active.
  let elapsed = 0;
  let lastFrame = nowSec();
  let paused = false;
  let raf = 0;
  let spawnAcc = 0; // fractional-orb accumulator, so the rate isn't capped to 1/frame
  let spawning = true;

  function spawn(bornE) {
    // Appear somewhere on a ring around the orb — near for some, past the screen
    // edge for others (varied distance = varied travel time / apparent speed).
    const angle = Math.random() * Math.PI * 2;
    const dist = rnd(0.35, 1.08) * halfDiag;
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;
    // Land with a little jitter so they don't all funnel through one pixel.
    const ex = cx + rnd(-r.width * 0.18, r.width * 0.18);
    const ey = cy + rnd(-r.height * 0.18, r.height * 0.18);
    const size = rnd(7, 14); // px — same ballpark as the field/contact orbs
    const color = palette[(Math.random() * palette.length) | 0];

    const el = document.createElement("span");
    el.className = "charge-orb";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.background = color;
    el.style.boxShadow = `0 0 ${size * 0.8}px ${size * 0.14}px ${color}`;
    document.body.appendChild(el);

    particles.push({
      el, sx, sy, ex, ey,
      bornE,
      hold: rnd(HOLD_MIN, HOLD_MAX),
      dur: rnd(ORB_MIN_DUR, ORB_MAX_DUR),
    });
  }

  // Freshly spawned: sit at the spawn point and pop/fade in, so it clearly "appears"
  // before it starts flowing toward the core.
  function hold(p, h) {
    const fin = clamp(h, 0, 1);
    p.el.style.opacity = String(fin);
    p.el.style.transform = `translate(${p.sx}px, ${p.sy}px) translate(-50%, -50%) scale(${0.5 + 0.5 * fin})`;
  }

  function place(p, e) {
    // Straight line to the core at a steady speed (no rocketing into the middle).
    const x = p.sx + (p.ex - p.sx) * e;
    const y = p.sy + (p.ey - p.sy) * e;
    const fadeOut = clamp((1 - e) / 0.22, 0, 1); // fade out as it's absorbed
    const scale = 0.7 + 0.3 * (1 - e); // stays fairly full-size, only eases down a touch
    p.el.style.opacity = String(fadeOut);
    p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
  }

  function frame() {
    raf = requestAnimationFrame(frame); // keep the loop alive even while paused
    const now = nowSec();
    const dt = Math.min(0.05, now - lastFrame);
    lastFrame = now;
    if (paused) return; // Me tab / hidden: hold everything exactly where it is
    elapsed += dt;
    const progress = clamp(elapsed / CHARGE_SEC, 0, 1);

    // Ramp the orb's charge (bright + tight + faster drift). ease so it builds.
    if (orb && orb.setCharge) orb.setCharge(easeInOut(progress));

    // Full charge: stop spawning and cut short any remaining linger, so everything
    // on screen rushes in at once (and the drain tail stays tight — no residuals).
    if (progress >= 1 && spawning) {
      spawning = false;
      for (const p of particles) p.hold = Math.min(p.hold, elapsed - p.bornE);
    }

    if (spawning) {
      const rate = SPAWN_RATE_START + (SPAWN_RATE_END - SPAWN_RATE_START) * progress;
      spawnAcc += rate * dt;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        spawn(elapsed);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const age = elapsed - p.bornE;
      if (age < p.hold) {
        hold(p, age / p.hold); // still in its appear-and-linger beat
        continue;
      }
      const e = clamp((age - p.hold) / p.dur, 0, 1);
      place(p, e);
      if (e >= 1) {
        p.el.remove();
        particles.splice(i, 1);
      }
    }

    // Detonate only once spawning has stopped AND the last orb has been absorbed.
    if (!spawning && particles.length === 0) {
      cancelAnimationFrame(raf);
      done();
    }
  }
  raf = requestAnimationFrame(frame);

  // Pause/resume the whole load-up — the charge ramp, the incoming orbs, and the
  // detonation timing — freezing it in place so nothing advances or fires while Home
  // isn't the visible, active panel. Resumes exactly where it left off.
  return {
    setPaused(v) {
      paused = !!v;
    },
  };
}
