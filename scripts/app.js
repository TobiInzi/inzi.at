import { scaleDurations } from "./lib/motion.js";
import { PARTICLE_BURST } from "./scenes/particle-burst/config.js";
import { Orchestrator } from "./stage/orchestrator.js";
import { SCENES, TRANSITIONS } from "./stage/registry.js";
import { WATER_DROP } from "./transitions/water-drop/config.js";

scaleDurations([PARTICLE_BURST, WATER_DROP]);

const stage = document.querySelector("#stage");
const portfolio = document.querySelector("#portfolio");

if (!stage || !portfolio) {
  throw new Error("Missing #stage or #portfolio root element");
}

new Orchestrator({ stage, portfolio, scenes: SCENES, transitions: TRANSITIONS }).run();
