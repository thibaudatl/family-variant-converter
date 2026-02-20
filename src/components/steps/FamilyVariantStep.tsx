import { useState } from 'react';
import { useFamilyVariants } from '../../hooks/useFamilyVariants';

type FamilyVariantType = Awaited<ReturnType<typeof globalThis.PIM.api.family_variant_v1.get>>;

interface FamilyVariantStepProps {
  familyCode: string;
  onSelect: (variant: FamilyVariantType) => void;
  onBack: () => void;
}

export function FamilyVariantStep({ familyCode, onSelect, onBack }: FamilyVariantStepProps) {
  const { variants, loading, error } = useFamilyVariants(familyCode);
  const [selectedCode, setSelectedCode] = useState('');

  const selectedVariant = variants.find((v) => v.code === selectedCode) ?? null;

  function handleContinue() {
    if (selectedVariant) onSelect(selectedVariant);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8 justify-center">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-600">Loading family variants...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4">
        <p className="text-sm font-medium text-red-800">Failed to load family variants</p>
        <p className="text-sm text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
        <p className="text-sm text-yellow-800">
          No family variants found for family <strong>{familyCode}</strong>. You must create a family
          variant in Akeneo before converting products.
        </p>
        <button onClick={onBack} className="mt-3 text-sm text-blue-600 hover:underline">
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Select the family variant that defines the product hierarchy. Products will be reorganized
        according to the variant's axis attributes.
      </p>

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Family variant for <strong>{familyCode}</strong>
      </label>
      <select
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        value={selectedCode}
        onChange={(e) => setSelectedCode(e.target.value)}
      >
        <option value="">— Select a family variant —</option>
        {variants.map((v) => (
          <option key={v.code} value={v.code}>
            {v.code}
            {v.labels?.en_US ? ` — ${v.labels.en_US}` : ''}
          </option>
        ))}
      </select>

      {selectedVariant && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
          <p className="font-medium text-blue-800 mb-2">Variant structure:</p>
          {selectedVariant.variantAttributeSets.map((set) => (
            <div key={set.level} className="mb-1">
              <span className="text-blue-700 font-medium">Level {set.level}:</span>{' '}
              <span className="text-blue-600">axes = [{set.axes.join(', ')}]</span>{' '}
              <span className="text-gray-500">
                — attributes = [{set.attributes.join(', ')}]
              </span>
            </div>
          ))}
          <p className="mt-2 text-gray-600">
            {selectedVariant.variantAttributeSets.length === 1
              ? '1-level variant: root model → variant products'
              : '2-level variant: root model → sub-models → variant products'}
          </p>
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
          disabled={!selectedVariant}
          className="flex-1 bg-white border disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed font-medium py-2 px-4 rounded-md transition-colors hover:bg-[rgba(148,82,186,0.06)]"
          style={!selectedVariant ? undefined : { borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
        >
          Review Axis Values →
        </button>
      </div>
    </div>
  );
}
