import { useState } from 'react';
import { StepIndicator } from './components/StepIndicator';
import { LoadingStep } from './components/steps/LoadingStep';
import { FamilyVariantStep } from './components/steps/FamilyVariantStep';
import { AxisValuesStep } from './components/steps/AxisValuesStep';
import { ModelCodeStep } from './components/steps/ModelCodeStep';
import { PreviewStep } from './components/steps/PreviewStep';
import { ExecutionStep } from './components/steps/ExecutionStep';
import { useSelectedProducts } from './hooks/useSelectedProducts';

type AnyFamilyVariant = Awaited<ReturnType<typeof globalThis.PIM.api.family_variant_v1.get>>;
type AnyVariantAttributeSet = AnyFamilyVariant['variantAttributeSets'][number];

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function App() {
  const { products, familyCode, loading, contextError, validationErrors } =
    useSelectedProducts();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedVariant, setSelectedVariant] = useState<AnyFamilyVariant | null>(null);
  // axisValues: productUuid -> { axisCode -> value }
  const [axisValues, setAxisValues] = useState<Record<string, Record<string, string>>>({});
  const [rootModelCode, setRootModelCode] = useState('');
  const [subModelCodes, setSubModelCodes] = useState<Record<string, string>>({});

  const variantAttributeSets: AnyVariantAttributeSet[] =
    selectedVariant?.variantAttributeSets ?? [];

  function handleSubModelCodeChange(groupKey: string, code: string) {
    setSubModelCodes((prev) => ({ ...prev, [groupKey]: code }));
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Simple → Variant Converter</h1>
          <p className="text-sm text-gray-500 mt-1">
            Convert simple products into a variant product hierarchy
          </p>
        </div>

        <StepIndicator currentStep={currentStep} />

        {currentStep === 1 && (
          <LoadingStep
            loading={loading}
            contextError={contextError}
            validationErrors={validationErrors}
            products={products}
            familyCode={familyCode}
            onContinue={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <FamilyVariantStep
            familyCode={familyCode}
            onSelect={(variant) => {
              setSelectedVariant(variant);
              setCurrentStep(3);
            }}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && selectedVariant && (
          <AxisValuesStep
            products={products}
            variantAttributeSets={variantAttributeSets}
            axisValues={axisValues}
            onAxisValuesChange={setAxisValues}
            onContinue={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && selectedVariant && (
          <ModelCodeStep
            products={products}
            variantAttributeSets={variantAttributeSets}
            axisValues={axisValues}
            familyCode={familyCode}
            rootModelCode={rootModelCode}
            subModelCodes={subModelCodes}
            onRootModelCodeChange={setRootModelCode}
            onSubModelCodeChange={handleSubModelCodeChange}
            onContinue={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 5 && selectedVariant && (
          <PreviewStep
            products={products}
            variantAttributeSets={variantAttributeSets}
            axisValues={axisValues}
            rootModelCode={rootModelCode}
            subModelCodes={subModelCodes}
            onConfirm={() => setCurrentStep(6)}
            onBack={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 6 && selectedVariant && (
          <ExecutionStep
            products={products}
            variantAttributeSets={variantAttributeSets}
            axisValues={axisValues}
            rootModelCode={rootModelCode}
            subModelCodes={subModelCodes}
            familyCode={familyCode}
            selectedVariantCode={selectedVariant.code}
          />
        )}
      </div>
    </div>
  );
}
