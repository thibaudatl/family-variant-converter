import { useEffect, useState } from 'react';
import type { ModelTree, ProductModelType, ProductType } from '../types';

interface UseSelectedModelsResult {
  trees: ModelTree[];
  familyCode: string;
  loading: boolean;
  contextError: string | null;
  validationErrors: string[];
}

// Akeneo REST filter rules:
//   /product-models supports only `IN` (array) for `parent`.
//   /products-uuid supports both `=` (string) and `IN` (array) for `parent`.
// SDK serialization rules (from extension-sdk typings + observed behavior):
//   product_model_v1.list: `search` is typed `string` — callers must JSON.stringify.
//   product_uuid_v1.list:  `search` is typed `any`    — SDK stringifies internally.
function modelParentFilter(parentCode: string): string {
  return JSON.stringify({ parent: [{ operator: 'IN', value: [parentCode] }] });
}
function variantParentFilter(parentCode: string) {
  return { parent: [{ operator: '=', value: parentCode }] };
}

function describeErr(err: unknown): string {
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const resp = anyErr.response as Record<string, unknown> | undefined;
    const status = resp?.status ?? anyErr.status;
    const body = resp?.data ?? anyErr.data;
    const msg = anyErr.message ?? String(err);
    const bodyStr = body ? ` — ${JSON.stringify(body).slice(0, 300)}` : '';
    return `${msg}${status ? ` (HTTP ${status})` : ''}${bodyStr}`;
  }
  return String(err);
}

async function fetchChildModels(parentCode: string): Promise<ProductModelType[]> {
  const params = { search: modelParentFilter(parentCode), limit: 100 };
  try {
    const result = await globalThis.PIM.api.product_model_v1.list(params);
    return result.items ?? [];
  } catch (err) {
    console.error('[fvc] product_model_v1.list failed', { parentCode, params, err });
    throw new Error(`list child models of "${parentCode}": ${describeErr(err)}`);
  }
}

async function fetchChildVariants(parentCode: string): Promise<ProductType[]> {
  const params = { search: variantParentFilter(parentCode), limit: 100 };
  try {
    const result = await globalThis.PIM.api.product_uuid_v1.list(params);
    return result.items ?? [];
  } catch (err) {
    console.error('[fvc] product_uuid_v1.list failed', { parentCode, params, err });
    throw new Error(`list child variants of "${parentCode}": ${describeErr(err)}`);
  }
}

async function buildTree(rootCode: string): Promise<ModelTree> {
  let root: ProductModelType;
  try {
    root = await globalThis.PIM.api.product_model_v1.get({ code: rootCode });
  } catch (err) {
    console.error('[fvc] product_model_v1.get failed', { rootCode, err });
    throw new Error(`get root "${rootCode}": ${describeErr(err)}`);
  }
  const rawSubModels = await fetchChildModels(rootCode);
  const subModels = Array.from(
    new Map(rawSubModels.map((s) => [s.code, s])).values()
  );

  // Variants can hang off the root (1-level FV) or off each sub-model (2-level FV).
  const rawVariants: ProductType[] = [];
  if (subModels.length === 0) {
    rawVariants.push(...(await fetchChildVariants(rootCode)));
  } else {
    for (const sub of subModels) {
      rawVariants.push(...(await fetchChildVariants(sub.code)));
    }
  }
  // Dedup by uuid — API can return overlap depending on scope/pagination state.
  const variants = Array.from(
    new Map(rawVariants.map((v) => [v.uuid, v])).values()
  );

  return { root, subModels, variants };
}

export function useSelectedModels(): UseSelectedModelsResult {
  const [trees, setTrees] = useState<ModelTree[]>([]);
  const [familyCode, setFamilyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const context = globalThis.PIM.context;
        if (!('productGrid' in context) || !context.productGrid) {
          setContextError(
            'No product grid context found. Open this tool from the product list.'
          );
          setLoading(false);
          return;
        }
        const { productModelCodes } = context.productGrid;
        if (!productModelCodes || productModelCodes.length === 0) {
          setContextError(
            'No product models selected. Select at least one root product model in the grid, then open this tool.'
          );
          setLoading(false);
          return;
        }

        const errors: string[] = [];
        const built: ModelTree[] = [];
        for (const code of productModelCodes) {
          try {
            const tree = await buildTree(code);
            if (tree.root.parent) {
              errors.push(
                `Product model "${code}" has a parent ("${tree.root.parent}"). Only root-level product models are supported.`
              );
              continue;
            }
            built.push(tree);
          } catch (err) {
            errors.push(
              `Failed to load "${code}": ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }

        if (built.length > 0) {
          const firstFamily = built[0].root.family;
          for (const t of built) {
            if (t.root.family !== firstFamily) {
              errors.push(
                `Product model "${t.root.code}" belongs to family "${t.root.family}" but "${built[0].root.code}" belongs to "${firstFamily}". All selected models must share the same family.`
              );
            }
          }
          setFamilyCode(firstFamily ?? '');
        }

        setTrees(built);
        setValidationErrors(errors);
      } catch (err) {
        setContextError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { trees, familyCode, loading, contextError, validationErrors };
}
