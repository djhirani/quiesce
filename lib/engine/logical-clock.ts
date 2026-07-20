export class LogicalClock {
  #timeMs: number;

  constructor(initialTimeMs = 0) {
    if (!Number.isSafeInteger(initialTimeMs) || initialTimeMs < 0) {
      throw new Error("Logical time must be a non-negative safe integer.");
    }
    this.#timeMs = initialTimeMs;
  }

  now(): number {
    return this.#timeMs;
  }

  tick(deltaMs: number): number {
    if (!Number.isSafeInteger(deltaMs) || deltaMs <= 0) {
      throw new Error("Clock ticks must be positive safe integers.");
    }
    this.#timeMs += deltaMs;
    return this.#timeMs;
  }
}
