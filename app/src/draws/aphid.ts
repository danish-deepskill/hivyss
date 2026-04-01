import type { DrawFunction } from '../types';
import { hexToInt, drawCommonParts } from '../units/renderUtils';

const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);

  g.fillStyle(primary);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.72, u.h * 0.84);
  g.fillEllipse(cx + u.facing * 0.5, uy + u.h * 0.32, u.w * 0.56, u.h * 0.56);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.16, u.w * 0.44, u.h * 0.4);

  // Cross symbol
  g.fillStyle(0xffffff, 0.6);
  g.fillRect(cx - 1, uy + u.h * 0.54 - 4, 2, 8);
  g.fillRect(cx - 4, uy + u.h * 0.54 - 1, 8, 2);

  drawCommonParts(g, u, cx, uy);
};

export default draw;
