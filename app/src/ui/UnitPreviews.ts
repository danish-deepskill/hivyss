import Phaser from 'phaser';
import type { RenderUnit, UnitDef } from '../types';
import { drawUnit } from '../units/registry';
import { resolveColors } from '../config/Palettes';

// Shared unit-preview renderer — the one place a UnitDef becomes a static
// portrait texture / data-URL of its actual procedural draw. Consumers:
// the battle HUD previews (GameManager), the sandbox roster + placement
// ghosts (SandboxScene), and the brood deck cards (BroodScene). Was three
// hand-rolled copies of the same graphics→texture dance.

export interface PreviewOpts {
  /** 1 = face right (player), -1 = face left (enemy). */
  facing?: 1 | -1;
  /** Upscale factor for crisper thumbnails (BroodScene cards). */
  scale?: number;
  /** Padding around the body. Default: 10 top / 20 bottom (the feet-anchor
   *  geometry placement sprites rely on); pass symmetric values to override. */
  padTop?: number;
  padBottom?: number;
}

/**
 * Render `def`'s procedural draw into a static texture under `texKey`
 * (NEAREST-filtered — pixel-art upscale, no blur). Caller owns the key's
 * lifecycle. Returns the texture size.
 */
export function renderPreviewTexture(
  scene: Phaser.Scene,
  def: UnitDef,
  texKey: string,
  opts: PreviewOpts = {},
): { w: number; h: number } {
  const s = opts.scale ?? 1;
  const padTop = opts.padTop ?? 10 * s;
  const padBottom = opts.padBottom ?? 20 * s;
  const uw = Math.round(def.w * s);
  const uh = Math.round(def.h * s);
  const pw = Math.round(uw + padTop * 2);
  const ph = Math.round(uh + padTop + padBottom);

  const g = scene.add.graphics();
  const renderUnit: RenderUnit = {
    w: uw, h: uh,
    ...resolveColors(def),
    palette: def.palette,
    facing: opts.facing ?? 1, bob: 0,
    state: 'march', atkCd: 0, atkRate: def.atkRate,
    trait: def.trait, hp: def.hp, maxHp: def.hp,
    burrowed: false, windup: 0, recover: 0,
  };
  drawUnit(g, renderUnit, pw / 2, padTop);
  g.generateTexture(texKey, pw, ph);
  g.destroy();
  scene.textures.get(texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  return { w: pw, h: ph };
}

/** Render `def`'s preview and return it as a data URL (for DOM <img> HUDs).
 *  The intermediate texture is cleaned up. */
export function previewDataURL(scene: Phaser.Scene, key: string, def: UnitDef, opts: PreviewOpts = {}): string {
  const texKey = '_preview_tmp_' + key;
  renderPreviewTexture(scene, def, texKey, opts);
  const src = scene.textures.get(texKey).getSourceImage() as HTMLCanvasElement;
  const url = src.toDataURL();
  scene.textures.remove(texKey);
  return url;
}
