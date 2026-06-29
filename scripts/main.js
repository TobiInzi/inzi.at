// Accent type selector: pick a type to tint the site, click it again to clear.
const STAGGER_MS = 55; // entrance delay between consecutive icons
const SETTLE_MS = 800; // pause after the last icon before the delays are cleared

const root = document.documentElement;
const palette = document.querySelector(".palette");
const buttons = [...palette.querySelectorAll(".type")];

// --- Background nebula (WebGL) ---------------------------------------------
// A full-screen fragment shader paints slow, drifting gradient blobs tinted by
// the selected type color (nothing selected = no blobs, just dark space).
// Switching color isn't instant: a SHOCKWAVE expands from the center of the
// palette (where the picked icon lands) and repaints the field behind its front.
const NONE_COLOR = [0.0, 0.0, 0.0]; // no selection -> blobs vanish, just dark space
const WAVE_DURATION = 1.1; // seconds for the shockwave to cross the screen
const WAVE_MAX_R = 1.7; // front radius (aspect-corrected uv) that covers the page
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
let nebula = null; // set by initNebula(); null if WebGL is unavailable

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
}

const NEBULA_VERT = `
  attribute vec2 a;
  void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const NEBULA_FRAG = `
  precision highp float;
  uniform vec2  u_res;
  uniform float u_time;
  uniform vec3  u_colorOld;   // tint outside the shockwave front
  uniform vec3  u_colorNew;   // tint inside (already passed by) the front
  uniform vec2  u_waveOrigin; // wave centre, uv (y-up)
  uniform float u_waveRadius; // current front radius; huge = no active wave

  // soft round blob (gaussian falloff), aspect-corrected so it stays circular
  float blob(vec2 uv, vec2 c, float r, float aspect){
    vec2 d = uv - c;
    d.x *= aspect;
    return exp(-dot(d, d) / (r * r));
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / u_res;
    float aspect = u_res.x / u_res.y;
    float t = u_time * 0.16; // slow ambient flow

    // gradient blobs of mixed sizes drifting on smooth looping paths, each also
    // gently breathing its radius so the field morphs like space flow. One big
    // soft one gives some gentle coverage; mediums carry the character; a couple
    // of small ones add detail. A faint ambient floor keeps the gaps from going
    // completely black, but kept low so there's real light/dark variation.
    float f = 0.035;
    // one large, soft coverage blob (just enough so voids aren't harsh)
    f += 0.26 * blob(uv, vec2(0.40 + 0.08*sin(t*0.41),       0.45 + 0.07*cos(t*0.37)),       0.37 + 0.05*sin(t*0.24),       aspect);
    // medium blobs (the main character)
    f += 0.50 * blob(uv, vec2(0.22 + 0.10*sin(t*0.70),       0.30 + 0.08*cos(t*0.62)),       0.25 + 0.04*sin(t*0.40),       aspect);
    f += 0.48 * blob(uv, vec2(0.80 + 0.11*sin(t*0.53 + 1.7), 0.27 + 0.09*cos(t*0.81 + 0.5)), 0.24 + 0.05*sin(t*0.33 + 2.0), aspect);
    f += 0.50 * blob(uv, vec2(0.63 + 0.12*sin(t*0.46 + 3.1), 0.72 + 0.08*cos(t*0.58 + 2.0)), 0.26 + 0.04*sin(t*0.37 + 1.0), aspect);
    f += 0.46 * blob(uv, vec2(0.85 + 0.09*sin(t*0.69 + 2.3), 0.62 + 0.08*cos(t*0.74 + 3.4)), 0.23 + 0.04*sin(t*0.31 + 0.7), aspect);
    f += 0.44 * blob(uv, vec2(0.30 + 0.11*sin(t*0.58 + 0.9), 0.66 + 0.09*cos(t*0.66 + 2.6)), 0.22 + 0.05*sin(t*0.35 + 1.5), aspect);
    // small detail blobs
    f += 0.42 * blob(uv, vec2(0.12 + 0.10*sin(t*0.60 + 5.0), 0.52 + 0.08*cos(t*0.49 + 0.2)), 0.16 + 0.04*sin(t*0.27 + 2.4), aspect);
    f += 0.42 * blob(uv, vec2(0.55 + 0.10*sin(t*0.51 + 2.8), 0.42 + 0.10*cos(t*0.72 + 4.1)), 0.17 + 0.04*sin(t*0.39 + 0.3), aspect);

    // soft saturating response (Reinhard): however many blobs overlap, the
    // colour rolls off toward a ceiling instead of clamping to a flat vivid
    // wash -> dense pile-ups stay tame, gaps keep a faint glow.
    float v = f / (f + 0.9);

    // shockwave: distance from the wave origin (aspect-corrected so it's round).
    // Behind the front (dist < radius) the new tint has taken over; ahead it is
    // still the old one. A bright rim rides the front itself.
    vec2 wd = uv - u_waveOrigin;
    wd.x *= aspect;
    float wdist = length(wd);
    float passed = 1.0 - smoothstep(u_waveRadius - 0.07, u_waveRadius, wdist);
    vec3 tint = mix(u_colorOld, u_colorNew, passed);

    // dark space: near-black base, the tint pools softly where the blobs gather.
    // Mild pow(v,1.1) keeps the lows down without crushing them to black; the
    // Reinhard ceiling above already caps how vivid dense regions can get.
    vec3 base = vec3(0.02, 0.02, 0.028);
    vec3 col = base + tint * pow(v, 1.1) * 0.46;

    // the shockwave rim — a soft expanding ring of the new color
    float ring = exp(-pow((wdist - u_waveRadius) / 0.05, 2.0));
    col += u_colorNew * ring * (0.12 + v * 0.5);

    // gentle vignette + dither to kill banding
    vec2 g = uv - 0.5;
    col *= 1.0 - 0.55 * dot(g, g);
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.01;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

// Convert the palette's centre (where the active icon lands) to shader uv,
// flipping y because gl_FragCoord is bottom-up.
function paletteOriginUv() {
  const rect = palette.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return [cx / window.innerWidth, 1 - cy / window.innerHeight];
}

// Run `done` once the icon has finished travelling to the centre. A token guards
// against a newer selection (or a clear) superseding this one mid-flight.
let arrivalToken = 0;
function whenCentered(button, done) {
  const token = ++arrivalToken;
  if (reducedMotion) {
    done();
    return;
  }
  const onEnd = (event) => {
    if (event.propertyName !== "transform") return;
    button.removeEventListener("transitionend", onEnd);
    if (token === arrivalToken) done();
  };
  button.addEventListener("transitionend", onEnd);
}

// Evenly space the non-centered icons around the ring in canonical (DOM) order,
// so it stays a full circle with no gap whether 11 or 10 are on the ring.
function layoutCircle() {
  const ring = buttons.filter((b) => !b.classList.contains("is-active"));
  ring.forEach((b, i) =>
    b.style.setProperty("--a", `${(i / ring.length) * 360}deg`)
  );
}

function setActive(active) {
  for (const button of buttons) {
    const isActive = button === active;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
  layoutCircle();
}

function select(button) {
  setActive(button);
  const color = button.style.getPropertyValue("--type-color").trim();
  // Wait for the icon to reach the centre, then send the shockwave out from it.
  whenCentered(button, () => {
    root.style.setProperty("--accent", color);
    root.classList.add("has-accent");
    if (nebula) nebula.startWave(paletteOriginUv(), hexToRgb(color));
  });
}

function clear() {
  setActive(null);
  // The icon leaves the centre; wash the colour away with a wave from there.
  arrivalToken++; // cancel any pending arrival
  root.style.removeProperty("--accent");
  root.classList.remove("has-accent");
  if (nebula) nebula.startWave(paletteOriginUv(), NONE_COLOR);
}

// Default circle layout (no selection).
layoutCircle();

// Reveal: wait until every logo has loaded, then expand them into the circle.
const imgs = buttons.map((b) => b.querySelector("img"));
buttons.forEach((b, i) => b.style.setProperty("--d", `${i * STAGGER_MS}ms`));

Promise.all(
  imgs.map((img) =>
    img.complete ? Promise.resolve() : img.decode().catch(() => {})
  )
).then(() => {
  palette.classList.add("ready");
  // Once the staggered entrance is done, clear the per-icon delays so later
  // re-layouts (selecting/clearing a type) animate immediately.
  const settle = buttons.length * STAGGER_MS + SETTLE_MS;
  window.setTimeout(() => {
    buttons.forEach((b) => b.style.setProperty("--d", "0ms"));
  }, settle);
});

palette.addEventListener("click", (event) => {
  const button = event.target.closest(".type");
  if (!button) return;

  if (button.classList.contains("is-active")) {
    clear();
  } else {
    select(button);
  }
});

// Section switching via an ARIA tab interface: the tabs swap the visible panel
// in the main area and reset its scroll position. Arrow / Home / End keys move
// between tabs with automatic activation and a roving tabindex.
const tablist = document.querySelector(".sections");
const tabs = [...tablist.querySelectorAll(".section-link")];
const panels = [...document.querySelectorAll(".panel")];
const content = document.querySelector(".content");

function showSection(id) {
  for (const tab of tabs) {
    const selected = tab.dataset.section === id;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of panels) {
    const active = panel.dataset.section === id;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }
  content.scrollTop = 0;
}

tablist.addEventListener("click", (event) => {
  const tab = event.target.closest(".section-link");
  if (!tab) return;
  showSection(tab.dataset.section);
});

tablist.addEventListener("keydown", (event) => {
  const index = tabs.indexOf(document.activeElement);
  if (index === -1) return;

  let nextIndex;
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
      nextIndex = (index + 1) % tabs.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      nextIndex = (index - 1 + tabs.length) % tabs.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = tabs.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  const nextTab = tabs[nextIndex];
  showSection(nextTab.dataset.section);
  nextTab.focus();
});

// Boot the background nebula: compile the shader, paint one frame immediately,
// then animate it (unless reduced motion). The browser pauses rAF while the tab
// is hidden, so the loop idles on its own.
function initNebula() {
  const canvas = document.getElementById("bg");
  const gl =
    canvas &&
    canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
  if (!gl) return null; // graceful: the body's --bg color shows through

  const compile = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      console.error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, NEBULA_VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, NEBULA_FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uColorOld = gl.getUniformLocation(prog, "u_colorOld");
  const uColorNew = gl.getUniformLocation(prog, "u_colorNew");
  const uWaveOrigin = gl.getUniformLocation(prog, "u_waveOrigin");
  const uWaveRadius = gl.getUniformLocation(prog, "u_waveRadius");

  const SCALE = 0.6; // render below CSS resolution; the soft field hides it
  let w = 0;
  let h = 0;
  const resize = () => {
    w = Math.max(1, Math.round(window.innerWidth * SCALE));
    h = Math.max(1, Math.round(window.innerHeight * SCALE));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  };
  resize();
  window.addEventListener("resize", resize);

  let displayed = [...NONE_COLOR]; // steady-state tint (everything, post-wave)
  let wave = null; // { origin, old, next, start } while a shockwave is crossing

  const draw = (time) => {
    let oldC = displayed;
    let newC = displayed;
    let origin = [0.5, 0.5];
    let radius = 100.0; // huge -> "wave already everywhere", no rim
    if (wave) {
      const progress = (time - wave.start) / WAVE_DURATION;
      if (progress >= 1) {
        displayed = wave.next; // wave finished: new tint is now everywhere
        wave = null;
        // Paint the settled tint THIS frame too: oldC/newC were captured from
        // the previous `displayed` above, so without this the completion frame
        // would flash the OLD colour across the whole screen for one frame.
        oldC = displayed;
        newC = displayed;
      } else {
        oldC = wave.old;
        newC = wave.next;
        origin = wave.origin;
        radius = progress * WAVE_MAX_R;
      }
    }
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, time);
    gl.uniform3f(uColorOld, oldC[0], oldC[1], oldC[2]);
    gl.uniform3f(uColorNew, newC[0], newC[1], newC[2]);
    gl.uniform2f(uWaveOrigin, origin[0], origin[1]);
    gl.uniform1f(uWaveRadius, radius);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const now = () => performance.now() / 1000;
  draw(now()); // one frame up front (covers first paint + reduced motion)

  if (!reducedMotion) {
    const frame = () => {
      draw(now());
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  return {
    // Launch a shockwave from `origin` (uv) that repaints the field to `next`.
    // Under reduced motion there's no loop, so just swap the tint and redraw.
    startWave(origin, next) {
      if (reducedMotion) {
        displayed = next.slice();
        wave = null;
        draw(now());
        return;
      }
      const current = wave ? wave.next : displayed;
      wave = { origin, old: current.slice(), next: next.slice(), start: now() };
    },
  };
}

nebula = initNebula();

// Freeze the page animations/transitions while the tab is hidden.
document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("frozen", document.hidden);
});
