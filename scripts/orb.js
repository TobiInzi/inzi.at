// Ignite orb (WebGL): a soft glossy rainbow "AI orb" on its own small transparent
// canvas — a flowing low-frequency hue field, spherical shading + a crisp rim and
// glossy highlight, fine film grain, and a faint pulsing halo. Hover/focus grows
// the orb (shader-side) and speeds up the colour drift.
import { VERT, makeProgram, setupFullscreenTriangle } from "./gl.js";

const FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  uniform vec2  u_res;
  uniform float u_time;
  uniform float u_dpr;
  uniform float u_hover;
  uniform float u_ctime; // colour-field time; runs faster while hovered
  uniform float u_charge; // 0..1 ignite load-up: brighter, tighter, faster drift

  vec3 hsv2rgb(vec3 c){
    vec3 k = abs(fract(c.x + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(k - 1.0, 0.0, 1.0), c.y);
  }

  void main(){
    vec2 p = (gl_FragCoord.xy * 2.0 - u_res) / min(u_res.x, u_res.y);
    float r = length(p);
    float t = u_time;

    // gentle size breathing; hover grows the ORB only (the halo below is anchored
    // to baseR, so the hover doesn't scale the glow with it)
    float baseR = 0.48 + 0.01 * sin(t * 0.55);
    float orbR = baseR * (1.0 + 0.12 * u_hover - 0.34 * u_charge); // tightens hard as it charges

    // colour-field time (accelerates on hover, integrated in JS so it never jumps)
    float ct = u_ctime;
    float rot = ct * 0.15;
    mat2 R = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
    vec2 q = R * p;

    // Smooth, low-frequency flowing hue field: the hue varies gently across the
    // orb and drifts over time. Because it's built from smooth sines (no competing
    // colour lobes that can tie and flip), the colours ALWAYS stay soft and
    // diffused — they never snap into hard seams — while still shifting over time.
    float n1 = sin(q.x * 2.0 + ct * 0.30) + sin(q.y * 1.7 - ct * 0.24 + 1.3);
    float n2 = sin((q.x + q.y) * 1.5 - ct * 0.20) + sin((q.x - q.y) * 1.3 + ct * 0.27);
    float hue = 0.5 + ct * 0.05 + 0.10 * (n1 + n2);
    float sat = 0.48 + 0.10 * sin((q.x - q.y) * 1.1 + ct * 0.15); // gentle pastel
    vec3 col = hsv2rgb(vec3(hue, sat, 1.0));

    // Sphere: fake a hemisphere normal for shading + a soft highlight.
    float rr = min(r / orbR, 1.0);
    float z = sqrt(max(0.0, 1.0 - rr * rr));
    vec3 n = vec3(p / orbR, z);
    float edge = smoothstep(orbR + 0.002, orbR - 0.012, r); // hard, just AA-soft

    // spherical volume shading — rounder/brighter toward the centre
    col *= 0.66 + 0.34 * z;

    // tight, bright glossy highlight (upper-left light) — a crisp spec spot
    vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
    col += pow(max(dot(n, L), 0.0), 14.0) * 0.5;

    // Charge-up brightening, ALL gated behind wc = charge³ so it stays near zero for
    // most of the load-up and only ramps in at the very end. For the bulk of the
    // charge the orb is just a plain rainbow that drifts faster and faster; only in
    // the final stretch does the rim flare, a white-hot core swell, and it white out.
    float wc = u_charge * u_charge * u_charge;
    col += pow(1.0 - z, 4.0) * edge * (0.28 + 0.7 * wc); // rim: extra shine only late
    col += pow(max(1.0 - rr, 0.0), 2.5) * wc * 2.6 * edge; // white-hot core, late
    col *= 1.0 + 0.85 * wc;

    // fine film grain at display-pixel scale (floor by u_dpr so it survives the
    // supersample downscale), on the sphere body only so the halo stays smooth:
    // high-frequency texture so the surface reads crisp, not soft-focus
    float g = fract(sin(dot(floor(gl_FragCoord.xy / u_dpr), vec2(12.9898, 78.233))) * 43758.5453);
    col += (g - 0.5) * 0.055 * edge;

    // Soft outer halo: a faint, mostly-WHITE bloom fading from the rim, anchored
    // to baseR and PULSATING in size. Whitening it strongly removes the orb's
    // colour seams from the glow so it reads as diffuse light, not a colour shell.
    float haloSpread = 0.16 + 0.06 * sin(t * 1.1);
    float halo = exp(-pow(max(r - baseR, 0.0) / haloSpread, 2.0)) * (1.0 - edge);
    col = mix(col, mix(col, vec3(1.0), 0.72), 1.0 - edge);
    float alpha = clamp(edge + halo * (0.10 + 0.20 * wc), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Boot the orb on its `.orb-gl` canvas inside `igniter`. Returns a handle with
// resize()/stop(), or null if WebGL is unavailable (caller shows the CSS
// fallback). Self-animates; under reduced motion it paints a single still frame.
export function initOrb(igniter, reducedMotion) {
  const canvas = igniter.querySelector(".orb-gl");
  const gl =
    canvas &&
    canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
  if (!gl) return null;

  // Program + uniform locations live in a (re)buildable function so we can recreate
  // them if the GL context is lost and later restored (mobile backgrounding, driver
  // reset, GPU switch) — otherwise the orb would go permanently blank.
  let prog;
  let uRes, uTime, uDpr, uHover, uCtime, uCharge;
  function buildProgram() {
    prog = makeProgram(gl, VERT, FRAG);
    if (!prog) return false;
    gl.useProgram(prog);
    setupFullscreenTriangle(gl, prog);
    uRes = gl.getUniformLocation(prog, "u_res");
    uTime = gl.getUniformLocation(prog, "u_time");
    uDpr = gl.getUniformLocation(prog, "u_dpr");
    uHover = gl.getUniformLocation(prog, "u_hover");
    uCtime = gl.getUniformLocation(prog, "u_ctime");
    uCharge = gl.getUniformLocation(prog, "u_charge");
    return true;
  }
  if (!buildProgram()) return null;

  // Hover/focus grows the orb (shader-side, so only the orb scales — not the
  // halo or the canvas). Eased toward the target each frame.
  let hover = 0;
  let hoverTarget = 0;
  // Ignite charge-up, driven externally via setCharge() (scripts/charge.js): eased
  // toward its target each frame so it ramps smoothly from calm orb to loaded core.
  let charge = 0;
  let chargeTarget = 0;
  // Once the charge begins, the hover size is frozen so the load-up shrink starts
  // from the (grown) hovered size instead of snapping back to the un-hovered size
  // when the pointer leaves. Hover changes are ignored from then on.
  let charging = false;
  const onEnter = () => {
    if (!charging) hoverTarget = 1;
  };
  const onLeave = () => {
    if (!charging) hoverTarget = 0;
  };
  igniter.addEventListener("pointerenter", onEnter);
  igniter.addEventListener("pointerleave", onLeave);
  igniter.addEventListener("focus", onEnter);
  igniter.addEventListener("blur", onLeave);

  // Render at >=2x the CSS size (capped at 3x) so the small orb is always super-
  // sampled — a crisp edge + smooth gradients instead of a soft, under-resolved
  // look — without ever upscaling on hi-DPI screens. Recomputed each resize so
  // moving the window to a different-density monitor re-samples correctly.
  let dpr = 2;
  const size = () => {
    dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const px = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.width = px;
    canvas.height = px;
    gl.viewport(0, 0, px, px);
  };

  const t0 = performance.now();
  let lastNow = t0;
  let ctime = 0; // colour-field time, integrated so a hover speed-up never jumps
  let contextLost = false; // pause rendering between context loss and restore
  const draw = () => {
    if (contextLost) return; // GL calls would spam errors while the context is gone
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    hover += (hoverTarget - hover) * 0.18; // ease toward hovered/un-hovered
    charge += (chargeTarget - charge) * 0.12; // ease toward the charge level
    // colour drift gets faster and faster as it charges (charge^2 so it ramps up,
    // not just up): calm normally, whirling by the time it's fully loaded
    ctime += dt * (1.0 + hover * 3.0 + charge * charge * 16.0);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uHover, hover);
    gl.uniform1f(uCtime, ctime);
    gl.uniform1f(uCharge, charge);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  let raf = 0;
  let running = true;

  // Context loss (mobile backgrounding, driver reset, GPU switch): pause while lost,
  // then rebuild the program + resize and repaint on restore. stop() removes these
  // before deliberately dropping the context, so teardown never schedules a rebuild.
  const onLost = (e) => {
    e.preventDefault(); // without this the browser never fires 'restored'
    contextLost = true;
  };
  const onRestored = () => {
    if (!running || !buildProgram()) return;
    size();
    contextLost = false;
    draw();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const loop = () => {
    if (!running) return;
    draw();
    raf = requestAnimationFrame(loop);
  };

  size();
  if (reducedMotion) draw(); // one still frame, no loop
  else loop();

  return {
    // Freeze the current (hovered/grown) size as the charge's starting point, so the
    // load-up shrink eases down from it with no snap back to the un-hovered size.
    // Call once, synchronously, at the moment ignite starts.
    beginCharge() {
      charging = true;
      hoverTarget = hover;
    },
    // Set the ignite charge level (0..1). Eased in the draw loop, so callers can
    // ramp it over time and the orb brightens + tightens smoothly toward it.
    setCharge(v) {
      chargeTarget = Math.min(1, Math.max(0, v));
    },
    resize() {
      size();
      draw();
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      igniter.removeEventListener("pointerenter", onEnter);
      igniter.removeEventListener("pointerleave", onLeave);
      igniter.removeEventListener("focus", onEnter);
      igniter.removeEventListener("blur", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    },
  };
}
