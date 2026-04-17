export type ProductType = Awaited<ReturnType<typeof globalThis.PIM.api.product_uuid_v1.get>>;
export type ProductModelType = Awaited<ReturnType<typeof globalThis.PIM.api.product_model_v1.get>>;
export type FamilyVariantType = Awaited<ReturnType<typeof globalThis.PIM.api.family_variant_v1.get>>;
export type FamilyType = Awaited<ReturnType<typeof globalThis.PIM.api.family_v1.get>>;
export type AttributeType = Awaited<ReturnType<typeof globalThis.PIM.api.attribute_v1.get>>;
export type AttributeOptionType = Awaited<ReturnType<typeof globalThis.PIM.api.attribute_option_v1.get>>;

export type VariantAttributeSetType = {
  level: number;
  axes: string[];
  attributes: string[];
};

export interface ModelTree {
  root: ProductModelType;
  subModels: ProductModelType[];
  variants: ProductType[];
}

export type AxisValuesByUuid = Record<string, Record<string, string>>;
