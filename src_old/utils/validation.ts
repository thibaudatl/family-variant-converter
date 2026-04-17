// Types inferred from PIM API
type AnyProduct = Awaited<ReturnType<typeof globalThis.PIM.api.product_uuid_v1.get>>;
type AnyVariantAttributeSet = AnyProduct extends never ? never : {
  level: number;
  axes: string[];
  attributes: string[];
};

export type ProductType = AnyProduct;
export type VariantAttributeSetType = {
  level: number;
  axes: string[];
  attributes: string[];
};

export function validateSameFamily(products: ProductType[]): string | null {
  if (products.length === 0) return 'No products selected.';
  const family = products[0].family;
  const different = products.filter((p) => p.family !== family);
  if (different.length > 0) {
    return `All selected products must belong to the same family. Found ${different.length} product(s) with a different family.`;
  }
  return null;
}

export function validateSimpleProducts(products: ProductType[]): string[] {
  return products
    .filter((p) => p.parent != null)
    .map((p) => `Product ${p.identifier ?? p.uuid} already has a parent (${p.parent}).`);
}

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

export function axisKey(
  uuid: string,
  axes: string[],
  axisValues: Record<string, Record<string, string>>
): string {
  return axes.map((axis) => axisValues[uuid]?.[axis] ?? '').join('|');
}

export function validateUniqueCombinations(
  products: ProductType[],
  axisValues: Record<string, Record<string, string>>,
  variantAttributeSets: VariantAttributeSetType[]
): string[] {
  const errors: string[] = [];
  const level1Set = variantAttributeSets.find((s) => s.level === 1);
  const level2Set = variantAttributeSets.find((s) => s.level === 2);

  if (!level1Set) return ['No level-1 variant attribute set found.'];

  const allAxes = [...level1Set.axes, ...(level2Set?.axes ?? [])];

  const fullKeys = products.map((p) => axisKey(p.uuid, allAxes, axisValues));
  const fullDuplicates = fullKeys.filter((k, i) => k !== '' && fullKeys.indexOf(k) !== i);
  if (fullDuplicates.length > 0) {
    errors.push(
      `Duplicate axis value combinations: ${[...new Set(fullDuplicates)].join(', ')}`
    );
  }

  // Check for empty axis values
  for (const product of products) {
    for (const axis of allAxes) {
      if (!axisValues[product.uuid]?.[axis]) {
        errors.push(
          `Product ${product.identifier ?? product.uuid} is missing value for axis "${axis}".`
        );
      }
    }
  }

  if (level2Set) {
    // Within each level-1 group, level-2 axes must be unique
    const level1Groups = new Map<string, ProductType[]>();
    for (const product of products) {
      const key = axisKey(product.uuid, level1Set.axes, axisValues);
      if (!level1Groups.has(key)) level1Groups.set(key, []);
      level1Groups.get(key)!.push(product);
    }

    for (const [groupKey, groupProducts] of level1Groups) {
      const level2Keys = groupProducts.map((p) =>
        axisKey(p.uuid, level2Set.axes, axisValues)
      );
      const level2Dups = level2Keys.filter(
        (k, i) => k !== '' && level2Keys.indexOf(k) !== i
      );
      if (level2Dups.length > 0) {
        errors.push(
          `Duplicate level-2 axis values within group "${groupKey}": ${[...new Set(level2Dups)].join(', ')}`
        );
      }
    }
  }

  return errors;
}
