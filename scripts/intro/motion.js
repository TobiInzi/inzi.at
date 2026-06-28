const REDUCED_MOTION_SCALE = 0.05;

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scaleDurations(configs) {
  if (!prefersReducedMotion()) {
    return;
  }

  for (const config of configs) {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === "number" && key.endsWith("Ms")) {
        config[key] *= REDUCED_MOTION_SCALE;
      }
    }
  }
}
