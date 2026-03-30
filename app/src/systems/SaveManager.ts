import type { SaveData, GameStats, GameSettings } from '../types';

const SAVE_KEY = 'hivyss_save';

const DEFAULT_SAVE: SaveData = {
  version: 1,
  colonyPoints: 0,
  deck: [],
  upgrades: {
    baseHp: 0,
    incomeRate: 0,
    unitHpAll: 0,
    unitAtkAll: 0,
    unlockHornet: 0,
    unlockBeetle: 0,
    unlockDigger: 0,
    unlockGuardian: 0,
    unlockEmber: 0,
    abilityCdr: 0,
  },
  stats: {
    totalKills: 0,
    totalGamesPlayed: 0,
    totalWins: 0,
    bestWave: 0,
    bestTime: 0,
    totalPlayTime: 0,
  },
  settings: {
    musicVolume: 0.5,
    sfxVolume: 0.7,
    muted: false,
  },
};

export class SaveManager {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades }, stats: { ...DEFAULT_SAVE.stats }, settings: { ...DEFAULT_SAVE.settings } };
      const parsed = JSON.parse(raw);
      // Merge with defaults for forward compatibility
      return {
        ...DEFAULT_SAVE,
        ...parsed,
        deck: parsed.deck || [],
        upgrades: { ...DEFAULT_SAVE.upgrades, ...parsed.upgrades },
        stats: { ...DEFAULT_SAVE.stats, ...parsed.stats },
        settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
      };
    } catch {
      return { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades }, stats: { ...DEFAULT_SAVE.stats }, settings: { ...DEFAULT_SAVE.settings } };
    }
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // localStorage might be full or unavailable
    }
  }

  reset(): void {
    this.data = { ...DEFAULT_SAVE, upgrades: { ...DEFAULT_SAVE.upgrades }, stats: { ...DEFAULT_SAVE.stats }, settings: { ...DEFAULT_SAVE.settings } };
    this.save();
  }

  getUpgradeLevel(id: string): number {
    return this.data.upgrades[id] || 0;
  }

  getDeck(): string[] {
    return this.data.deck || [];
  }

  setDeck(keys: string[]): void {
    this.data.deck = keys;
    this.save();
  }

  recordGameResult(wavesCleared: number, kills: number, won: boolean, elapsed: number): number {
    const points = Math.floor(wavesCleared * 10 + kills * 2 + (won ? 100 : 0));
    this.data.colonyPoints += points;
    this.data.stats.totalGamesPlayed++;
    if (won) this.data.stats.totalWins++;
    this.data.stats.totalKills += kills;
    if (wavesCleared > this.data.stats.bestWave) this.data.stats.bestWave = wavesCleared;
    if (elapsed > this.data.stats.bestTime) this.data.stats.bestTime = elapsed;
    this.data.stats.totalPlayTime += elapsed;
    this.save();
    return points;
  }
}
