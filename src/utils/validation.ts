import type {
  AxisValuesByUuid,
  FamilyVariantType,
  ModelTree,
  ProductType,
} from '../types';
import {
  getAllTargetAxes,
  getTargetAxesAtLevel,
  isTargetOneLevel,
} from './attributeShift';

export function getFirstScalarValue(
  values: ProductType['values'],
  attributeCode: string
): string {
  const attrValues = values?.[attributeCode];
  if (!attrValues || attrValues.length === 0) return '';
  const data = attrValues[0].data;
  if (data === null || data === undefined) return '';
  if (typeof data === 'object') return JSON.stringify(data);
  return String(data);
}

/**
 * Effective axis value visible on a variant (variant override > sub-model > root).
 * Used to prefill the axis table in step 3.
 */
export function effectiveAxisValueForVariant(
  variant: ProductType,
  tree: ModelTree,
  axisCode: string
): string {
  const own = getFirstScalarValue(variant.values, axisCode);
  if (own) return own;
  if (variant.parent) {
    const sub = tree.subModels.find((s) => s.code === variant.parent);
    const subVal = getFirstScalarValue(sub?.values, axisCode);
    if (subVal) return subVal;
  }
  return getFirstScalarValue(tree.root.values, axisCode);
}

function axisKey(
  uuid: string,
  axes: string[],
  axisValues: AxisValuesByUuid
): string {
  return axes.map((axis) => axisValues[uuid]?.[axis] ?? '').join('|');
}

/**
 * Validate that, within each tree:
 *  - every variant has values for all target axes (level-1 + level-2)
 *  - combined (L1 + L2) axis values are unique across variants
 *  - within each level-1 group, level-2 axis values are unique
 */
export function validateTreesAgainstTarget(
  trees: ModelTree[],
  targetFv: FamilyVariantType,
  axisValues: AxisValuesByUuid
): string[] {
  const errors: string[] = [];
  const allAxes = getAllTargetAxes(targetFv);
  const oneLevel = isTargetOneLevel(targetFv);
  const level1Axes = getTargetAxesAtLevel(targetFv, 1);
  const level2Axes = getTargetAxesAtLevel(targetFv, 2);

  for (const tree of trees) {
    const rootLabel = tree.root.code;

    // Presence check
    for (const variant of tree.variants) {
      for (const axis of allAxes) {
        if (!axisValues[variant.uuid]?.[axis]) {
          errors.push(
            `[${rootLabel}] Variant "${variant.identifier ?? variant.uuid}" is missing value for axis "${axis}".`
          );
        }
      }
    }

    if (tree.variants.length === 0) continue;

    // Full combination uniqueness
    const keys = tree.variants.map((v) => axisKey(v.uuid, allAxes, axisValues));
    const seen = new Map<string, string[]>();
    tree.variants.forEach((v, i) => {
      const k = keys[i];
      if (!k) return;
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k)!.push(v.identifier ?? v.uuid);
    });
    for (const [k, identifiers] of seen) {
      if (identifiers.length > 1) {
        errors.push(
          `[${rootLabel}] Duplicate axis combination "${k}" across variants: ${identifiers.join(', ')}`
        );
      }
    }

    // Level-2 uniqueness within each level-1 group (only 2-level target FV)
    if (!oneLevel) {
      const groups = new Map<string, ProductType[]>();
      for (const v of tree.variants) {
        const k = axisKey(v.uuid, level1Axes, axisValues);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(v);
      }
      for (const [groupKey, groupVariants] of groups) {
        const l2Seen = new Map<string, string[]>();
        for (const v of groupVariants) {
          const k = axisKey(v.uuid, level2Axes, axisValues);
          if (!k) continue;
          if (!l2Seen.has(k)) l2Seen.set(k, []);
          l2Seen.get(k)!.push(v.identifier ?? v.uuid);
        }
        for (const [k, identifiers] of l2Seen) {
          if (identifiers.length > 1) {
            errors.push(
              `[${rootLabel}] Within L1 group "${groupKey}", duplicate L2 combination "${k}": ${identifiers.join(', ')}`
            );
          }
        }
      }
    }
  }

  return errors;
}
