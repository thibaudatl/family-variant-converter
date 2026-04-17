import type { ProductType, VariantAttributeSetType } from '../../utils/validation';
import { isOneLevel, getLevel1GroupKey, getAllAxes } from '../../utils/attributeDistribution';

interface PreviewStepProps {
  products: ProductType[];
  variantAttributeSets: VariantAttributeSetType[];
  axisValues: Record<string, Record<string, string>>;
  rootModelCode: string;
  subModelCodes: Record<string, string>;
  onConfirm: () => void;
  onBack: () => void;
}

export function PreviewStep({
  products,
  variantAttributeSets,
  axisValues,
  rootModelCode,
  subModelCodes,
  onConfirm,
  onBack,
}: PreviewStepProps) {
  const oneLevel = isOneLevel(variantAttributeSets);
  const allAxes = getAllAxes(variantAttributeSets);
  const level1Set = variantAttributeSets.find((s) => s.level === 1);

  function getAxisLabel(product: ProductType): string {
    return allAxes.map((a) => `${a}=${axisValues[product.uuid]?.[a] ?? '—'}`).join(', ');
  }

  if (oneLevel) {
    return (
      <div>
        <p className="text-sm text-gray-600 mb-4">
          Review the structure that will be created. Click "Create Structure" to proceed.
        </p>

        <div className="border border-gray-200 rounded-md overflow-hidden text-sm">
          <div className="bg-blue-600 text-white px-4 py-2 font-semibold flex items-center gap-2">
            <span>📦</span>
            <span>Root Model: {rootModelCode}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {products.map((p) => (
              <div key={p.uuid} className="flex items-center gap-3 px-6 py-2 bg-white hover:bg-gray-50">
                <span className="text-gray-400">└─</span>
                <span className="text-green-600">⬡</span>
                <span className="font-mono text-xs text-gray-700">
                  {p.identifier ?? p.uuid.slice(0, 8)}
                </span>
                <span className="text-xs text-gray-500">({getAxisLabel(p)})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600">
          <p className="font-medium mb-1">What will happen:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Create root product model <strong>{rootModelCode}</strong></li>
            <li>Patch each of the {products.length} products to set parent = {rootModelCode}</li>
          </ol>
        </div>

        <NavigationButtons onBack={onBack} onConfirm={onConfirm} />
      </div>
    );
  }

  // 2-level: group by level-1 axes
  const groups = new Map<string, ProductType[]>();
  for (const product of products) {
    const key = getLevel1GroupKey(product.uuid, variantAttributeSets, axisValues);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(product);
  }

  const level2Set = variantAttributeSets.find((s) => s.level === 2);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Review the 2-level hierarchy that will be created.
      </p>

      <div className="border border-gray-200 rounded-md overflow-hidden text-sm">
        <div className="bg-blue-600 text-white px-4 py-2 font-semibold flex items-center gap-2">
          <span>📦</span>
          <span>Root Model: {rootModelCode}</span>
        </div>
        <div className="divide-y divide-gray-200">
          {[...groups.entries()].map(([groupKey, groupProducts]) => {
            const subCode = subModelCodes[groupKey] ?? groupKey;
            return (
              <div key={groupKey}>
                <div className="flex items-center gap-3 px-4 py-2 bg-purple-50 border-b border-purple-100">
                  <span className="text-gray-400">└─</span>
                  <span className="text-purple-600">📂</span>
                  <span className="font-medium text-purple-800">Sub-model: {subCode}</span>
                  <span className="text-xs text-purple-500">
                    ({level1Set?.axes.map((a) => {
                      const rep = groupProducts[0];
                      return `${a}=${axisValues[rep?.uuid ?? '']?.[a] ?? '—'}`;
                    }).join(', ')})
                  </span>
                </div>
                {groupProducts.map((p) => (
                  <div
                    key={p.uuid}
                    className="flex items-center gap-3 px-8 py-1.5 bg-white hover:bg-gray-50 border-b border-gray-50"
                  >
                    <span className="text-gray-400">└─</span>
                    <span className="text-green-600">⬡</span>
                    <span className="font-mono text-xs text-gray-700">
                      {p.identifier ?? p.uuid.slice(0, 8)}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({level2Set?.axes.map((a) => `${a}=${axisValues[p.uuid]?.[a] ?? '—'}`).join(', ')})
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600">
        <p className="font-medium mb-1">What will happen:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Create root product model <strong>{rootModelCode}</strong></li>
          <li>Create {groups.size} sub-product-model{groups.size !== 1 ? 's' : ''}</li>
          <li>Patch each of the {products.length} products to set their parent</li>
        </ol>
      </div>

      <NavigationButtons onBack={onBack} onConfirm={onConfirm} />
    </div>
  );
}

function NavigationButtons({
  onBack,
  onConfirm,
}: {
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex gap-3 mt-6">
      <button
        onClick={onBack}
        className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
      >
        ← Back
      </button>
      <button
        onClick={onConfirm}
        className="flex-1 bg-white border font-medium py-2 px-4 rounded-md transition-colors hover:bg-[rgba(148,82,186,0.06)]"
        style={{ borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
      >
        Create Structure ✓
      </button>
    </div>
  );
}
