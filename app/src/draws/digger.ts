import type { DrawFunction } from '../types';
import { hexToInt, drawCommonParts } from '../units/renderUtils';

const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);

  if (u.burrowed) {
    // Underground: just a dirt mound
    g.fillStyle(0x604020, 0.5);
    g.fillEllipse(cx, uy + u.h * 0.8, u.w * 0.6, u.h * 0.3);
    return;
  }

  g.fillStyle(primary);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.74, u.h * 0.84);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.34, u.w * 0.54, u.h * 0.54);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.18, u.w * 0.42, u.h * 0.38);

  // Dirt particles
  g.fillStyle(0x805030, 0.4);
  g.fillCircle(cx - u.facing * 4, uy + u.h * 0.8, 2);
  g.fillCircle(cx + u.facing * 2, uy + u.h * 0.85, 1.5);

  drawCommonParts(g, u, cx, uy);
};

export default draw;
