import type {
  AxisValuesByUuid,
  FamilyVariantType,
  ModelTree,
  ProductModelType,
  ProductType,
  VariantAttributeSetType,
} from '../types';

type ProductValues = NonNullable<ProductType['values']>;
type ValueEntry = ProductValues[string][number];

export type TargetLevel = 'root' | 'sub_model' | 'variant';

export interface TargetSubModel {
  code: string;
  groupKey: string;
  values: ProductValues;
  variantUuids: string[];
}

export interface TargetVariant {
  uuid: string;
  identifier: string | null;
  parentCode: string;
  values: ProductValues;
  categories: string[];
  enabled: boolean;
  associations: ProductType['associations'];
}

export interface TargetPayload {
  root: {
    code: string;
    family: string;
    familyVariant: string;
    categories: string[];
    values: ProductValues;
    associations: ProductModelType['associations'];
  };
  subModels: TargetSubModel[];
  variants: TargetVariant[];
  droppedAttributes: string[];
}

function getSets(fv: FamilyVariantType): VariantAttributeSetType[] {
  return fv.variantAttributeSets as VariantAttributeSetType[];
}

export function isTargetOneLevel(fv: FamilyVariantType): boolean {
  return getSets(fv).length === 1;
}

export function getTargetAxesAtLevel(fv: FamilyVariantType, level: 1 | 2): string[] {
  return getSets(fv).find((s) => s.level === level)?.axes ?? [];
}

export function getAllTargetAxes(fv: FamilyVariantType): string[] {
  const sets = getSets(fv);
  const level1 = sets.find((s) => s.level === 1);
  const level2 = sets.find((s) => s.level === 2);
  return [...(level1?.axes ?? []), ...(level2?.axes ?? [])];
}

export function getTargetLevel(
  attrCode: string,
  targetFv: FamilyVariantType,
  targetFamilyAttrs: Set<string>
): TargetLevel | null {
  if (!targetFamilyAttrs.has(attrCode)) return null;
  const sets = getSets(targetFv);
  const level1 = sets.find((s) => s.level === 1);
  const level2 = sets.find((s) => s.level === 2);
  const oneLevel = sets.length === 1;

  if (level2?.attributes.includes(attrCode)) return 'variant';
  if (level1?.attributes.includes(attrCode)) {
    return oneLevel ? 'variant' : 'sub_model';
  }
  return 'root';
}

function valueKey(entry: ValueEntry): string {
  return `${entry.locale ?? ''}|${entry.scope ?? ''}`;
}

function isEmptyEntry(entry: ValueEntry): boolean {
  const d = entry.data;
  if (d === null || d === undefined) return true;
  if (typeof d === 'string' && d === '') return true;
  if (Array.isArray(d) && d.length === 0) return true;
  return false;
}

function mergeFirstNonEmpty(
  acc: Record<string, ValueEntry>,
  values: ProductValues | undefined,
  attrCode: string
): void {
  const entries = values?.[attrCode];
  if (!entries) return;
  for (const entry of entries) {
    const k = valueKey(entry);
    if (!acc[k] && !isEmptyEntry(entry)) {
      acc[k] = entry;
    }
  }
}

/**
 * Effective value(s) of an attribute as seen from a given entity, walking up ancestors
 * first (inheritance) and, as a last resort, descendants (needed when pulling an attribute
 * UP in the hierarchy). Returns an array keyed by locale|scope.
 */
function effectiveEntries(
  attrCode: string,
  tree: ModelTree,
  focus: 'root' | { subModelCode: string } | { variantUuid: string }
): ValueEntry[] {
  const acc: Record<string, ValueEntry> = {};

  if (focus === 'root') {
    mergeFirstNonEmpty(acc, tree.root.values, attrCode);
    for (const sub of tree.subModels) mergeFirstNonEmpty(acc, sub.values, attrCode);
    for (const v of tree.variants) mergeFirstNonEmpty(acc, v.values, attrCode);
  } else if ('subModelCode' in focus) {
    const sub = tree.subModels.find((s) => s.code === focus.subModelCode);
    mergeFirstNonEmpty(acc, tree.root.values, attrCode);
    mergeFirstNonEmpty(acc, sub?.values, attrCode);
    const variantsInGroup = tree.variants.filter((v) => v.parent === focus.subModelCode);
    for (const v of variantsInGroup) mergeFirstNonEmpty(acc, v.values, attrCode);
  } else {
    const variant = tree.variants.find((v) => v.uuid === focus.variantUuid);
    const parentSub = variant?.parent
      ? tree.subModels.find((s) => s.code === variant.parent)
      : undefined;
    mergeFirstNonEmpty(acc, tree.root.values, attrCode);
    mergeFirstNonEmpty(acc, parentSub?.values, attrCode);
    mergeFirstNonEmpty(acc, variant?.values, attrCode);
  }

  return Object.values(acc);
}

function sanitizeCodePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '_');
}

function generateSubModelCode(rootCode: string, groupKey: string): string {
  const sanitized = sanitizeCodePart(groupKey);
  const base = `${rootCode}__${sanitized}`;
  // Product model code max length is 100 in Akeneo; trim if needed.
  return base.length > 100 ? base.slice(0, 100) : base;
}

/**
 * Resolve the axis value for a variant: user override in step 3 wins; otherwise
 * effective value from the tree.
 */
function resolveAxisValue(
  variant: ProductType,
  axisCode: string,
  tree: ModelTree,
  axisValues: AxisValuesByUuid
): string {
  const override = axisValues[variant.uuid]?.[axisCode];
  if (override !== undefined && override !== '') return override;
  const entries = effectiveEntries(axisCode, tree, { variantUuid: variant.uuid });
  // Axes are (by Akeneo rule) non-localizable, non-scopable — there's at most one entry.
  const first = entries[0];
  if (!first) return '';
  const d = first.data;
  if (d === null || d === undefined) return '';
  if (typeof d === 'object') return JSON.stringify(d);
  return String(d);
}

function buildAxisValueEntry(value: string): ValueEntry {
  return { locale: null, scope: null, data: value };
}

/**
 * Compute per-variant group key from target level-1 axes.
 */
function computeLevel1GroupKey(
  variant: ProductType,
  targetFv: FamilyVariantType,
  tree: ModelTree,
  axisValues: AxisValuesByUuid
): string {
  const axes = getTargetAxesAtLevel(targetFv, 1);
  return axes.map((a) => resolveAxisValue(variant, a, tree, axisValues)).join('|');
}

export function computeTargetPayload(
  tree: ModelTree,
  targetFv: FamilyVariantType,
  targetFamilyAttrs: Set<string>,
  axisValues: AxisValuesByUuid,
  sourceFamilyAttrs: Set<string>
): TargetPayload {
  const oneLevel = isTargetOneLevel(targetFv);
  const level1Axes = getTargetAxesAtLevel(targetFv, 1);
  const level2Axes = getTargetAxesAtLevel(targetFv, 2);
  const allAxes = new Set([...level1Axes, ...level2Axes]);

  // --- Discover every source attribute used across the tree ---
  const sourceAttrCodes = new Set<string>();
  for (const values of [
    tree.root.values,
    ...tree.subModels.map((s) => s.values),
    ...tree.variants.map((v) => v.values),
  ]) {
    for (const code of Object.keys(values ?? {})) sourceAttrCodes.add(code);
  }

  // Attributes "dropped" = attrs on the source family but not on the target family.
  // Attributes aren't lost across family variants within the same family — only a
  // family change can remove attributes.
  const droppedAttributes: string[] = [];
  for (const attr of sourceFamilyAttrs) {
    if (!targetFamilyAttrs.has(attr) && !allAxes.has(attr)) {
      droppedAttributes.push(attr);
    }
  }
  const rootValues: ProductValues = {};

  // --- ROOT VALUES ---
  for (const attr of sourceAttrCodes) {
    const level = getTargetLevel(attr, targetFv, targetFamilyAttrs);
    if (level === null) continue; // attr not on target family — value will be lost
    if (level === 'root') {
      const entries = effectiveEntries(attr, tree, 'root');
      if (entries.length > 0) rootValues[attr] = entries;
    }
  }

  // --- GROUPING FOR SUB-MODELS (2-level target only) ---
  const subModels: TargetSubModel[] = [];
  const variantToSubModel: Map<string, string> = new Map(); // variantUuid -> subModelCode
  if (!oneLevel) {
    const groups = new Map<string, ProductType[]>();
    for (const v of tree.variants) {
      const key = computeLevel1GroupKey(v, targetFv, tree, axisValues);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    }

    for (const [groupKey, groupVariants] of groups) {
      const subCode = generateSubModelCode(tree.root.code, groupKey);
      const subValues: ProductValues = {};

      // sub-model attrs: those targeting 'sub_model'
      for (const attr of sourceAttrCodes) {
        const level = getTargetLevel(attr, targetFv, targetFamilyAttrs);
        if (level !== 'sub_model') continue;
        // Representative: use first variant in the group (they share level-1 axes)
        const rep = groupVariants[0];
        const entries = effectiveEntries(attr, tree, { variantUuid: rep.uuid });
        if (entries.length > 0) subValues[attr] = entries;
      }

      // Override level-1 axis values from user-provided axisValues (representative)
      for (const axis of level1Axes) {
        const rep = groupVariants[0];
        const val = resolveAxisValue(rep, axis, tree, axisValues);
        subValues[axis] = [buildAxisValueEntry(val)];
      }

      subModels.push({
        code: subCode,
        groupKey,
        values: subValues,
        variantUuids: groupVariants.map((v) => v.uuid),
      });

      for (const v of groupVariants) variantToSubModel.set(v.uuid, subCode);
    }
  }

  // --- VARIANTS ---
  const variants: TargetVariant[] = [];
  for (const v of tree.variants) {
    const parentCode = oneLevel ? tree.root.code : (variantToSubModel.get(v.uuid) ?? tree.root.code);
    const variantValues: ProductValues = {};

    for (const attr of sourceAttrCodes) {
      const level = getTargetLevel(attr, targetFv, targetFamilyAttrs);
      if (level !== 'variant') continue;
      const entries = effectiveEntries(attr, tree, { variantUuid: v.uuid });
      if (entries.length > 0) variantValues[attr] = entries;
    }

    // Override variant-level axes (level-2 in 2-level target, level-1 in 1-level target)
    const variantAxes = oneLevel ? level1Axes : level2Axes;
    for (const axis of variantAxes) {
      const val = resolveAxisValue(v, axis, tree, axisValues);
      variantValues[axis] = [buildAxisValueEntry(val)];
    }

    variants.push({
      uuid: v.uuid,
      identifier: v.identifier ?? null,
      parentCode,
      values: variantValues,
      categories: v.categories ?? [],
      enabled: v.enabled ?? true,
      associations: v.associations,
    });
  }

  return {
    root: {
      code: tree.root.code,
      family: tree.root.family ?? '',
      familyVariant: targetFv.code,
      categories: tree.root.categories ?? [],
      values: rootValues,
      associations: tree.root.associations,
    },
    subModels,
    variants,
    droppedAttributes: [...new Set(droppedAttributes)].sort(),
  };
}
