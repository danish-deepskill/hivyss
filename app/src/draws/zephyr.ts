import type { DrawFunction } from '../types';
import { hexToInt, drawCommonParts } from '../units/renderUtils';

const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);

  g.fillStyle(primary);
  g.fillEllipse(cx - u.facing * 3, uy + u.h * 0.65, u.w * 0.6, u.h * 0.7);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.3, u.w * 0.44, u.h * 0.48);
  g.fillEllipse(cx + u.facing * u.w * 0.26, uy + u.h * 0.14, u.w * 0.36, u.h * 0.34);

  // Speed lines when marching
  if (u.state === 'march') {
    g.lineStyle(1, primary, 0.5);
    [-4, -8, -12].forEach(ox => {
      g.lineBetween(
        cx - u.facing * ox, uy + u.h * 0.4,
        cx - u.facing * (ox + 5), uy + u.h * 0.4
      );
    });
  }

  drawCommonParts(g, u, cx, uy);
};

export default draw;
