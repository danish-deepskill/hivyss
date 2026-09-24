import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Scout — the pheromone COURIER (distinct from the plain worker/Gatherer in
// draws/worker.ts). A swift messenger sprinting forward: a streamlined,
// forward-leaning body with a RAISED gaster, a dorsal STORAGE-POD on its back,
// oversized swept-back sensory antennae with sensor knobs, and a scent puff
// trailing off the back. The BODY stays white (normal palette) — only the
// storage-pod + scent trail take the carried command's colour (resources.cmd,
// set on deploy). Reads as a "fast courier" by silhouette, distinct from the
// Gatherer even when undeployed (white body, neutral empty pod).
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary);
  const dark = hexToInt(u.secondary);
  // The carried command's colour (spawnCourier sets it on deploy) — tints ONLY
  // the storage-pod + scent trail, never the body. Undefined in previews.
  const cmd = u.resources?.cmd;
  const pod = cmd ?? 0xa8a298; // empty bag = neutral grey
  const run = Math.sin(u.bob * 1.8) * 0.6; // fast sprint cycle
  const cy = uy + h / 2 + run;

  // Ground shadow.
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, uy + h * 1.04, w * 0.62, h * 0.12);

  // Scent trail — faint puffs of the carried command's colour streaming off the
  // back (only while couriering a command; the body itself never colours).
  if (cmd !== undefined) {
    for (let i = 0; i < 3; i++) {
      const t = i / 3;
      g.fillStyle(cmd, 0.2 * (1 - t));
      g.fillCircle(cx - f * w * (0.5 + t * 0.55), cy - h * 0.08 - t * h * 0.14, w * (0.13 - t * 0.03));
    }
  }

  // Sprint legs (3 pairs, long, galloping — more splayed than the worker).
  g.lineStyle(1.2, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.18;
    const sw = Math.sin(u.bob * 2.4 + i * 1.3) * w * 0.12; // gallop
    g.lineBetween(lx, cy + h * 0.1, lx - f * w * 0.22 - sw, cy + h * 0.5);
    g.lineBetween(lx, cy + h * 0.1, lx + f * w * 0.2 + sw, cy + h * 0.5);
  }

  // Body — forward-leaning, streamlined. Raised gaster (rear) · thorax · head.
  g.fillStyle(dark, 1);
  g.fillEllipse(cx - f * w * 0.3, cy - h * 0.08, w * 0.34, h * 0.4);   // raised gaster
  g.fillStyle(primary, 1);
  g.fillEllipse(cx + f * w * 0.02, cy, w * 0.34, h * 0.4);             // thorax

  // SCENT-POD — a glowing sac on the back (the command it couriers). A dark rim
  // keeps it readable even when the body is white; the core pulses.
  const podX = cx - f * w * 0.06, podY = cy - h * 0.34;
  g.fillStyle(dark, 0.9);
  g.fillCircle(podX, podY, w * 0.2);            // dark rim (always reads)
  g.fillStyle(pod, 0.95);
  g.fillCircle(podX, podY, w * 0.16);           // storage sac — the command's colour
  g.fillStyle(0xffffff, 0.55 + 0.35 * Math.abs(Math.sin(u.bob * 3)));
  g.fillCircle(podX - f * w * 0.04, podY - h * 0.04, w * 0.07); // glossy highlight

  // Head — dark, leaning forward.
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + f * w * 0.32, cy - h * 0.02, w * 0.24, h * 0.32);

  // Oversized swept-back antennae (the courier signature — reads/lays scent),
  // tipped with sensor knobs.
  g.lineStyle(1.4, primary, 1);
  const ax = cx + f * w * 0.36, ay = cy - h * 0.14;
  const tw = Math.sin(u.bob * 2.2) * w * 0.08;
  const t1x = ax + f * w * 0.5 + tw, t1y = ay - h * 0.6;
  const t2x = ax + f * w * 0.66 + tw, t2y = ay - h * 0.32;
  g.lineBetween(ax, ay, t1x, t1y);
  g.lineBetween(ax, ay, t2x, t2y);
  g.fillStyle(primary, 0.9);
  g.fillCircle(t1x, t1y, w * 0.05);
  g.fillCircle(t2x, t2y, w * 0.05);

  // Eye glint.
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx + f * w * 0.36, cy - h * 0.04, w * 0.05);
};

export default draw;
