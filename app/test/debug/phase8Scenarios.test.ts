import { describe, it, expect, beforeEach } from 'vitest';
import {
  unregisterAllScenarios,
  listScenarios,
} from '../../src/debug/scenarioEngine';
import { registerPhase8Scenarios } from '../../src/debug/phase8Scenarios';

// Phase-scoped cleanup pin. Adding a scenario without updating the
// kickoff/exit report, or forgetting to delete a scenario when the
// set shrinks, trips this test immediately. Mirrors the phase7b
// pattern deleted at Stage 1 of Phase 8.
describe('phase8Scenarios — cleanup enforcement', () => {
  beforeEach(() => {
    unregisterAllScenarios();
  });

  it('registers exactly the documented twelve scenarios', () => {
    // Phase 8 Stage 5 Task 1 (2026-04-16) added `stage5AllComplex`
    // as the stage-close consolidated smoke scenario per the
    // 2026-04-15 smoke discipline revision.
    registerPhase8Scenarios();
    const names = listScenarios().map((s) => s.name).sort();
    expect(names).toEqual([
      'bashguardKnockback',
      'bombardierDeath',
      'centurionRallyMulti',
      'legionnaireMigration',
      'longeyePierce',
      'mendwingHeal',
      'phase7bParity',
      'ravagerBerserk',
      'stage4AllPassives',
      'stage5AllComplex',
      'stormflyChain',
      'wardlingAura',
    ]);
  });

  it('every registered scenario carries a non-empty description', () => {
    registerPhase8Scenarios();
    for (const s of listScenarios()) {
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
});
