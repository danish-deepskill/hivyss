// Background theme palettes — data only, no rendering code.
// To add a new theme: add an entry here and it appears in the MainMenuScene picker automatically.

export interface BgTheme {
  name: string;
  sky: number;        // top of sky gradient
  skyLow: number;     // bottom of sky gradient (horizon)
  mtn: number;        // mountain fill color
  ground: number;     // ground fill color
  groundTop: number;  // ground surface line color
  groundTex: number;  // ground texture stroke color
  stars: boolean;     // show stars in sky
}

export const BG_THEMES: Record<string, BgTheme> = {
  day: {
    name: 'Day',
    sky: 0x5c9ee8, skyLow: 0x8ec4f0,
    mtn: 0x6a8a5a, ground: 0x4a6a28, groundTop: 0x5c7a34, groundTex: 0x3e5a1e,
    stars: false,
  },
  sunset: {
    name: 'Sunset',
    sky: 0xd45020, skyLow: 0xf0a040,
    mtn: 0x4a2a20, ground: 0x2e2a10, groundTop: 0x3e3818, groundTex: 0x36300e,
    stars: false,
  },
  night: {
    name: 'Night',
    sky: 0x0e0e18, skyLow: 0x0e0e18,
    mtn: 0x141420, ground: 0x1e1a0c, groundTop: 0x2a2410, groundTex: 0x2e2810,
    stars: true,
  },
};
