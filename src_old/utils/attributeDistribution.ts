import type { ProductType, VariantAttributeSetType } from './validation';

type ProductValues = NonNullable<ProductType['values']>;

function getLevel1Set(sets: VariantAttributeSetType[]): VariantAttributeSetType {
  const s = sets.find((x) => x.level === 1);
  if (!s) throw new Error('No level-1 variant attribute set found');
  return s;
}

function getLevel2Set(sets: VariantAttributeSetType[]): VariantAttributeSetType | undefined {
  return sets.find((x) => x.level === 2);
}

export function isOneLevel(sets: VariantAttributeSetType[]): boolean {
  return sets.length === 1;
}

/**
 * Values for the root product model: all attrs NOT in any variant attribute set.
 */
export function extractRootLevelValues(
  product: ProductType,
  sets: VariantAttributeSetType[]
): ProductValues {
  const values = product.values ?? {};
  const level1 = getLevel1Set(sets);
  const level2 = getLevel2Set(sets);
  const variantCodes = new Set([
    ...level1.attributes,
    ...(level2?.attributes ?? []),
  ]);
  const result: ProductValues = {};
  for (const [code, vals] of Object.entries(values)) {
    if (!variantCodes.has(code)) {
      result[code] = vals;
    }
  }
  return result;
}

/**
 * Values for a level-1 sub-product-model: attrs in level-1.attributes.
 */
export function extractLevel1Values(
  product: ProductType,
  sets: VariantAttributeSetType[],
  axisOverrides?: Record<string, string>
): ProductValues {
  const values = product.values ?? {};
  const level1 = getLevel1Set(sets);
  const result: ProductValues = {};
  for (const [code, vals] of Object.entries(values)) {
    if (level1.attributes.includes(code)) {
      result[code] = vals;
    }
  }
  // Apply axis value overrides (from user-edited table)
  if (axisOverrides) {
    for (const axis of level1.axes) {
      if (axisOverrides[axis] !== undefined) {
        result[axis] = [{ locale: null, scope: null, data: axisOverrides[axis] }];
      }
    }
  }
  return result;
}

/**
 * Values for the variant product: attrs at the deepest level.
 * For 1-level: level-1.attributes. For 2-level: level-2.attributes.
 */
export function extractVariantLevelValues(
  product: ProductType,
  sets: VariantAttributeSetType[],
  axisOverrides?: Record<string, string>
): ProductValues {
  const values = product.values ?? {};
  const level1 = getLevel1Set(sets);
  const level2 = getLevel2Set(sets);
  const variantSet = level2 ?? level1;
  const result: ProductValues = {};
  for (const [code, vals] of Object.entries(values)) {
    if (variantSet.attributes.includes(code)) {
      result[code] = vals;
    }
  }
  // Apply axis value overrides
  if (axisOverrides) {
    for (const axis of variantSet.axes) {
      if (axisOverrides[axis] !== undefined) {
        result[axis] = [{ locale: null, scope: null, data: axisOverrides[axis] }];
      }
    }
  }
  return result;
}

/**
 * Get all axis attribute codes across all levels (for displaying in the table).
 */
export function getAllAxes(sets: VariantAttributeSetType[]): string[] {
  const level1 = getLevel1Set(sets);
  const level2 = getLevel2Set(sets);
  return [...level1.axes, ...(level2?.axes ?? [])];
}

/**
 * Compute a unique key for a product's level-1 axis values.
 * Used to group products into sub-model buckets.
 */
export function getLevel1GroupKey(
  productUuid: string,
  sets: VariantAttributeSetType[],
  axisValues: Record<string, Record<string, string>>
): string {
  const level1 = getLevel1Set(sets);
  return level1.axes.map((axis) => axisValues[productUuid]?.[axis] ?? '').join('|');
}

/**
 * Generate a suggested sub-model code from a level-1 group key.
 * e.g. rootCode + "_" + level1Key sanitized
 */
export function suggestSubModelCode(rootCode: string, level1GroupKey: string): string {
  const sanitized = level1GroupKey.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${rootCode}__${sanitized}`;
}
