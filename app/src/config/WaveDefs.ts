import type { WaveDef } from '../types';

// Wave compositions
// Each wave: units array (enemy keys = 'e' + player unit key) + spawn interval
export const WAVE_DEFS: WaveDef[] = [
  // --- Waves 1-10 ---
  { units: ['egrub', 'egrub', 'egrub'], interval: 3 },
  { units: ['egrub', 'emandible', 'egrub', 'emandible'], interval: 2.8 },
  { units: ['emandible', 'emandible', 'eneedler', 'emandible'], interval: 2.5 },
  { units: ['elegionnaire', 'egrub', 'egrub', 'emandible', 'emandible'], interval: 2.5 },
  { units: ['ezephyr', 'ezephyr', 'ebombardier', 'emandible'], interval: 2.2 },
  { units: ['eneedler', 'eneedler', 'elegionnaire', 'emandible'], interval: 2.2 },
  { units: ['ebombardier', 'ebombardier', 'elegionnaire', 'ezephyr', 'ezephyr'], interval: 2.0 },
  { units: ['elegionnaire', 'elegionnaire', 'eneedler', 'eneedler', 'emandible'], interval: 1.8 },
  { units: ['ezephyr', 'ezephyr', 'ezephyr', 'ebombardier', 'eneedler', 'elegionnaire'], interval: 1.8 },
  { units: ['eboss'], interval: 5 }, // QUEEN boss

  // --- Waves 11-20 ---
  { units: ['eember', 'emandible', 'emandible', 'eneedler', 'elegionnaire'], interval: 2.2 },
  { units: ['edigger', 'edigger', 'ezephyr', 'ezephyr', 'ebombardier'], interval: 2.0 },
  { units: ['eguardian', 'emandible', 'emandible', 'eneedler', 'eneedler'], interval: 2.0 },
  { units: ['eember', 'eember', 'elegionnaire', 'elegionnaire', 'ebombardier'], interval: 1.8 },
  { units: ['edigger', 'eguardian', 'ezephyr', 'ezephyr', 'eember', 'eneedler'], interval: 1.8 },
  { units: ['elegionnaire', 'elegionnaire', 'elegionnaire', 'eember', 'eember', 'eguardian'], interval: 1.6 },
  { units: ['ezephyr', 'ezephyr', 'edigger', 'edigger', 'ebombardier', 'ebombardier', 'eneedler'], interval: 1.5 },
  { units: ['eguardian', 'eguardian', 'eember', 'eember', 'elegionnaire', 'elegionnaire'], interval: 1.5 },
  { units: ['edigger', 'eember', 'eguardian', 'ezephyr', 'ezephyr', 'ebombardier', 'eneedler', 'elegionnaire'], interval: 1.3 },
  { units: ['egeneral'], interval: 5 }, // GENERAL boss

  // --- Waves 21-30 ---
  { units: ['eember', 'eember', 'eember', 'elegionnaire', 'elegionnaire', 'eguardian'], interval: 1.5 },
  { units: ['edigger', 'edigger', 'edigger', 'ezephyr', 'ezephyr', 'ezephyr', 'ebombardier'], interval: 1.3 },
  { units: ['eguardian', 'eguardian', 'eember', 'eember', 'eneedler', 'eneedler', 'elegionnaire', 'elegionnaire'], interval: 1.2 },
  { units: ['elegionnaire', 'elegionnaire', 'elegionnaire', 'elegionnaire', 'eember', 'eember', 'eguardian'], interval: 1.2 },
  { units: ['ezephyr', 'ezephyr', 'ezephyr', 'ezephyr', 'edigger', 'edigger', 'eember', 'eember'], interval: 1.0 },
  { units: ['eguardian', 'eguardian', 'eguardian', 'elegionnaire', 'elegionnaire', 'eember', 'eember', 'eneedler', 'eneedler'], interval: 1.0 },
  { units: ['edigger', 'eember', 'eguardian', 'elegionnaire', 'ezephyr', 'ezephyr', 'ebombardier', 'ebombardier', 'eneedler', 'eneedler'], interval: 0.9 },
  { units: ['erhino', 'erhino', 'elegionnaire', 'eguardian', 'eguardian', 'eember', 'eember', 'eember'], interval: 0.9 },
  { units: ['edigger', 'edigger', 'eember', 'eember', 'eguardian', 'eguardian', 'ezephyr', 'ezephyr', 'elegionnaire', 'elegionnaire', 'erhino'], interval: 0.8 },
  { units: ['eempress'], interval: 5 }, // EMPRESS boss
];

// Wave interval (seconds between waves)
export const WAVE_INTERVAL = 22;
