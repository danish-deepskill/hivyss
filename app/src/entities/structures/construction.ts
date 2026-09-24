// Pure construction-progress math — no Phaser, headless-testable. The Building
// (a Phaser Container) and the Buildings manager both step progress through this
// so the build-time is honest + framerate-independent, and tests can pin it.

export interface ConstructionStep {
  /** New progress, clamped to [0, 1]. */
  progress: number;
  /** True once progress reaches 1. */
  complete: boolean;
}

/**
 * Advance construction by `dt` seconds of builder-work. A building completes
 * after `buildTime` total seconds of work (so one builder finishes it in
 * `buildTime`s of adjacency). Clamps to 1; `buildTime <= 0` completes instantly.
 */
export function advanceConstruction(progress: number, dt: number, buildTime: number): ConstructionStep {
  const next = buildTime > 0 ? Math.min(1, progress + dt / buildTime) : 1;
  return { progress: next, complete: next >= 1 };
}
