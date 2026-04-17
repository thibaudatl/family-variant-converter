import type { FamilyVariantType, ModelTree } from '../../types';

interface ConfirmationStepProps {
  trees: ModelTree[];
  targetVariant: FamilyVariantType;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmationStep({
  trees,
  targetVariant,
  onConfirm,
  onBack,
}: ConfirmationStepProps) {
  const totalRoots = trees.length;
  const totalSubModels = trees.reduce((sum, t) => sum + t.subModels.length, 0);
  const totalVariants = trees.reduce((sum, t) => sum + t.variants.length, 0);

  return (
    <div>
      <div className="rounded-md bg-red-50 border border-red-200 p-4 mb-4">
        <p className="text-sm font-medium text-red-800 mb-2">
          ⚠ This operation deletes and recreates each hierarchy.
        </p>
        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
          <li>
            <strong>{totalVariants}</strong> variant product
            {totalVariants !== 1 ? 's' : ''} will be deleted then recreated (UUIDs preserved).
          </li>
          <li>
            <strong>{totalSubModels}</strong> sub-product-model
            {totalSubModels !== 1 ? 's' : ''} will be deleted.
          </li>
          <li>
            <strong>{totalRoots}</strong> root product model
            {totalRoots !== 1 ? 's' : ''} will be deleted then recreated on family variant{' '}
            <span className="font-mono">{targetVariant.code}</span>.
          </li>
          <li>
            Attributes not present on the target family/family variant will be dropped
            permanently.
          </li>
          <li>
            If recreation fails, the original hierarchy will be restored from an in-memory
            snapshot — but this is best-effort (no server transaction). Keep this tab open
            until the run completes.
          </li>
        </ul>
      </div>

      <div className="rounded-md bg-gray-50 border border-gray-200 p-3 mb-4 text-xs text-gray-600">
        <p className="font-medium mb-1">Execution order (per hierarchy, sequential):</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Snapshot the existing root + sub-models + variants</li>
          <li>Delete variants, then sub-models, then root</li>
          <li>Recreate root, then sub-models, then variants (UUIDs preserved)</li>
          <li>On failure: restore from snapshot</li>
        </ol>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          Start migration ✓
        </button>
      </div>
    </div>
  );
}
