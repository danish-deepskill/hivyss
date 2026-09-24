import { StructureEntity } from './StructureEntity';
import type { HiveStructure } from './HiveStructure';

// HiveEntity — the hive's WorldEntity wrapper. A thin StructureEntity over the
// hive base; see StructureEntity for the shared contract + component rationale.
// `x` is the WALL position (what units' range checks measure against).
// (Id-space reset lives on StructureEntity as resetStructureUid — no alias here.)
export class HiveEntity extends StructureEntity<HiveStructure> {}
