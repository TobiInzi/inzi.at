import { particleBurstScene } from "../scenes/particle-burst/index.js";
import { waterDropTransition } from "../transitions/water-drop/index.js";

// Stage 1: starting animations. Each ends on a solid colour background.
// Add a new one by registering its module here.
export const SCENES = [particleBurstScene];

// Stage 2: transitions that run on top of the solid colour and end on black.
export const TRANSITIONS = [waterDropTransition];
