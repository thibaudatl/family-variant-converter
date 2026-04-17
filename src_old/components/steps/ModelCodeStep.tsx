import { useEffect } from 'react';
import type { ProductType, VariantAttributeSetType } from '../../utils/validation';
import { isOneLevel, getLevel1GroupKey, suggestSubModelCode } from '../../utils/attributeDistribution';

interface ModelCodeStepProps {
  products: ProductType[];
  variantAttributeSets: VariantAttributeSetType[];
  axisValues: Record<string, Record<string, string>>;
  familyCode: string;
  rootModelCode: string;
  subModelCodes: Record<string, string>;
  onRootModelCodeChange: (code: string) => void;
  onSubModelCodeChange: (groupKey: string, code: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ModelCodeStep({
  products,
  variantAttributeSets,
  axisValues,
  familyCode,
  rootModelCode,
  subModelCodes,
  onRootModelCodeChange,
  onSubModelCodeChange,
  onContinue,
  onBack,
}: ModelCodeStepProps) {
  const oneLevel = isOneLevel(variantAttributeSets);

  // Compute unique level-1 groups (for 2-level only)
  const level1Groups: string[] = [];
  if (!oneLevel) {
    const seen = new Set<string>();
    for (const product of products) {
      const key = getLevel1GroupKey(product.uuid, variantAttributeSets, axisValues);
      if (key && !seen.has(key)) {
        seen.add(key);
        level1Groups.push(key);
      }
    }
  }

  // Suggest root model code on mount
  useEffect(() => {
    if (!rootModelCode) {
      const ts = Date.now();
      onRootModelCodeChange(`${familyCode}_${ts}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suggest sub-model codes when root code or groups change
  useEffect(() => {
    if (!rootModelCode || oneLevel) return;
    for (const groupKey of level1Groups) {
      if (!subModelCodes[groupKey]) {
        onSubModelCodeChange(groupKey, suggestSubModelCode(rootModelCode, groupKey));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootModelCode, level1Groups.join(',')]);

  const rootCodeValid = /^[a-zA-Z0-9_-]+$/.test(rootModelCode);
  const subCodesValid = level1Groups.every((g) =>
    /^[a-zA-Z0-9_-]+$/.test(subModelCodes[g] ?? '')
  );
  const canContinue = rootCodeValid && (oneLevel || subCodesValid);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Configure the product model codes. Codes must be unique in Akeneo and can only contain
        letters, digits, underscores, and hyphens.
      </p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Root product model code
        </label>
        <input
          type="text"
          className={`w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            rootCodeValid ? 'border-gray-300' : 'border-red-400 bg-red-50'
          }`}
          value={rootModelCode}
          onChange={(e) => onRootModelCodeChange(e.target.value)}
          placeholder="e.g. tshirt_model_001"
        />
        {!rootCodeValid && (
          <p className="text-xs text-red-600 mt-1">
            Only letters, digits, underscores, and hyphens are allowed.
          </p>
        )}
      </div>

      {!oneLevel && level1Groups.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Sub-product-model codes (one per level-1 group):
          </p>
          <div className="space-y-3">
            {level1Groups.map((groupKey) => {
              const code = subModelCodes[groupKey] ?? '';
              const valid = /^[a-zA-Z0-9_-]+$/.test(code);
              return (
                <div key={groupKey}>
                  <label className="block text-xs text-gray-500 mb-1">
                    Group: <span className="font-mono text-gray-700">{groupKey}</span>
                  </label>
                  <input
                    type="text"
                    className={`w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      valid ? 'border-gray-300' : 'border-red-400 bg-red-50'
                    }`}
                    value={code}
                    onChange={(e) => onSubModelCodeChange(groupKey, e.target.value)}
                  />
                  {!valid && (
                    <p className="text-xs text-red-600 mt-1">
                      Only letters, digits, underscores, and hyphens are allowed.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          Preview Structure →
        </button>
      </div>
    </div>
  );
}
