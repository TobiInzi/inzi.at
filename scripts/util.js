// Small shared helpers for the animation modules (field, contact, cursor). Kept
// dependency-free — just the maths + colour parsing that would otherwise be
// copy-pasted into each effect and drift out of sync.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
export const nowSec = () => performance.now() / 1000;

// Smoothstep ease (0..1): gentle in and out — orb flights, trails, contact arcs.
export const easeInOut = (t) => t * t * (3 - 2 * t);
// Cubic ease-out (0..1): fast then decelerating.
export const easeOut = (t) => 1 - (1 - t) ** 3;

// "#009e59" -> [r, g, b] as 0..1 floats, for WebGL colour uniforms.
export function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
}

// "#009e59" -> "0, 158, 89" (to splice into rgba() strings); null if unparsable.
export function hexToRgbStr(hex) {
  const v = (hex || "").replace("#", "").trim();
  if (v.length < 6) return null;
  const n = parseInt(v.slice(0, 6), 16);
  return Number.isNaN(n) ? null : `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
