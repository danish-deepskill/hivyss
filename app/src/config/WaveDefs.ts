import type { WaveDef } from '../types';

// Wave compositions
// Each wave: units array (enemy keys = 'e' + player unit key) + spawn interval
export const WAVE_DEFS: WaveDef[] = [
  // --- Waves 1-10 ---
  { units: ['egrub', 'egrub', 'egrub'], interval: 3 },
  { units: ['egrub', 'emandible', 'egrub', 'emandible'], interval: 2.8 },
  { units: ['emandible', 'emandible', 'eneedler', 'emandible'], interval: 2.5 },
  { units: ['elegionnaire', 'egrub', 'egrub', 'emandible', 'emandible'], interval: 2.5 },
  { units: ['eskitterling', 'eskitterling', 'ebombardier', 'emandible'], interval: 2.2 },
  { units: ['eneedler', 'eneedler', 'elegionnaire', 'emandible'], interval: 2.2 },
  { units: ['ebombardier', 'ebombardier', 'elegionnaire', 'eskitterling', 'eskitterling'], interval: 2.0 },
  { units: ['elegionnaire', 'elegionnaire', 'eneedler', 'eneedler', 'emandible'], interval: 1.8 },
  { units: ['eravager', 'eskitterling', 'eskitterling', 'ebombardier', 'eneedler', 'elegionnaire'], interval: 1.8 },

  // --- Waves 11-20 ---
  { units: ['ecinderfly', 'emandible', 'emandible', 'eneedler', 'elegionnaire'], interval: 2.2 },
  { units: ['elongeye', 'elongeye', 'eravager', 'eskitterling', 'ebombardier'], interval: 2.0 },
  { units: ['ewardling', 'emandible', 'emandible', 'eneedler', 'eneedler'], interval: 2.0 },
  { units: ['ecinderfly', 'ecinderfly', 'elegionnaire', 'elegionnaire', 'ebombardier'], interval: 1.8 },
  { units: ['elongeye', 'ewardling', 'eravager', 'eskitterling', 'ecinderfly', 'eneedler'], interval: 1.8 },
  { units: ['elegionnaire', 'elegionnaire', 'elegionnaire', 'ecinderfly', 'ecinderfly', 'ewardling'], interval: 1.6 },
  { units: ['eskitterling', 'eskitterling', 'elongeye', 'elongeye', 'ebombardier', 'ebombardier', 'eneedler'], interval: 1.5 },
  { units: ['ewardling', 'ewardling', 'ecinderfly', 'ecinderfly', 'elegionnaire', 'elegionnaire'], interval: 1.5 },
  { units: ['elongeye', 'ecinderfly', 'ewardling', 'eravager', 'eravager', 'ebombardier', 'eneedler', 'elegionnaire'], interval: 1.3 },

  // --- Waves 21-30 ---
  { units: ['ecinderfly', 'ecinderfly', 'ecinderfly', 'elegionnaire', 'elegionnaire', 'ewardling'], interval: 1.5 },
  { units: ['elongeye', 'elongeye', 'elongeye', 'eskitterling', 'eskitterling', 'eskitterling', 'ebombardier'], interval: 1.3 },
  { units: ['ewardling', 'ewardling', 'ecinderfly', 'ecinderfly', 'eneedler', 'eneedler', 'elegionnaire', 'elegionnaire'], interval: 1.2 },
  { units: ['elegionnaire', 'elegionnaire', 'elegionnaire', 'elegionnaire', 'ecinderfly', 'ecinderfly', 'ewardling'], interval: 1.2 },
  { units: ['eskitterling', 'eskitterling', 'eskitterling', 'eskitterling', 'elongeye', 'elongeye', 'ecinderfly', 'ecinderfly'], interval: 1.0 },
  { units: ['ewardling', 'ewardling', 'ewardling', 'elegionnaire', 'elegionnaire', 'ecinderfly', 'ecinderfly', 'eneedler', 'eneedler'], interval: 1.0 },
  { units: ['elongeye', 'ecinderfly', 'ewardling', 'elegionnaire', 'eskitterling', 'eskitterling', 'ebombardier', 'ebombardier', 'eneedler', 'eneedler'], interval: 0.9 },
  { units: ['ebashguard', 'ebashguard', 'elegionnaire', 'ewardling', 'ewardling', 'ecinderfly', 'ecinderfly', 'ecinderfly'], interval: 0.9 },
  { units: ['elongeye', 'elongeye', 'ecinderfly', 'ecinderfly', 'ewardling', 'ewardling', 'eskitterling', 'eskitterling', 'elegionnaire', 'elegionnaire', 'ebashguard'], interval: 0.8 },
];

// Wave interval (seconds between waves)
export const WAVE_INTERVAL = 22;
