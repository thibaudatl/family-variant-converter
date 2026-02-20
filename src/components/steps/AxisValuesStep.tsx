import { useEffect } from 'react';
import { useAttributeDetails } from '../../hooks/useAttributeDetails';
import type { ProductType, VariantAttributeSetType } from '../../utils/validation';
import { getAllAxes } from '../../utils/attributeDistribution';
import { getFirstScalarValue, validateUniqueCombinations } from '../../utils/validation';
import { ValidationError } from '../ValidationError';

interface AxisValuesStepProps {
  products: ProductType[];
  variantAttributeSets: VariantAttributeSetType[];
  axisValues: Record<string, Record<string, string>>;
  onAxisValuesChange: (updated: Record<string, Record<string, string>>) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function AxisValuesStep({
  products,
  variantAttributeSets,
  axisValues,
  onAxisValuesChange,
  onContinue,
  onBack,
}: AxisValuesStepProps) {
  const allAxes = getAllAxes(variantAttributeSets);
  const { attributes, options, loading, error } = useAttributeDetails(allAxes);

  // Pre-fill axis values from product values on mount / when products change
  useEffect(() => {
    if (products.length === 0) return;
    const prefilled: Record<string, Record<string, string>> = {};
    for (const product of products) {
      prefilled[product.uuid] = {};
      for (const axis of allAxes) {
        const existing = axisValues[product.uuid]?.[axis];
        if (existing !== undefined) {
          prefilled[product.uuid][axis] = existing;
        } else {
          prefilled[product.uuid][axis] = getFirstScalarValue(product.values, axis);
        }
      }
    }
    onAxisValuesChange(prefilled);
    // Run only when products/variant changes (allAxes is derived)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, variantAttributeSets]);

  function handleCellChange(uuid: string, axis: string, value: string) {
    const updated = {
      ...axisValues,
      [uuid]: { ...(axisValues[uuid] ?? {}), [axis]: value },
    };
    onAxisValuesChange(updated);
  }

  const validationErrors = validateUniqueCombinations(products, axisValues, variantAttributeSets);
  const canContinue = validationErrors.length === 0;

  const level1Set = variantAttributeSets.find((s) => s.level === 1);
  const level2Set = variantAttributeSets.find((s) => s.level === 2);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Review and edit the axis attribute values for each product. Values must be unique per
        variant combination.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgb(148, 82, 186)', borderTopColor: 'transparent' }} />
          Loading attribute details...
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 mb-3">Failed to load attribute details: {error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-3 py-2 font-medium text-gray-700 border border-gray-200">
                Product
              </th>
              {level1Set?.axes.map((axis) => (
                <th
                  key={axis}
                  className="text-left px-3 py-2 font-medium text-blue-700 border border-gray-200"
                >
                  {attributes[axis]?.labels?.en_US ?? axis}
                  <span className="ml-1 text-xs text-blue-400">(L1)</span>
                </th>
              ))}
              {level2Set?.axes.map((axis) => (
                <th
                  key={axis}
                  className="text-left px-3 py-2 font-medium text-purple-700 border border-gray-200"
                >
                  {attributes[axis]?.labels?.en_US ?? axis}
                  <span className="ml-1 text-xs text-purple-400">(L2)</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const rowValues = axisValues[product.uuid] ?? {};
              // Check if this row has a duplicate
              const rowKey = allAxes.map((a) => rowValues[a] ?? '').join('|');
              const isDuplicate =
                products.filter(
                  (p) =>
                    p.uuid !== product.uuid &&
                    allAxes.map((a) => axisValues[p.uuid]?.[a] ?? '').join('|') === rowKey
                ).length > 0;

              return (
                <tr
                  key={product.uuid}
                  className={isDuplicate ? 'bg-red-50' : 'hover:bg-gray-50'}
                >
                  <td className="px-3 py-2 border border-gray-200 font-mono text-xs text-gray-700">
                    {product.identifier ?? product.uuid.slice(0, 8)}
                  </td>
                  {allAxes.map((axis) => {
                    const attrType = attributes[axis]?.type ?? '';
                    const isSelect =
                      attrType === 'pim_catalog_simpleselect' ||
                      attrType === 'pim_catalog_multiselect';
                    const value = rowValues[axis] ?? '';

                    return (
                      <td key={axis} className="px-3 py-2 border border-gray-200">
                        {isSelect && options[axis] ? (
                          <select
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            value={value}
                            onChange={(e) => handleCellChange(product.uuid, axis, e.target.value)}
                          >
                            <option value="">—</option>
                            {options[axis].map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.labels?.en_US ?? opt.code}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={value}
                            onChange={(e) => handleCellChange(product.uuid, axis, e.target.value)}
                            placeholder={axis}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ValidationError errors={validationErrors} />

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="flex-1 bg-white border disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed font-medium py-2 px-4 rounded-md transition-colors hover:bg-[rgba(148,82,186,0.06)]"
          style={!canContinue ? undefined : { borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
        >
          Configure Model Codes →
        </button>
      </div>
    </div>
  );
}
