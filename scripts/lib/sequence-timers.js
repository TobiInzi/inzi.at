export class SequenceTimers {
  #timers = new Map();

  set(name, callback, delay) {
    this.clear(name);
    this.#timers.set(name, {
      callback,
      id: 0,
      remaining: delay,
      startedAt: 0,
    });
    this.#resumeTimer(name);
  }

  clear(name) {
    const timer = this.#timers.get(name);

    if (!timer) {
      return;
    }

    window.clearTimeout(timer.id);
    this.#timers.delete(name);
  }

  clearAll() {
    for (const name of [...this.#timers.keys()]) {
      this.clear(name);
    }
  }

  pause() {
    const now = performance.now();

    for (const timer of this.#timers.values()) {
      if (timer.id === 0) {
        continue;
      }

      window.clearTimeout(timer.id);
      timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
      timer.id = 0;
    }
  }

  resume() {
    for (const name of this.#timers.keys()) {
      this.#resumeTimer(name);
    }
  }

  #resumeTimer(name) {
    const timer = this.#timers.get(name);

    if (!timer || timer.id !== 0) {
      return;
    }

    timer.startedAt = performance.now();
    timer.id = window.setTimeout(() => {
      this.#timers.delete(name);
      timer.callback();
    }, timer.remaining);
  }
}
