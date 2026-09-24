import { describe, it, expect } from 'vitest';
import { degradeArmor } from '../../../src/config/combat/armorDegrade';

describe('degradeArmor', () => {
  it('drops one physical tier per `per` damage soaked', () => {
    const r = degradeArmor('stronger', 'stronger', 40, 40);
    expect(r.sharp).toBe('strong'); // stronger → strong
    expect(r.blunt).toBe('strong');
    expect(r.wear).toBe(0);
  });

  it('drops multiple tiers for a big soak, clamped at normal', () => {
    const r = degradeArmor('stronger', 'stronger', 200, 40);
    expect(r.sharp).toBe('normal'); // stronger → strong → normal, then stops
    expect(r.blunt).toBe('normal');
  });

  it('never degrades below normal (strips, never weakens)', () => {
    const r = degradeArmor('normal', 'normal', 1000, 10);
    expect(r.sharp).toBe('normal');
    expect(r.blunt).toBe('normal');
  });

  it('retains sub-threshold wear', () => {
    const r = degradeArmor('strong', 'strong', 25, 40);
    expect(r.sharp).toBe('strong');
    expect(r.wear).toBe(25);
  });

  it('leaves undefined (no-resistance) tiers alone', () => {
    const r = degradeArmor(undefined, 'strong', 100, 40);
    expect(r.sharp).toBeUndefined();
    expect(r.blunt).toBe('normal');
  });

  it('no-ops on per <= 0', () => {
    const r = degradeArmor('stronger', 'stronger', 100, 0);
    expect(r.sharp).toBe('stronger');
    expect(r.wear).toBe(100);
  });
});
