// Floating icon field: the type icons drift slowly through the BOTTOM band of the
// Home panel like objects adrift in space, softly repelling one another so they
// never overlap. Picking one turns it into a small colour orb that arcs up to the
// centre of the page on a curved path (trailing behind it), morphs back into the
// icon, and only THEN fires the nebula shockwave. Releasing it collapses the
// colour back to dark with a reverse shockwave; once that reaches the middle, the
// icon orbs back out along a curve to the band. JS owns every icon's transform, so
// there are no CSS transitions to race against on position.
import { NONE_COLOR } from "./nebula.js";
import { clamp, rnd, nowSec, easeInOut, easeOut, hexToRgb } from "./util.js";

const MIN_SPEED = 4; // px/sec — slowest a drifting icon travels
const MAX_SPEED = 12; // px/sec — fastest
const WANDER = 12; // px/sec² of heading wander, so paths aren't dead straight
const REPEL_ACCEL = 55; // px/sec² separation push at contact (fades out by repelR)
const EASE_RATE = 6; // how briskly an icon settles its scale / centre pin (per sec)
const ACTIVE_SCALE = 2; // size of the centred icon
const BAND_TOP = 0.58; // the drift band starts this far down the field (bottom only)
const REPEL_RADIUS_F = 3.4; // separation influence radius, in icon radii
const MIN_GAP_F = 2.5; // hard minimum centre-to-centre distance, in icon radii
const TRAVEL_DUR = 0.7; // sec for the curved orb flight to / from the centre
const CURVE = 0.28; // arc bow as a fraction of the flight distance
const ORB_SCALE = 0.5; // size of the travelling colour orb (× base)
const MORPH_SEC = 0.16; // icon <-> orb crossfade at each end (matches the CSS)
const TRAIL_LIFE = 0.28; // sec a trail dot lingers
const TRAIL_GAP = 0.035; // sec between dropped dots (bigger = sparser trail)
const TRAIL_MAX = 24; // trail dot pool size
const TRAIL_ALPHA = 0.55; // peak opacity of a fresh trail dot
const BURST_DELAY = 0; // burst the icons the instant the orb detonates, so the orb's
// explosion and the scattering icons read as one blast (not two)
const BURST_DUR = 0.5; // sec for the load explosion outward from the middle
const BURST_RADIUS_MIN = 0.14; // nearest an exploded icon lands (fraction of short side)
const BURST_RADIUS_MAX = 0.44; // farthest — the distance is random per icon so the blast
// reads as a real scatter (varied distances) instead of icons pinned to a ring
const BURST_HOLD = 0.15; // sec the exploded icons hold before orbing to the pool
const LAUNCH_STAGGER = 0.1; // sec between each icon launching its orb flight
const SELECT_ORBS = 3; // small orbs that circle a hovered (drifting) icon
const SELECT_ORBIT_F = 1.55; // orbit radius, in icon radii (just outside the icon)
const SELECT_SPIN = 3.2; // rad/sec the selection orbs circle at
const HOVER_SCALE = 1.22; // a hovered (frozen) icon swells slightly under the pointer

const colorOf = (ic) => ic.btn.style.getPropertyValue("--type-color").trim();

// Quadratic Bézier point at parameter e (0..1) along a travel's arc.
function bezierPoint(tr, e) {
  const u = 1 - e;
  return [
    u * u * tr.sx + 2 * u * e * tr.cx + e * e * tr.ex,
    u * u * tr.sy + 2 * u * e * tr.cy + e * e * tr.ey,
  ];
}

// Set up the floating field over the `.field` element. `nebula` (may be null) is
// used to fire the shockwaves; `reducedMotion` swaps animation for instant snaps.
export function initField({ nebula, reducedMotion, onFirstPick }) {
  const root = document.documentElement;
  const field = document.querySelector(".field");
  const buttons = [...field.querySelectorAll(".type")];

  // Per-icon motion state, parallel to `buttons`.
  const icons = buttons.map((btn) => ({
    btn,
    mode: "drift", // "drift" | "in" | "active" | "releasing" | "out" | "burst"
    x: 0,
    y: 0, // centre position, field-local px
    hx: 0,
    hy: 0, // reduced-motion "home" in the band
    vx: 0,
    vy: 0, // velocity, px/sec
    scale: 1,
    travel: null, // { sx, sy, cx, cy, ex, ey, start } while orbing in/out
    burst: null, // { sx, sy, ex, ey, start, launchAt } during the load explosion
    arrivedAt: 0, // when the orb reached its end (to time the morph-back)
    lastTrail: 0, // time the last trail dot was dropped (to space them out)
  }));

  // Time from ignite() until the last icon has settled into the drift band: the load
  // intro's full length, derived from its phase constants so it tracks any tuning.
  const introSettleSec =
    BURST_DELAY +
    BURST_DUR +
    BURST_HOLD +
    (icons.length - 1) * LAUNCH_STAGGER +
    TRAVEL_DUR +
    MORPH_SEC;
  let firstPicked = false;

  // Hover-to-select: the drifting icon the pointer is currently over. While set (and
  // still drifting) that icon freezes in place and three small orbs circle it as a
  // selection cue. Only ever a small floating icon — never the big centred one.
  let hoveredIc = null;
  const isFrozen = (ic) => ic === hoveredIc && ic.mode === "drift";

  // Field geometry, refreshed on resize. The drift band is the rectangle
  // [xMin,xMax]×[yMin,yMax]; the active target is the centre of the page.
  let fieldW = 0;
  let fieldH = 0;
  let iconR = 0;
  let repelR = 0;
  let minGap = 0;
  let xMin = 0;
  let xMax = 0;
  let yMin = 0;
  let yMax = 0;
  let targetX = 0;
  let targetY = 0;

  function measureField() {
    // While the field is hidden (e.g. the "Me" tab is showing) it measures 0;
    // bail so we keep the last good geometry instead of collapsing everything.
    if (!field.clientWidth) return;
    fieldW = field.clientWidth;
    fieldH = field.clientHeight;
    iconR = buttons[0].offsetWidth / 2 || 0;
    repelR = iconR * REPEL_RADIUS_F;
    minGap = iconR * MIN_GAP_F;
    xMin = iconR;
    xMax = Math.max(iconR, fieldW - iconR);
    yMax = Math.max(iconR, fieldH - iconR);
    yMin = clamp(fieldH * BAND_TOP, iconR, yMax);
    // Centre of the page, expressed in field-local px (it sits above the band).
    targetX = fieldW / 2;
    targetY = window.innerHeight / 2 - field.getBoundingClientRect().top;
  }

  function randomVelocity(ic) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rnd(MIN_SPEED, MAX_SPEED);
    ic.vx = Math.cos(angle) * speed;
    ic.vy = Math.sin(angle) * speed;
  }

  // Begin a curved orb flight from the icon's current spot to (ex, ey). `dir` is
  // "in" (to the centre, then becomes active) or "out" (to the band, then drifts).
  function startTravel(ic, ex, ey, dir) {
    const sx = ic.x;
    const sy = ic.y;
    const dx = ex - sx;
    const dy = ey - sy;
    const len = Math.hypot(dx, dy) || 1;
    const bow = len * CURVE * (Math.random() < 0.5 ? 1 : -1); // arc to a random side
    ic.travel = {
      sx,
      sy,
      cx: (sx + ex) / 2 + (-dy / len) * bow, // control point, offset perpendicular
      cy: (sy + ey) / 2 + (dx / len) * bow,
      ex,
      ey,
      start: nowSec(),
    };
    ic.mode = dir;
    ic.arrivedAt = 0;
    ic.btn.classList.add("is-orb"); // morph the icon into the colour orb
  }

  // Pick a band spot that's as far as possible from where the OTHER icons are (or
  // are heading), so a returning orb doesn't land on top of one and snap apart.
  function openSpot(self) {
    let best = null;
    let bestNear = -Infinity;
    for (let i = 0; i < 14; i++) {
      const x = rnd(xMin, xMax);
      const y = rnd(yMin, yMax);
      let near = Infinity;
      for (const o of icons) {
        if (o === self) continue;
        const ox = o.travel ? o.travel.ex : o.x; // travellers: aim away from their goal
        const oy = o.travel ? o.travel.ey : o.y;
        near = Math.min(near, (x - ox) ** 2 + (y - oy) ** 2);
      }
      if (near > bestNear) {
        bestNear = near;
        best = [x, y];
      }
    }
    return best || [rnd(xMin, xMax), rnd(yMin, yMax)];
  }

  // Orb an icon back out to an open spot in the band.
  function sendOut(ic) {
    const [x, y] = openSpot(ic);
    startTravel(ic, x, y, "out");
  }

  // Trail: a recycled pool of fading dots dropped behind a travelling orb.
  const trail = [];
  let trailIdx = 0;
  function initTrail() {
    for (let i = 0; i < TRAIL_MAX; i++) {
      const el = document.createElement("span");
      el.className = "trail";
      field.appendChild(el);
      trail.push({ el, born: -1, x: 0, y: 0 });
    }
  }
  function emitTrail(now, x, y, color) {
    const p = trail[trailIdx];
    trailIdx = (trailIdx + 1) % TRAIL_MAX;
    p.born = now;
    p.x = x;
    p.y = y;
    p.el.style.background = color;
  }
  function updateTrail(now) {
    for (const p of trail) {
      if (p.born < 0) continue;
      const age = (now - p.born) / TRAIL_LIFE;
      if (age >= 1) {
        p.born = -1;
        p.el.style.opacity = "0";
        continue;
      }
      p.el.style.opacity = String((1 - age) * TRAIL_ALPHA);
      p.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${1 - age * 0.45})`;
    }
  }

  // Selection cue: a small fixed set of orbs that circle whichever drifting icon the
  // pointer is hovering. `selectIc` holds the icon they're attached to; it lingers
  // through the fade-out (so they trail the icon as it drifts away) and clears once
  // faded. `selectFade` eases their appearance in/out; `selectSpin` is the orbit angle.
  const selectOrbs = [];
  let selectIc = null;
  let selectFade = 0;
  let selectSpin = 0;
  let glowIc = null; // the icon currently wearing the hover glow class (for clean toggling)
  function initSelectOrbs() {
    for (let i = 0; i < SELECT_ORBS; i++) {
      const el = document.createElement("span");
      el.className = "select-orb";
      field.appendChild(el);
      selectOrbs.push(el);
    }
  }
  function updateSelectOrbs(dt, k) {
    const target = hoveredIc && hoveredIc.mode === "drift" ? hoveredIc : null;
    // Radiating glow on the hovered icon itself (CSS transitions the box-shadow in/out).
    if (glowIc && glowIc !== target) {
      glowIc.btn.classList.remove("is-hovered");
      glowIc = null;
    }
    if (target && glowIc !== target) {
      target.btn.classList.add("is-hovered");
      glowIc = target;
    }
    if (target) selectIc = target;
    selectFade += ((target ? 1 : 0) - selectFade) * k;
    if (!target && selectFade < 0.02) {
      if (selectIc) {
        selectIc = null;
        for (const el of selectOrbs) el.style.opacity = "0";
      }
      return;
    }
    if (!selectIc) return;
    selectSpin += SELECT_SPIN * dt;
    const orbitR = iconR * SELECT_ORBIT_F;
    const color = colorOf(selectIc);
    selectOrbs.forEach((el, i) => {
      const a = selectSpin + (i / SELECT_ORBS) * Math.PI * 2;
      const x = selectIc.x + Math.cos(a) * orbitR;
      const y = selectIc.y + Math.sin(a) * orbitR;
      el.style.background = color;
      el.style.boxShadow = `0 0 0.35rem 0.04rem ${color}`;
      el.style.opacity = String(selectFade);
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${selectFade})`;
    });
  }

  // Load intro: stack every icon at the middle, then explode them outward to
  // scattered spots (random direction + distance). Each then orbs to a pool spot
  // one after another, in a shuffled order, via the normal travel (morph + trail).
  function startIntro() {
    const cx = targetX;
    const cy = targetY;
    const base = Math.min(fieldW, fieldH);
    const jit = (Math.PI / icons.length) * 0.9; // angular wobble, most of a slot
    const start = nowSec() + BURST_DELAY;
    icons.forEach((ic, i) => {
      // roughly even angle around the circle + a good wobble, and a RANDOM distance
      // per icon, so the icons scatter to varied depths rather than onto a clean ring.
      const angle = (i / icons.length) * Math.PI * 2 + rnd(-jit, jit);
      const r = rnd(BURST_RADIUS_MIN, BURST_RADIUS_MAX) * base;
      ic.x = cx;
      ic.y = cy;
      ic.scale = 0.4; // small at the core, grows to full as it flies out
      ic.mode = "burst";
      ic.travel = null;
      ic.burst = {
        sx: cx,
        sy: cy,
        ex: clamp(cx + Math.cos(angle) * r, iconR, fieldW - iconR),
        ey: clamp(cy + Math.sin(angle) * r, iconR, fieldH - iconR),
        start,
        launchAt: 0,
      };
    });
    // shuffle the launch order so the orbs don't peel off in DOM sequence
    const order = icons.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.forEach((idx, k) => {
      icons[idx].burst.launchAt = start + BURST_DUR + BURST_HOLD + k * LAUNCH_STAGGER;
    });
  }

  // Scatter the icons across the bottom band, each with its own heading.
  function seedIcons() {
    for (const ic of icons) {
      ic.x = ic.hx = rnd(xMin, xMax);
      ic.y = ic.hy = rnd(yMin, yMax);
      randomVelocity(ic);
    }
  }

  function render(ic) {
    ic.btn.style.transform = `translate(${ic.x}px, ${ic.y}px) translate(-50%, -50%) scale(${ic.scale})`;
  }

  function renderAll() {
    for (const ic of icons) render(ic);
  }

  // Screen-space uv (y-up) of an element's centre, for the shockwave origin.
  function rectUv(rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return [cx / window.innerWidth, 1 - cy / window.innerHeight];
  }

  // Tint the page and fire the shockwave out from the just-arrived icon.
  function fireWave(ic) {
    const color = colorOf(ic);
    const seed = icons.indexOf(ic); // each type owns a nebula keyed by its index
    root.style.setProperty("--accent", color); // selection highlight
    root.style.setProperty("--accent-text", color); // accent-tinted text
    if (nebula) {
      // reveal: 1 — the lines are hidden until a coloured orb is picked; this is
      // the wave that paints them in (in this type's colour) behind its front.
      nebula.startWave(rectUv(ic.btn.getBoundingClientRect()), hexToRgb(color), seed, {
        reveal: 1,
      });
    }
  }

  function syncPressed() {
    for (const ic of icons) {
      // "releasing" is still centred (collapsing), so it keeps the raised z-index,
      // but it's no longer the pressed/selected control.
      const centred = ic.mode === "active" || ic.mode === "releasing";
      ic.btn.classList.toggle("is-active", centred);
      ic.btn.setAttribute("aria-pressed", String(ic.mode === "active"));
    }
  }

  function clearAccent() {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-text");
  }

  // Pick an icon: orb it up to the page centre. Anything currently claiming the
  // centre (centred, or still flying in) is sent back out first.
  function pick(ic) {
    if (!firstPicked) {
      firstPicked = true;
      if (onFirstPick) onFirstPick(); // first colour chosen — retire the colour hint
    }
    if (reducedMotion) {
      // No loop to animate travel: drop everyone else home, snap the pick in, fire.
      for (const o of icons) {
        if (o !== ic && o.mode !== "drift") {
          o.mode = "drift";
          o.x = o.hx;
          o.y = o.hy;
          o.scale = 1;
          o.travel = null;
          o.btn.classList.remove("is-orb");
        }
      }
      ic.mode = "active";
      ic.x = targetX;
      ic.y = targetY;
      ic.scale = ACTIVE_SCALE;
      syncPressed();
      renderAll();
      fireWave(ic);
      return;
    }
    for (const o of icons) {
      if (o !== ic && (o.mode === "active" || o.mode === "releasing" || o.mode === "in")) {
        sendOut(o);
      }
    }
    startTravel(ic, targetX, targetY, "in");
    syncPressed();
  }

  // Release the centred icon. A reverse shockwave collapses the colour inward from
  // the edges (origin = screen centre, where the icon sits); only once it reaches
  // the middle does the icon leave the centre and ease back down into the band.
  function release(ic) {
    if (reducedMotion || !nebula) {
      // Nothing to animate: clear and send it home at once.
      clearAccent();
      ic.mode = "drift";
      ic.x = ic.hx;
      ic.y = ic.hy;
      ic.scale = 1;
      ic.travel = null;
      ic.btn.classList.remove("is-orb");
      if (nebula)
        nebula.startWave([0.5, 0.5], NONE_COLOR, null, { reverse: true, reveal: 0 });
      syncPressed();
      renderAll();
      return;
    }
    ic.mode = "releasing"; // stays pinned at the centre while the wave collapses
    syncPressed();
    // reveal: 0 — deselecting hides the lines again as the colour collapses away.
    nebula.startWave([0.5, 0.5], NONE_COLOR, null, {
      reverse: true,
      reveal: 0,
      onDone: () => {
        if (ic.mode !== "releasing") return; // a newer pick already took over
        clearAccent();
        sendOut(ic); // orb back out to the band along a curve, then drift
        syncPressed();
      },
    });
  }

  // Advance the field by `dt` seconds (absolute time `now`, for travel + trail).
  function step(now, dt) {
    const k = 1 - Math.exp(-EASE_RATE * dt); // frame-rate-independent easing

    // Centred + travelling icons.
    for (const ic of icons) {
      if (ic.mode === "active" || ic.mode === "releasing") {
        // pinned at the page centre as a full icon
        ic.x += (targetX - ic.x) * k;
        ic.y += (targetY - ic.y) * k;
        ic.scale += (ACTIVE_SCALE - ic.scale) * k;
      } else if (ic.mode === "burst") {
        // load explosion: wait at the middle, fly out, hold, then orb to the pool
        const b = ic.burst;
        const t = (now - b.start) / BURST_DUR;
        ic.scale += (1 - ic.scale) * k;
        if (t <= 0) {
          ic.x = b.sx; // still in the pre-burst delay, stacked at the middle
          ic.y = b.sy;
        } else if (t < 1) {
          const e = easeOut(t);
          ic.x = b.sx + (b.ex - b.sx) * e;
          ic.y = b.sy + (b.ey - b.sy) * e;
        } else {
          ic.x = b.ex;
          ic.y = b.ey;
          if (now >= b.launchAt) {
            ic.burst = null;
            sendOut(ic); // orb -> curved flight to a pool spot -> drift
          }
        }
      } else if (ic.mode === "in" || ic.mode === "out") {
        const tr = ic.travel;
        const t = (now - tr.start) / TRAVEL_DUR;
        if (t < 1) {
          // arc along the curve as a shrunk colour orb, dropping a trail behind it
          const p = bezierPoint(tr, easeInOut(t));
          ic.x = p[0];
          ic.y = p[1];
          ic.scale += (ORB_SCALE - ic.scale) * k;
          if (now - ic.lastTrail >= TRAIL_GAP) {
            ic.lastTrail = now;
            emitTrail(now, ic.x, ic.y, colorOf(ic));
          }
        } else {
          // arrived: pin, morph the orb back to the icon, finalise after the fade
          ic.x = tr.ex;
          ic.y = tr.ey;
          const goal = ic.mode === "in" ? ACTIVE_SCALE : 1;
          ic.scale += (goal - ic.scale) * k;
          if (!ic.arrivedAt) {
            ic.arrivedAt = now;
            ic.btn.classList.remove("is-orb"); // orb -> icon
          }
          if (now - ic.arrivedAt >= MORPH_SEC) {
            const dir = ic.mode;
            ic.travel = null;
            ic.arrivedAt = 0;
            if (dir === "in") {
              ic.mode = "active";
              syncPressed();
              fireWave(ic); // ...and THEN the wave
            } else {
              ic.mode = "drift";
              randomVelocity(ic);
              syncPressed();
            }
          }
        }
      }
    }

    // Drifting icons: soft mutual repulsion (steer apart before contact), a little
    // wander, capped speed. `solid` also includes travelling orbs so drifters yield.
    const drift = icons.filter((ic) => ic.mode === "drift");
    const solid = icons.filter(
      (ic) => ic.mode === "drift" || ic.mode === "in" || ic.mode === "out"
    );
    for (const ic of drift) {
      if (isFrozen(ic)) {
        ic.scale += (HOVER_SCALE - ic.scale) * k; // held still, swelling a touch under the pointer
        continue;
      }
      let ax = 0;
      let ay = 0;
      for (const o of solid) {
        if (o === ic) continue;
        const dx = ic.x - o.x;
        const dy = ic.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < repelR * repelR) {
          const d = Math.sqrt(d2);
          const f = 1 - d / repelR; // strongest at contact, zero at the radius
          ax += (dx / d) * f;
          ay += (dy / d) * f;
        }
      }
      ic.vx += ax * REPEL_ACCEL * dt + (Math.random() - 0.5) * WANDER * dt;
      ic.vy += ay * REPEL_ACCEL * dt + (Math.random() - 0.5) * WANDER * dt;
      const sp = Math.hypot(ic.vx, ic.vy) || 1;
      const cap = clamp(sp, MIN_SPEED, MAX_SPEED);
      ic.vx = (ic.vx / sp) * cap;
      ic.vy = (ic.vy / sp) * cap;
      ic.scale += (1 - ic.scale) * k;
    }
    for (const ic of drift) {
      if (isFrozen(ic)) continue; // frozen under the pointer — don't advance it
      ic.x += ic.vx * dt;
      ic.y += ic.vy * dt;
      // reflect off the band edges so nothing drifts out
      if (ic.x < xMin) (ic.x = xMin), (ic.vx = Math.abs(ic.vx));
      else if (ic.x > xMax) (ic.x = xMax), (ic.vx = -Math.abs(ic.vx));
      if (ic.y < yMin) (ic.y = yMin), (ic.vy = Math.abs(ic.vy));
      else if (ic.y > yMax) (ic.y = yMax), (ic.vy = -Math.abs(ic.vy));
    }

    // Hard guarantee against overlap: nudge any too-close pair apart. The repel
    // steering already keeps them slow on approach, so these corrections are tiny.
    for (let a = 0; a < drift.length; a++) {
      for (let b = a + 1; b < drift.length; b++) {
        const i = drift[a];
        const j = drift[b];
        const dx = j.x - i.x;
        const dy = j.y - i.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < minGap * minGap) {
          const d = Math.sqrt(d2);
          const gap = minGap - d;
          const ux = dx / d;
          const uy = dy / d;
          // A frozen (hovered) icon holds its ground; the other yields the full gap.
          const iFrozen = isFrozen(i);
          const jFrozen = isFrozen(j);
          if (iFrozen && jFrozen) continue;
          const iShare = jFrozen ? gap : gap / 2;
          const jShare = iFrozen ? gap : gap / 2;
          i.x -= ux * iShare;
          i.y -= uy * iShare;
          j.x += ux * jShare;
          j.y += uy * jShare;
        } else if (d2 === 0) {
          i.x -= 0.5;
          j.x += 0.5;
        }
      }
    }
    for (const ic of drift) {
      ic.x = clamp(ic.x, xMin, xMax);
      ic.y = clamp(ic.y, yMin, yMax);
    }

    for (const ic of icons) render(ic);
    updateTrail(now);
    updateSelectOrbs(dt, k);
  }

  let lastT = 0;
  let fieldRaf = 0;
  let fieldRunning = false;
  let ignited = false;

  function frame(t) {
    if (!fieldRunning) return;
    const now = t / 1000;
    const dt = lastT ? Math.min(0.05, now - lastT) : 1 / 60; // cap jumps after idle
    lastT = now;
    step(now, dt);
    fieldRaf = requestAnimationFrame(frame);
  }

  // Run the drift/animation loop only while the Home panel is visible and ignited.
  function startField() {
    if (fieldRunning || reducedMotion || !ignited) return;
    fieldRunning = true;
    lastT = 0; // reset the dt baseline so resuming doesn't jump
    fieldRaf = requestAnimationFrame(frame);
  }

  function stopField() {
    fieldRunning = false;
    cancelAnimationFrame(fieldRaf);
    resetHover(); // clear any hover held over from a keyboard tab-switch (no pointerleave)
  }

  // Drop all hover-selection state at once (used when the field stops). Without this,
  // leaving Home by keyboard leaves hoveredIc set — with no pointerleave to clear it —
  // so returning would spuriously freeze that icon and spin its orbs with no pointer on it.
  function resetHover() {
    hoveredIc = null;
    selectIc = null;
    selectFade = 0;
    if (glowIc) {
      glowIc.btn.classList.remove("is-hovered");
      glowIc = null;
    }
    for (const el of selectOrbs) el.style.opacity = "0";
  }

  field.addEventListener("click", (event) => {
    const button = event.target.closest(".type");
    if (!button) return;
    const ic = icons[buttons.indexOf(button)];
    if (ic.mode === "active") release(ic);
    else if (ic.mode === "drift") pick(ic); // ignore clicks mid-transit
    // A pointer click (detail > 0) shouldn't leave a focus ring lingering on the
    // icon; keyboard activation (detail === 0) keeps it for accessibility.
    if (event.detail) button.blur();
  });

  // Hover-to-select on the drifting icons: mark the one under a (real, non-touch)
  // pointer so step() freezes it and spins the selection orbs around it. The mode
  // gate lives in step(), so hovering the centred icon sets this but shows nothing.
  buttons.forEach((btn, idx) => {
    btn.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "touch") return; // no lingering hover state on touch
      hoveredIc = icons[idx];
    });
    btn.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      if (hoveredIc === icons[idx]) hoveredIc = null;
    });
  });

  // Reveal the icons and start the loop — the field side of "ignite". `onSettled` (if
  // given) fires once the load intro has finished and every icon is in the drift band.
  function ignite(onSettled) {
    if (ignited) return;
    ignited = true;
    field.classList.add("ready"); // reveal the icons + enable field clicks
    for (const b of buttons) b.removeAttribute("inert"); // expose them to AT now
    if (reducedMotion) {
      renderAll();
      if (onSettled) onSettled(); // no intro to wait on
    } else {
      startIntro();
      startField();
      if (onSettled) window.setTimeout(onSettled, introSettleSec * 1000);
    }
    // The igniter (which holds focus if it was activated by keyboard) is being
    // removed; hand focus to the first icon so keyboard users keep their place.
    buttons[0].focus();
  }

  // Re-fit after a window resize: re-measure, keep every icon/endpoint valid, and
  // retire the (now stale-positioned) trail dots.
  function onResize() {
    measureField();
    for (const ic of icons) {
      ic.hx = clamp(ic.hx, xMin, xMax);
      ic.hy = clamp(ic.hy, yMin, yMax);
      if (ic.mode === "drift") {
        ic.x = clamp(ic.x, xMin, xMax);
        ic.y = clamp(ic.y, yMin, yMax);
      } else if (ic.travel) {
        // keep travel endpoints valid: "in" tracks the (moved) page centre,
        // "out" stays inside the (resized) band.
        ic.travel.ex = ic.mode === "in" ? targetX : clamp(ic.travel.ex, xMin, xMax);
        ic.travel.ey = ic.mode === "in" ? targetY : clamp(ic.travel.ey, yMin, yMax);
      } else if (ic.burst) {
        ic.burst.ex = clamp(ic.burst.ex, iconR, fieldW - iconR);
        ic.burst.ey = clamp(ic.burst.ey, iconR, fieldH - iconR);
      }
    }
    for (const p of trail) {
      p.born = -1;
      p.el.style.opacity = "0";
    }
    if (reducedMotion) renderAll();
  }

  // One-time field setup: build the trail pool and hide the icons from AT until
  // they're revealed at ignite.
  initTrail();
  initSelectOrbs();
  for (const b of buttons) b.setAttribute("inert", "");

  return {
    measureField,
    seedIcons,
    renderAll,
    startField,
    stopField,
    ignite,
    onResize,
    isIgnited: () => ignited,
    getTarget: () => ({ x: targetX, y: targetY }),
  };
}
