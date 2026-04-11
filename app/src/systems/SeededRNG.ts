// Deterministic PRNG using mulberry32 algorithm
// Zero dependencies — pure math utility

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// djb2 hash — converts any string to a 32-bit integer
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// Convert display seed string to numeric seed
export function seedFromString(str: string): number {
  return djb2(str);
}

// Generate a random display seed: XXXX-XXXX
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
export function generateSeedString(): string {
  const pick = () => CHARS[Math.floor(Math.random() * CHARS.length)];
  const block = () => pick() + pick() + pick() + pick();
  return `${block()}-${block()}`;
}

// Format raw input into XXXX-XXXX seed format
export function formatSeedInput(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const a = raw.slice(0, 4);
  const b = raw.slice(4, 8);
  return b ? `${a}-${b}` : a || '';
}

// Convenience class wrapping mulberry32
export class SeededRNG {
  private rng: () => number;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  // Float in [0, 1)
  next(): number {
    return this.rng();
  }

  // Integer in [min, max] inclusive
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  // Float in [min, max)
  nextFloat(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  // Pick a random element from an array
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rng() * arr.length)];
  }

  // Shuffle array in place (Fisher-Yates)
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
