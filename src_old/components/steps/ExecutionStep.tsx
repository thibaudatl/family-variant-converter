import { useEffect, useRef, useState } from 'react';
import type { ProductType, VariantAttributeSetType } from '../../utils/validation';
import {
  isOneLevel,
  extractRootLevelValues,
  extractLevel1Values,
  extractVariantLevelValues,
  getLevel1GroupKey,
} from '../../utils/attributeDistribution';

interface LogEntry {
  id: string;
  message: string;
  status: 'pending' | 'running' | 'success' | 'error';
  detail?: string;
}

interface ExecutionStepProps {
  products: ProductType[];
  variantAttributeSets: VariantAttributeSetType[];
  axisValues: Record<string, Record<string, string>>;
  rootModelCode: string;
  subModelCodes: Record<string, string>;
  familyCode: string;
  selectedVariantCode: string;
}

export function ExecutionStep({
  products,
  variantAttributeSets,
  axisValues,
  rootModelCode,
  subModelCodes,
  familyCode,
  selectedVariantCode,
}: ExecutionStepProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const [createdModelCode, setCreatedModelCode] = useState<string | null>(null);
  const executed = useRef(false);

  function addEntry(id: string, message: string): void {
    setLog((prev) => [...prev, { id, message, status: 'pending' }]);
  }

  function updateEntry(id: string, status: LogEntry['status'], detail?: string): void {
    setLog((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status, detail } : e))
    );
  }

  useEffect(() => {
    if (executed.current) return;
    executed.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    const oneLevel = isOneLevel(variantAttributeSets);
    const firstProduct = products[0];

    // --- Step 1: Create root product model ---
    const rootId = 'root';
    addEntry(rootId, `Creating root product model "${rootModelCode}"...`);
    updateEntry(rootId, 'running');
    try {
      await globalThis.PIM.api.product_model_v1.post({
        data: {
          code: rootModelCode,
          family: familyCode,
          family_variant: selectedVariantCode,
          categories: firstProduct.categories ?? [],
          values: extractRootLevelValues(firstProduct, variantAttributeSets),
        },
      });
      updateEntry(rootId, 'success', `Root model "${rootModelCode}" created.`);
      setCreatedModelCode(rootModelCode);
    } catch (err) {
      updateEntry(
        rootId,
        'error',
        err instanceof Error ? err.message : String(err)
      );
      setDone(true);
      return;
    }

    // --- Step 2 (2-level): Create sub-product-models ---
    if (!oneLevel) {
      const groups = new Map<string, ProductType[]>();
      for (const product of products) {
        const key = getLevel1GroupKey(product.uuid, variantAttributeSets, axisValues);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(product);
      }

      for (const [groupKey, groupProducts] of groups) {
        const subCode = subModelCodes[groupKey];
        const representative = groupProducts[0];
        const subId = `sub_${groupKey}`;
        addEntry(subId, `Creating sub-model "${subCode}" (group: ${groupKey})...`);
        updateEntry(subId, 'running');
        try {
          const level1Set = variantAttributeSets.find((s) => s.level === 1);
          const level1AxisOverrides: Record<string, string> = {};
          for (const axis of level1Set?.axes ?? []) {
            level1AxisOverrides[axis] = axisValues[representative.uuid]?.[axis] ?? '';
          }
          await globalThis.PIM.api.product_model_v1.post({
            data: {
              code: subCode,
              family: familyCode,
              family_variant: selectedVariantCode,
              parent: rootModelCode,
              values: extractLevel1Values(representative, variantAttributeSets, level1AxisOverrides),
            },
          });
          updateEntry(subId, 'success', `Sub-model "${subCode}" created.`);
        } catch (err) {
          updateEntry(
            subId,
            'error',
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    }

    // --- Step 3: Patch each variant product ---
    for (const product of products) {
      const patchId = `patch_${product.uuid}`;
      const label = product.identifier ?? product.uuid.slice(0, 8);
      addEntry(patchId, `Patching product "${label}"...`);
      updateEntry(patchId, 'running');

      try {
        let parentCode: string;
        if (oneLevel) {
          parentCode = rootModelCode;
        } else {
          const key = getLevel1GroupKey(product.uuid, variantAttributeSets, axisValues);
          parentCode = subModelCodes[key] ?? rootModelCode;
        }

        const variantSet = variantAttributeSets.find((s) =>
          oneLevel ? s.level === 1 : s.level === 2
        );
        const axisOverrides: Record<string, string> = {};
        for (const axis of variantSet?.axes ?? []) {
          axisOverrides[axis] = axisValues[product.uuid]?.[axis] ?? '';
        }

        await globalThis.PIM.api.product_uuid_v1.patch({
          uuid: product.uuid,
          data: {
            parent: parentCode,
            values: extractVariantLevelValues(product, variantAttributeSets, axisOverrides),
          },
        });
        updateEntry(patchId, 'success', `Product "${label}" → parent "${parentCode}".`);
      } catch (err) {
        updateEntry(
          patchId,
          'error',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    setDone(true);
  }

  const successCount = log.filter((e) => e.status === 'success').length;
  const errorCount = log.filter((e) => e.status === 'error').length;

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Creating the variant hierarchy. Do not close this tab.
      </p>

      <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {log.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
            <span className="mt-0.5 flex-shrink-0">
              {entry.status === 'pending' && (
                <span className="text-gray-400">○</span>
              )}
              {entry.status === 'running' && (
                <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              {entry.status === 'success' && (
                <span className="text-green-600">✓</span>
              )}
              {entry.status === 'error' && (
                <span className="text-red-600">✗</span>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className={entry.status === 'error' ? 'text-red-700' : 'text-gray-800'}>
                {entry.message}
              </p>
              {entry.detail && (
                <p
                  className={`text-xs mt-0.5 ${
                    entry.status === 'error' ? 'text-red-500' : 'text-gray-500'
                  }`}
                >
                  {entry.detail}
                </p>
              )}
            </div>
          </div>
        ))}
        {!done && log.length === 0 && (
          <div className="px-4 py-4 text-sm text-gray-500 flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Initializing...
          </div>
        )}
      </div>

      {done && (
        <div className="mt-4 space-y-3">
          <div
            className={`rounded-md p-3 text-sm ${
              errorCount === 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <p
              className={`font-medium ${
                errorCount === 0 ? 'text-green-800' : 'text-yellow-800'
              }`}
            >
              {errorCount === 0
                ? 'Conversion completed successfully!'
                : `Completed with ${errorCount} error${errorCount !== 1 ? 's' : ''}.`}
            </p>
            <p className="text-xs mt-1 text-gray-600">
              {successCount} operation{successCount !== 1 ? 's' : ''} succeeded,{' '}
              {errorCount} failed.
            </p>
          </div>

          {createdModelCode && (
            <button
              onClick={() =>
                globalThis.PIM.navigate.internal(
                  `#/enrich/product-model/${createdModelCode}/enrich`
                )
              }
              className="w-full bg-white border font-medium py-2 px-4 rounded-md transition-colors text-sm hover:bg-[rgba(148,82,186,0.06)]"
              style={{ borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
            >
              Navigate to Product Model "{createdModelCode}" →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
