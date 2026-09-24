// Generic per-variant draw dispatcher — collapses the identical lookup-with-
// fallback that the tower / building / hive draw registries each re-implemented.
// A family declares its { variant -> draw } map + a fallback draw; this returns
// the (g, variant, s) dispatcher. Adding a variant is a map entry; adding a whole
// draw family is one call instead of re-stamping the dispatch plumbing.
type Draw<S> = (g: Phaser.GameObjects.Graphics, s: S) => void;

export function makeVariantRegistry<S, K extends string = string>(
  map: Partial<Record<K, Draw<S>>>,
  fallback: Draw<S>,
): (g: Phaser.GameObjects.Graphics, variant: K, s: S) => void {
  return (g, variant, s) => (map[variant] ?? fallback)(g, s);
}
