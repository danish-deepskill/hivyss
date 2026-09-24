import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/systems/EventBus';
import { TerrainSystem } from '../../src/systems/TerrainSystem';
import { setDotDispatcher } from '../../src/config/combat/effects/dispatch';
import type { IUnit, Element, Route } from '../../src/types';

// Plain-object units — TerrainSystem reads only id/x/unitW/currentRoute/dead/
// activeEffects/catalyst, so a literal shape (cast) is enough. No Phaser.
function unit(id: number, x: number, opts: Partial<IUnit> = {}): IUnit {
  return {
    id, x, unitW: 20, currentRoute: 'land' as Route, dead: false, activeEffects: [],
    ...opts,
  } as unknown as IUnit;
}

const hasEffect = (u: IUnit, name: string) =>
  (u.activeEffects ?? []).some((e) => e.def.name === name);

const lay = (events: EventBus, route: Route, x: number, element: Element) =>
  events.emit('terrainApply', { route, x, element });

describe('TerrainSystem', () => {
  let events: EventBus;
  let units: IUnit[];
  let terrain: TerrainSystem;
  let dotCalls: Array<{ dmg: number }>;

  beforeEach(() => {
    events = new EventBus();
    units = [];
    terrain = new TerrainSystem(events, 2560, units);
    dotCalls = [];
    setDotDispatcher((_a, _t, dmg) => { dotCalls.push({ dmg }); });
  });

  afterEach(() => {
    terrain.destroy();
    setDotDispatcher(null);
  });

  describe('getEffect', () => {
    it('is null on empty terrain', () => {
      expect(terrain.getEffect('land', 300)).toBeNull();
    });

    it('reports a chitin wall as blocking', () => {
      lay(events, 'land', 300, 'chitin');
      expect(terrain.getEffect('land', 300)?.block).toBe(true);
    });

    it('reports acid flood as slow + DoT', () => {
      lay(events, 'land', 300, 'acid');
      const te = terrain.getEffect('land', 300);
      expect(te?.slowPct).toBe(30);
      expect(te?.dot).toEqual({ type: 'toxic', dps: 6 });
    });

    it('is per-route (a land flood does not exist on air)', () => {
      lay(events, 'land', 300, 'acid');
      expect(terrain.getEffect('air', 300)).toBeNull();
    });
  });

  describe('decay tick', () => {
    it('clears a flood after its ttl and emits terrainChanged', () => {
      lay(events, 'land', 300, 'acid'); // ttl 8
      let cleared = false;
      events.on('terrainChanged', (e) => { if (e.cell.state === 'empty') cleared = true; });
      terrain.update(9);
      expect(terrain.getEffect('land', 300)).toBeNull();
      expect(cleared).toBe(true);
    });

    it('leaves a permanent wall standing', () => {
      lay(events, 'land', 300, 'chitin'); // ttl Infinity
      terrain.update(100);
      expect(terrain.getEffect('land', 300)?.block).toBe(true);
    });
  });

  describe('reaction pulses', () => {
    it('electrify-flood stuns + shocks every unit in the segment', () => {
      const victim = unit(1, 300);
      units.push(victim);
      lay(events, 'land', 300, 'acid'); // flood the cell
      lay(events, 'land', 300, 'nerve'); // catalyze it

      expect(hasEffect(victim, 'stun')).toBe(true);
      expect(dotCalls.some((c) => c.dmg === 30)).toBe(true);
    });

    it('does not pulse units on a different route', () => {
      const flyer = unit(2, 300, { currentRoute: 'air' });
      units.push(flyer);
      lay(events, 'land', 300, 'acid');
      lay(events, 'land', 300, 'nerve');
      expect(hasEffect(flyer, 'stun')).toBe(false);
    });
  });

  describe('resistance scaling (delta #3)', () => {
    it('scales DoT by the unit resistance tier (acid)', () => {
      // 'strongest' toxic → 0.1× → ~0.6 dps → ~0 over 1s (an Acidwell in its own brew).
      const tough = unit(1, 300);
      (tough as { resistance?: unknown }).resistance = { toxic: 'strongest' };
      lay(events, 'land', 300, 'acid'); // 6 dps base
      for (let i = 0; i < 60; i++) terrain.tickUnits([tough], 1 / 60);
      expect(dotCalls.reduce((s, c) => s + c.dmg, 0)).toBeLessThanOrEqual(1);

      // 'weak' toxic → 1.25× → ~7.5 dps → the soft unit takes the extra.
      dotCalls.length = 0;
      const soft = unit(2, 300);
      (soft as { resistance?: unknown }).resistance = { toxic: 'weak' };
      for (let i = 0; i < 60; i++) terrain.tickUnits([soft], 1 / 60);
      expect(dotCalls.reduce((s, c) => s + c.dmg, 0)).toBeGreaterThanOrEqual(6);
    });

    it('scales burst pulse damage by resistance (electric)', () => {
      const tough = unit(1, 300);
      (tough as { resistance?: unknown }).resistance = { electric: 'strongest' }; // 0.1×
      units.push(tough);
      lay(events, 'land', 300, 'acid');
      lay(events, 'land', 300, 'nerve'); // electrify → 30 electric burst → floor(30*0.1)=3
      expect(dotCalls.some((c) => c.dmg === 3)).toBe(true);
    });
  });

  describe('passive DoT (tickUnits)', () => {
    it('damages a unit standing in the flood', () => {
      units.push(unit(1, 300));
      lay(events, 'land', 300, 'acid');
      terrain.tickUnits(units, 1); // 1s in 6 dps acid
      expect(dotCalls.some((c) => c.dmg === 6)).toBe(true);
    });

    it('keeps dps framerate-independent (accumulates whole chunks, no floor inflation)', () => {
      units.push(unit(1, 300));
      lay(events, 'land', 300, 'acid'); // 6 dps
      for (let i = 0; i < 60; i++) terrain.tickUnits(units, 1 / 60); // 1 second @ 60fps
      const total = dotCalls.reduce((s, c) => s + c.dmg, 0);
      expect(total).toBeGreaterThanOrEqual(5); // ≈ 6 dps, NOT 60 (the per-frame floor bug)
      expect(total).toBeLessThanOrEqual(6);
    });
  });

  describe('catalyst (cell-entry)', () => {
    it('electrifies a flood the catalyst walks into', () => {
      const spark = unit(1, 100, { catalyst: 'nerve' as Element }); // seg 0
      const victim = unit(2, 300); // seg 2, in the flood
      units.push(spark, victim);
      lay(events, 'land', 300, 'acid');

      terrain.tickUnits(units, 0.016); // first sight at seg 0 — records, no fire
      expect(hasEffect(victim, 'stun')).toBe(false);

      spark.x = 300; // walked into the flood segment
      terrain.tickUnits(units, 0.016);
      expect(hasEffect(victim, 'stun')).toBe(true);
    });
  });

  describe('shaper onReach', () => {
    it('lays terrain forward on first attack only — not while marching, once', () => {
      const shaper = unit(1, 500, {
        facing: 1,
        range: 18,
        terrainAbility: { element: 'acid', trigger: 'onReach' },
      });
      shaper.state = 'march';
      units.push(shaper);

      // Marching toward the front — nothing laid yet.
      terrain.tickUnits(units, 0.016);
      expect(shaper._terrainLaid).toBeFalsy();
      expect(terrain.getEffect('land', 550)).toBeNull();

      // Engages (attack state) — lays acid FORWARD of itself (cx 510 → ~550),
      // toward the enemy, NOT under/behind the shaper. Latched.
      shaper.state = 'attack';
      terrain.tickUnits(units, 0.016);
      expect(shaper._terrainLaid).toBe(true);
      expect(terrain.getEffect('land', 550)?.dot).toEqual({ type: 'toxic', dps: 6 }); // forward
      expect(terrain.getEffect('land', 460)).toBeNull(); // not behind/at the shaper
    });
  });

  describe('corpse footprint', () => {
    it('lays the dead unit element where it fell', () => {
      events.emit('unitDied', { key: 'x', side: 'enemy', x: 300, y: 0, route: 'land', element: 'acid' });
      expect(terrain.getEffect('land', 300)?.dot).toEqual({ type: 'toxic', dps: 6 });
    });

    it('ignores deaths with no terrain affinity', () => {
      events.emit('unitDied', { key: 'x', side: 'enemy', x: 300, y: 0 });
      expect(terrain.getEffect('land', 300)).toBeNull();
    });
  });
});
