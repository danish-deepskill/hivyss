import { describe, it, expect } from 'vitest';
import { recalcify } from '../../../src/config/combat/recalcify';

describe('recalcify', () => {
  it('steps a degraded tier one rung back toward base', () => {
    // base stronger, degraded to strong → recovers one rung to stronger
    const r = recalcify({ sharp: 'strong', blunt: 'strong' }, { sharp: 'stronger', blunt: 'stronger' });
    expect(r.sharp).toBe('stronger');
    expect(r.blunt).toBe('stronger');
  });

  it('only steps ONE rung per pulse (not a full restore)', () => {
    // base strongest, degraded all the way to normal → one rung up to strong
    const r = recalcify({ sharp: 'normal' }, { sharp: 'strongest' });
    expect(r.sharp).toBe('strong');
  });

  it('never over-shoots base (already at base → unchanged)', () => {
    const r = recalcify({ sharp: 'stronger', blunt: 'stronger' }, { sharp: 'stronger', blunt: 'stronger' });
    expect(r.sharp).toBe('stronger');
    expect(r.blunt).toBe('stronger');
  });

  it('never over-shoots base (above base, e.g. external buff → unchanged)', () => {
    const r = recalcify({ sharp: 'strongest' }, { sharp: 'stronger' });
    expect(r.sharp).toBe('strongest');
  });

  it('leaves undefined (no-resistance) tiers alone', () => {
    const r = recalcify({ sharp: undefined, blunt: 'strong' }, { sharp: undefined, blunt: 'stronger' });
    expect(r.sharp).toBeUndefined();
    expect(r.blunt).toBe('stronger');
  });

  it('handles a base entry with no current entry (undefined stays undefined)', () => {
    const r = recalcify({ blunt: 'strong' }, { sharp: 'stronger', blunt: 'stronger' });
    expect(r.sharp).toBeUndefined();
    expect(r.blunt).toBe('stronger');
  });
});
