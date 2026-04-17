import type { ProductType } from '../../utils/validation';
import { ValidationError } from '../ValidationError';

interface LoadingStepProps {
  loading: boolean;
  contextError: string | null;
  validationErrors: string[];
  products: ProductType[];
  familyCode: string;
  onContinue: () => void;
}

export function LoadingStep({
  loading,
  contextError,
  validationErrors,
  products,
  familyCode,
  onContinue,
}: LoadingStepProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600">Loading selected products...</p>
      </div>
    );
  }

  if (contextError) {
    return (
      <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
        <p className="text-sm font-medium text-yellow-800">Cannot start conversion</p>
        <p className="text-sm text-yellow-700 mt-1">{contextError}</p>
        <p className="text-sm text-yellow-600 mt-3">
          To use this tool, go to the product list, select 2 or more simple products from the
          same family, then open this tab.
        </p>
      </div>
    );
  }

  const hasErrors = validationErrors.length > 0;

  return (
    <div>
      <div className="rounded-md bg-gray-50 border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">
            {products.length} product{products.length !== 1 ? 's' : ''} selected
          </h3>
          <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">
            Family: {familyCode || '—'}
          </span>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {products.map((p) => (
            <div
              key={p.uuid}
              className="flex items-center gap-2 text-sm text-gray-700"
            >
              {p.parent ? (
                <span className="text-orange-500" title="Already has a parent">⚠</span>
              ) : (
                <span className="text-green-500">✓</span>
              )}
              <span className="font-mono text-xs truncate">
                {p.identifier ?? p.uuid}
              </span>
              {p.parent && (
                <span className="text-xs text-orange-600">(parent: {p.parent})</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {hasErrors && <ValidationError errors={validationErrors} />}

      {!hasErrors && (
        <button
          onClick={onContinue}
          className="mt-4 w-full bg-white border font-medium py-2 px-4 rounded-md transition-colors hover:bg-[rgba(148,82,186,0.06)]"
          style={{ borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
        >
          Select Family Variant →
        </button>
      )}

      {hasErrors && (
        <p className="mt-3 text-sm text-gray-500">
          Fix the errors above before continuing. Products with parents will be skipped or must be removed.
        </p>
      )}
    </div>
  );
}
