export const PARTICLE_BURST = {
  mainText: "click to start",
  subText: "refresh for new colors",
  particleCount: 20,
  warmupMs: 2600,
  gatherMs: 2300,
  collideMs: 1450,
  explodeMs: 650,
  trailMs: 850,
  trailEveryMs: 250,
  cursorParticleLifeMs: 520,
  cursorParticleMax: 36,
  cursorSpawnEveryMs: 34,
  cursorActiveMs: 140,
  circleFillDelayMs: 430,
  circleFillMs: 1850,
  letterSwallowDelayMs: 850,
  exitMs: 1850,
};

// Palettes are a flavour of this one animation, not a global theme:
// a fresh one is picked at random every time the scene starts.
export const PALETTES = [
  {
    name: "ember",
    pageBg: "#0d090a",
    mainColor: "#e84d36",
    textOnMain: "#050505",
  },
  {
    name: "moss",
    pageBg: "#07110c",
    mainColor: "#62d383",
    textOnMain: "#050505",
  },
  {
    name: "glacier",
    pageBg: "#071015",
    mainColor: "#69d7ef",
    textOnMain: "#050505",
  },
  {
    name: "sunset",
    pageBg: "#150b0f",
    mainColor: "#ff9f5a",
    textOnMain: "#050505",
  },
];
