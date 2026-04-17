import type { ModelTree } from '../../types';
import { ValidationError } from '../ValidationError';

const COMPONENT_VERSION = 'v0.6.1';

interface LoadingStepProps {
  loading: boolean;
  contextError: string | null;
  validationErrors: string[];
  trees: ModelTree[];
  familyCode: string;
  onRemoveTree: (rootCode: string) => void;
  onContinue: () => void;
}

export function LoadingStep({
  loading,
  contextError,
  validationErrors,
  trees,
  familyCode,
  onRemoveTree,
  onContinue,
}: LoadingStepProps) {
  const versionBadge = (
    <div className="flex justify-end mb-2">
      <span className="text-[11px] font-mono text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
        {COMPONENT_VERSION}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div>
        {versionBadge}
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgb(148, 82, 186)', borderTopColor: 'transparent' }} />
          <p className="text-gray-600">Loading selected product models...</p>
        </div>
      </div>
    );
  }

  if (contextError) {
    return (
      <div>
        {versionBadge}
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm font-medium text-yellow-800">Cannot start</p>
          <p className="text-sm text-yellow-700 mt-1">{contextError}</p>
          <p className="text-sm text-yellow-600 mt-3">
            Go to the product list, select one or more root product models (no parent), then open
            this tool.
          </p>
        </div>
      </div>
    );
  }

  const hasErrors = validationErrors.length > 0;
  const totalVariants = trees.reduce((sum, t) => sum + t.variants.length, 0);
  const totalSubModels = trees.reduce((sum, t) => sum + t.subModels.length, 0);

  return (
    <div>
      {versionBadge}
      <div className="rounded-md bg-gray-50 border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">
            {trees.length} product model{trees.length !== 1 ? 's' : ''} selected
          </h3>
          <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">
            Family: {familyCode || '—'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {totalSubModels} sub-model{totalSubModels !== 1 ? 's' : ''} · {totalVariants} variant
          product{totalVariants !== 1 ? 's' : ''}
        </p>
        <div className="max-h-96 overflow-y-auto space-y-3">
          {trees.map((tree) => (
            <div
              key={tree.root.code}
              className="border border-gray-200 rounded-md bg-white overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
                <span className="text-blue-600">📦</span>
                <span className="font-mono text-sm font-medium text-blue-800 flex-1">
                  {tree.root.code}
                </span>
                <span className="text-xs text-blue-600">
                  family_variant: {tree.root.family_variant}
                </span>
                <button
                  onClick={() => onRemoveTree(tree.root.code)}
                  className="text-xs text-red-600 hover:underline ml-2"
                  title="Remove from selection"
                >
                  Remove
                </button>
              </div>

              {tree.subModels.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {tree.subModels.map((sub) => {
                    const subVariants = tree.variants.filter((v) => v.parent === sub.code);
                    return (
                      <div key={sub.code}>
                        <div className="flex items-center gap-2 px-5 py-1.5 bg-purple-50">
                          <span className="text-gray-400">└─</span>
                          <span className="text-purple-600">📂</span>
                          <span className="font-mono text-xs text-purple-800">{sub.code}</span>
                          <span className="text-xs text-purple-500">
                            ({subVariants.length} variant{subVariants.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        {subVariants.map((v) => (
                          <div
                            key={v.uuid}
                            className="flex items-center gap-2 px-9 py-1 bg-white"
                          >
                            <span className="text-gray-400">└─</span>
                            <span className="text-green-600">⬡</span>
                            <span className="font-mono text-xs text-gray-700">
                              {v.identifier ?? v.uuid.slice(0, 8)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {tree.subModels.length === 0 && tree.variants.length > 0 && (
                <div>
                  {tree.variants.map((v) => (
                    <div
                      key={v.uuid}
                      className="flex items-center gap-2 px-5 py-1 bg-white border-b border-gray-50 last:border-b-0"
                    >
                      <span className="text-gray-400">└─</span>
                      <span className="text-green-600">⬡</span>
                      <span className="font-mono text-xs text-gray-700">
                        {v.identifier ?? v.uuid.slice(0, 8)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {tree.subModels.length === 0 && tree.variants.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-500 italic">
                  No children found under this model.
                </div>
              )}
            </div>
          ))}
          {trees.length === 0 && (
            <div className="text-sm text-gray-500 italic py-4 text-center">
              No product models remaining in the selection.
            </div>
          )}
        </div>
      </div>

      {hasErrors && <ValidationError errors={validationErrors} />}

      {!hasErrors && trees.length > 0 && (
        <button
          onClick={onContinue}
          className="mt-4 w-full bg-white border font-medium py-2 px-4 rounded-md transition-colors hover:bg-[rgba(148,82,186,0.06)]"
          style={{ borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
        >
          Select Target Family Variant →
        </button>
      )}

      {hasErrors && (
        <p className="mt-3 text-sm text-gray-500">
          Remove the offending models from the selection, or go back to the product list and
          fix the selection, before continuing.
        </p>
      )}
    </div>
  );
}
