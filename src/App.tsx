import { useState } from 'react';
import { StepIndicator } from './components/StepIndicator';
import { LoadingStep } from './components/steps/LoadingStep';
import { FamilyVariantStep } from './components/steps/FamilyVariantStep';
import { AxisValuesStep } from './components/steps/AxisValuesStep';
import { PreviewStep } from './components/steps/PreviewStep';
import { ConfirmationStep } from './components/steps/ConfirmationStep';
import { ExecutionStep } from './components/steps/ExecutionStep';
import { useSelectedModels } from './hooks/useSelectedModels';
import type { AxisValuesByUuid, FamilyVariantType, ModelTree } from './types';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function App() {
  const { trees: initialTrees, familyCode, loading, contextError, validationErrors } =
    useSelectedModels();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [trees, setTrees] = useState<ModelTree[] | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<FamilyVariantType | null>(null);
  const [targetFamilyCode, setTargetFamilyCode] = useState('');
  const [axisValues, setAxisValues] = useState<AxisValuesByUuid>({});

  // Seed trees once they're loaded; allow step 1 to forward them into state.
  const activeTrees = trees ?? initialTrees;

  function handleRemoveTree(rootCode: string) {
    const next = (trees ?? initialTrees).filter((t) => t.root.code !== rootCode);
    setTrees(next);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Change Family Variant</h1>
          <p className="text-sm text-gray-500 mt-1">
            Migrate selected root product models to a different family variant
          </p>
        </div>

        <StepIndicator currentStep={currentStep} />

        {currentStep === 1 && (
          <LoadingStep
            loading={loading}
            contextError={contextError}
            validationErrors={validationErrors}
            trees={activeTrees}
            familyCode={familyCode}
            onRemoveTree={handleRemoveTree}
            onContinue={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <FamilyVariantStep
            familyCode={familyCode}
            trees={activeTrees}
            onSelect={(variant, target) => {
              setSelectedVariant(variant);
              setTargetFamilyCode(target);
              setCurrentStep(3);
            }}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && selectedVariant && (
          <AxisValuesStep
            trees={activeTrees}
            targetVariant={selectedVariant}
            axisValues={axisValues}
            onAxisValuesChange={setAxisValues}
            onContinue={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && selectedVariant && (
          <PreviewStep
            trees={activeTrees}
            targetVariant={selectedVariant}
            axisValues={axisValues}
            sourceFamilyCode={familyCode}
            targetFamilyCode={targetFamilyCode || familyCode}
            onContinue={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 5 && selectedVariant && (
          <ConfirmationStep
            trees={activeTrees}
            targetVariant={selectedVariant}
            onConfirm={() => setCurrentStep(6)}
            onBack={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 6 && selectedVariant && (
          <ExecutionStep
            trees={activeTrees}
            targetVariant={selectedVariant}
            axisValues={axisValues}
            familyCode={targetFamilyCode || familyCode}
            sourceFamilyCode={familyCode}
            targetFamilyCode={targetFamilyCode || familyCode}
          />
        )}
      </div>
    </div>
  );
}
