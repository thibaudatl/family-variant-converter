import { useState } from 'react';
import { useFamilies } from '../../hooks/useFamilies';
import { useFamilyVariants } from '../../hooks/useFamilyVariants';
import type { FamilyVariantType, ModelTree } from '../../types';

interface FamilyVariantStepProps {
  familyCode: string; // source family, used only to seed defaults + show current state
  trees: ModelTree[];
  onSelect: (variant: FamilyVariantType, targetFamilyCode: string) => void;
  onBack: () => void;
}

export function FamilyVariantStep({ familyCode, trees, onSelect, onBack }: FamilyVariantStepProps) {
  const { families, loading: familiesLoading, error: familiesError } = useFamilies();
  const [targetFamilyCode, setTargetFamilyCode] = useState(familyCode);
  const {
    variants,
    loading: variantsLoading,
    error: variantsError,
  } = useFamilyVariants(targetFamilyCode);
  const [selectedCode, setSelectedCode] = useState('');

  const currentFvCodes = new Set(trees.map((t) => t.root.family_variant));
  const selectedVariant = variants.find((v) => v.code === selectedCode) ?? null;

  const isCrossFamily = targetFamilyCode !== familyCode;
  const allAlreadyOnTarget =
    selectedVariant != null &&
    !isCrossFamily &&
    trees.every((t) => t.root.family_variant === selectedVariant.code);

  function handleContinue() {
    if (selectedVariant) onSelect(selectedVariant, targetFamilyCode);
  }

  function handleFamilyChange(newCode: string) {
    setTargetFamilyCode(newCode);
    setSelectedCode('');
  }

  if (familiesLoading) {
    return (
      <div className="flex items-center gap-3 py-8 justify-center">
        <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgb(148, 82, 186)', borderTopColor: 'transparent' }} />
        <span className="text-gray-600">Loading families...</span>
      </div>
    );
  }

  if (familiesError) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4">
        <p className="text-sm font-medium text-red-800">Failed to load families</p>
        <p className="text-sm text-red-700 mt-1">{familiesError}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Pick the target family and family variant the selected models should be migrated to.
        Source family: <span className="font-mono text-xs">{familyCode || '—'}</span>. Currently
        used variants:{' '}
        <span className="font-mono text-xs">{[...currentFvCodes].join(', ') || '—'}</span>.
      </p>

      <label className="block text-sm font-medium text-gray-700 mb-1">Target family</label>
      <select
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none bg-white mb-4"
        value={targetFamilyCode}
        onChange={(e) => handleFamilyChange(e.target.value)}
      >
        <option value="">— Select a family —</option>
        {families.map((f) => {
          const isSource = f.code === familyCode;
          const label = f.labels?.en_US ? ` — ${f.labels.en_US}` : '';
          return (
            <option key={f.code} value={f.code}>
              {f.code}
              {label}
              {isSource ? ' (source)' : ''}
            </option>
          );
        })}
      </select>

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Target family variant
        {targetFamilyCode && (
          <>
            {' '}
            (family: <strong>{targetFamilyCode}</strong>)
          </>
        )}
      </label>
      {variantsLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgb(148, 82, 186)', borderTopColor: 'transparent' }} />
          Loading family variants...
        </div>
      ) : variantsError ? (
        <p className="text-sm text-red-600">Failed to load family variants: {variantsError}</p>
      ) : variants.length === 0 ? (
        <p className="text-sm text-yellow-700">
          No family variants found for family <strong>{targetFamilyCode || '—'}</strong>.
        </p>
      ) : (
        <select
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none bg-white"
          value={selectedCode}
          onChange={(e) => setSelectedCode(e.target.value)}
        >
          <option value="">— Select a family variant —</option>
          {variants.map((v) => {
            const axesByLevel = (v.variantAttributeSets as Array<{ level: number; axes: string[] }>)
              .slice()
              .sort((a, b) => a.level - b.level)
              .map((s) => `L${s.level}: [${s.axes.join(', ')}]`)
              .join(' · ');
            const label = v.labels?.en_US ? ` — ${v.labels.en_US}` : '';
            const inUse = !isCrossFamily && currentFvCodes.has(v.code) ? ' (currently in use)' : '';
            return (
              <option key={v.code} value={v.code}>
                {v.code}
                {label} — {axesByLevel}
                {inUse}
              </option>
            );
          })}
        </select>
      )}

      {selectedVariant && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
          <p className="font-medium text-blue-800 mb-2">Target variant structure:</p>
          {selectedVariant.variantAttributeSets.map(
            (set: { level: number; axes: string[]; attributes: string[] }) => (
              <div key={set.level} className="mb-1">
                <span className="text-blue-700 font-medium">Level {set.level}:</span>{' '}
                <span className="text-blue-600">axes = [{set.axes.join(', ')}]</span>{' '}
                <span className="text-gray-500">
                  — attributes = [{set.attributes.join(', ')}]
                </span>
              </div>
            )
          )}
          <p className="mt-2 text-gray-600">
            {selectedVariant.variantAttributeSets.length === 1
              ? '1-level variant: root model → variant products'
              : '2-level variant: root model → sub-models → variant products'}
          </p>
        </div>
      )}

      {isCrossFamily && selectedVariant && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          Cross-family migration: models will be moved from{' '}
          <span className="font-mono">{familyCode}</span> to{' '}
          <span className="font-mono">{targetFamilyCode}</span>. Attributes not present on the
          target family will be dropped — review the preview step carefully.
        </div>
      )}

      {allAlreadyOnTarget && (
        <div className="mt-3 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
          All selected models already use this family variant. Nothing to migrate.
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
          onClick={handleContinue}
          disabled={!selectedVariant || allAlreadyOnTarget}
          className="flex-1 bg-white border disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed font-medium py-2 px-4 rounded-md transition-colors hover:bg-[rgba(148,82,186,0.06)]"
          style={!selectedVariant || allAlreadyOnTarget ? undefined : { borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
        >
          Review Axis Values →
        </button>
      </div>
    </div>
  );
}
