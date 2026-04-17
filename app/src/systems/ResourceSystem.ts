// Resource pools — per-entity `Record<string, number>`. Ammo, charges,
// souls, etc. Pure functions; zero imports. `ResourceBearer` is
// structural.

export interface ResourceBearer {
  resources?: Record<string, number>;
}

export function getResource(entity: ResourceBearer, key: string): number {
  return entity.resources?.[key] ?? 0;
}

/**
 * Add `delta` (signed), clamp to [0, max?]. Creates the backing record
 * lazily. Returns the post-change value. Never leaves a resource
 * negative — a partial spend via negative delta floors at 0.
 */
export function addResource(
  entity: ResourceBearer,
  key: string,
  delta: number,
  max?: number,
): number {
  if (!entity.resources) entity.resources = {};
  const current = entity.resources[key] ?? 0;
  let next = current + delta;
  if (next < 0) next = 0;
  if (max !== undefined && next > max) next = max;
  entity.resources[key] = next;
  return next;
}

/**
 * Atomically spend `amount`. Returns true if the entity had enough;
 * false otherwise with no mutation. Negative amount returns false —
 * a spend-negative is a caller bug, not an implicit gain.
 */
export function spendResource(
  entity: ResourceBearer,
  key: string,
  amount: number,
): boolean {
  if (amount < 0) return false;
  const current = entity.resources?.[key] ?? 0;
  if (current < amount) return false;
  if (!entity.resources) entity.resources = {};
  entity.resources[key] = current - amount;
  return true;
}

/** Force-set a resource to an exact value, clamped to [0, max?]. */
export function setResource(
  entity: ResourceBearer,
  key: string,
  value: number,
  max?: number,
): number {
  if (!entity.resources) entity.resources = {};
  let next = value;
  if (next < 0) next = 0;
  if (max !== undefined && next > max) next = max;
  entity.resources[key] = next;
  return next;
}

/** Clear every key. Leaves the backing record present but empty. */
export function clearResources(entity: ResourceBearer): void {
  if (!entity.resources) return;
  for (const k in entity.resources) {
    delete entity.resources[k];
  }
}
