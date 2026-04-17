import type {
  AxisValuesByUuid,
  FamilyVariantType,
  ModelTree,
} from '../../types';
import { useTargetPayloads } from '../../hooks/useTargetPayloads';

interface PreviewStepProps {
  trees: ModelTree[];
  targetVariant: FamilyVariantType;
  axisValues: AxisValuesByUuid;
  sourceFamilyCode: string;
  targetFamilyCode: string;
  onContinue: () => void;
  onBack: () => void;
}

export function PreviewStep({
  trees,
  targetVariant,
  axisValues,
  sourceFamilyCode,
  targetFamilyCode,
  onContinue,
  onBack,
}: PreviewStepProps) {
  const {
    payloadsByRootCode,
    sourceFamilyAttrs,
    targetFamilyAttrs,
    removedByFamilyChange,
    loading,
    error,
  } = useTargetPayloads(
    trees,
    targetVariant,
    axisValues,
    targetFamilyCode,
    sourceFamilyCode
  );
  const isCrossFamily = sourceFamilyCode !== targetFamilyCode;

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8 justify-center">
        <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgb(148, 82, 186)', borderTopColor: 'transparent' }} />
        <span className="text-gray-600">Computing target payload...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4">
        <p className="text-sm font-medium text-red-800">Failed to prepare preview</p>
        <p className="text-sm text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Review the target structure per product model. Values are shifted up/down the hierarchy
        to match the target family variant's levels — attributes are not lost between variants of
        the same family.
      </p>

      {isCrossFamily ? (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
          <p className="font-medium text-amber-800">
            Cross-family migration: <span className="font-mono">{sourceFamilyCode}</span> →{' '}
            <span className="font-mono">{targetFamilyCode}</span>
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Source family: {sourceFamilyAttrs.size} attrs · Target family:{' '}
            {targetFamilyAttrs.size} attrs
          </p>
          {removedByFamilyChange.length > 0 ? (
            <p className="text-xs text-amber-800 mt-2">
              <span className="font-medium">
                {removedByFamilyChange.length} attribute
                {removedByFamilyChange.length !== 1 ? 's' : ''} only on source family and will be
                removed:
              </span>{' '}
              <span className="font-mono">{removedByFamilyChange.join(', ')}</span>
            </p>
          ) : (
            <p className="text-xs text-amber-700 mt-2">
              No attributes will be removed — target family is a superset of the source family.
            </p>
          )}
        </div>
      ) : (
        <div className="mb-4 rounded-md bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
          Same-family migration ({sourceFamilyCode}). No attributes will be removed — only
          re-routed between root / sub-model / variant levels as the target family variant
          defines.
        </div>
      )}

      <div className="space-y-5">
        {trees.map((tree) => {
          const payload = payloadsByRootCode[tree.root.code];
          if (!payload) return null;
          return (
            <div
              key={tree.root.code}
              className="border border-gray-200 rounded-md overflow-hidden text-sm"
            >
              <div className="bg-blue-600 text-white px-4 py-2 font-semibold flex items-center gap-2">
                <span>📦</span>
                <span>Root: {payload.root.code}</span>
                <span className="text-xs text-blue-100 ml-2">
                  fv: {tree.root.family_variant} → {payload.root.familyVariant}
                </span>
              </div>

              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600 border-b border-gray-100">
                Root will hold {Object.keys(payload.root.values).length} attribute value
                {Object.keys(payload.root.values).length !== 1 ? 's' : ''}.
              </div>

              {payload.subModels.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {payload.subModels.map((sub) => {
                    const subVariants = payload.variants.filter(
                      (v) => v.parentCode === sub.code
                    );
                    return (
                      <div key={sub.code}>
                        <div className="flex items-center gap-2 px-5 py-2 bg-purple-50 border-b border-purple-100">
                          <span className="text-gray-400">└─</span>
                          <span className="text-purple-600">📂</span>
                          <span className="font-mono text-xs text-purple-800">
                            {sub.code}
                          </span>
                          <span className="text-xs text-purple-500 ml-2">
                            groupKey: {sub.groupKey} ·{' '}
                            {Object.keys(sub.values).length} value
                            {Object.keys(sub.values).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {subVariants.map((v) => (
                          <div
                            key={v.uuid}
                            className="flex items-center gap-2 px-9 py-1.5 bg-white"
                          >
                            <span className="text-gray-400">└─</span>
                            <span className="text-green-600">⬡</span>
                            <span className="font-mono text-xs text-gray-700">
                              {v.identifier ?? v.uuid.slice(0, 8)}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({Object.keys(v.values).length} value
                              {Object.keys(v.values).length !== 1 ? 's' : ''})
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {payload.subModels.length === 0 && (
                <div>
                  {payload.variants.map((v) => (
                    <div
                      key={v.uuid}
                      className="flex items-center gap-2 px-5 py-1.5 bg-white border-b border-gray-50 last:border-b-0"
                    >
                      <span className="text-gray-400">└─</span>
                      <span className="text-green-600">⬡</span>
                      <span className="font-mono text-xs text-gray-700">
                        {v.identifier ?? v.uuid.slice(0, 8)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({Object.keys(v.values).length} value
                        {Object.keys(v.values).length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          className="flex-1 bg-white border font-medium py-2 px-4 rounded-md transition-colors hover:bg-[rgba(148,82,186,0.06)]"
          style={{ borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
        >
          Confirm →
        </button>
      </div>
    </div>
  );
}
