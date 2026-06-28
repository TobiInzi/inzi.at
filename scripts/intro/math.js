export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2;
}

export function easeInOutSine(progress) {
  return -(Math.cos(Math.PI * progress) - 1) / 2;
}

export function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const item = shuffled[index];

    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = item;
  }

  return shuffled;
}
