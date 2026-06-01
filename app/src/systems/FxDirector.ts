// FX Director — the one-shot FX seam (see app/docs/active/FX_SYSTEM.md).
//
// Owns a pool of FxInstances, a per-`kind` renderer registry, and a hard
// concurrency budget. `play(signal)` acquires an instance; `update(dt)` ticks
// every live FX, draws it from normalized progress t∈[0,1], and retires it to
// the pool at t≥1. Presentation-only — the sim calls `play` through a no-op-
// default dispatcher and never reads anything back (determinism preserved).
//
// A renderer is just `(fx, t, g) => void` — it draws the FX at progress t.
// This is the "redraw-from-t" technique the unit bob/swing/glow already use,
// lifted into a pooled, budgeted layer.

import Phaser from 'phaser';

/** Flat, ref-free payload the sim emits. `magnitude` (0..1+) scales the look. */
export interface FxSignal {
  kind: string;
  x: number;
  y: number;
  tx?: number;
  ty?: number;
  color?: number;
  magnitude?: number;
}

/** Live FX state — plain data so it pools cleanly (no allocation per play). */
export interface FxInstance {
  active: boolean;
  kind: string;
  elapsed: number;
  duration: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: number;
  magnitude: number;
}

/** Draw one FX at normalized progress `t`. */
export type FxRenderer = (fx: FxInstance, t: number, g: Phaser.GameObjects.Graphics) => void;

interface RendererDef {
  duration: number;
  draw: FxRenderer;
}

/** Budget: hard cap on simultaneous live FX. Over cap → evict the oldest. */
export const FX_MAX_CONCURRENT = 48;

export class FxDirector {
  private gfx: Phaser.GameObjects.Graphics;
  private renderers = new Map<string, RendererDef>();
  private pool: FxInstance[] = [];
  private live: FxInstance[] = [];

  constructor(gfx: Phaser.GameObjects.Graphics) {
    this.gfx = gfx;
  }

  /** Register a renderer for a `kind` with its default lifetime (seconds). */
  register(kind: string, duration: number, draw: FxRenderer): void {
    this.renderers.set(kind, { duration, draw });
  }

  /** Spawn an FX from a signal. Unknown kind → silently skipped (never throws). */
  play(signal: FxSignal): void {
    const def = this.renderers.get(signal.kind);
    if (!def) return;

    if (this.live.length >= FX_MAX_CONCURRENT) {
      const evicted = this.live.shift();
      if (evicted) {
        evicted.active = false;
        this.pool.push(evicted);
      }
    }

    const fx = this.pool.pop() ?? this.blank();
    fx.active = true;
    fx.kind = signal.kind;
    fx.elapsed = 0;
    fx.duration = def.duration;
    fx.x = signal.x;
    fx.y = signal.y;
    fx.tx = signal.tx ?? signal.x;
    fx.ty = signal.ty ?? signal.y;
    fx.color = signal.color ?? 0xffffff;
    fx.magnitude = signal.magnitude ?? 0;
    this.live.push(fx);
  }

  /** Tick + draw every live FX; retire finished ones to the pool. */
  update(dt: number): void {
    const g = this.gfx;
    g.clear();
    for (let i = this.live.length - 1; i >= 0; i--) {
      const fx = this.live[i];
      fx.elapsed += dt;
      const t = fx.duration > 0 ? fx.elapsed / fx.duration : 1;
      if (t >= 1) {
        fx.active = false;
        this.live.splice(i, 1);
        this.pool.push(fx);
        continue;
      }
      this.renderers.get(fx.kind)?.draw(fx, t, g);
    }
  }

  /** Drop all live FX (battle reset). */
  reset(): void {
    for (const fx of this.live) {
      fx.active = false;
      this.pool.push(fx);
    }
    this.live.length = 0;
    this.gfx.clear();
  }

  private blank(): FxInstance {
    return { active: false, kind: '', elapsed: 0, duration: 0, x: 0, y: 0, tx: 0, ty: 0, color: 0xffffff, magnitude: 0 };
  }
}
