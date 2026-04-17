import { cn } from '../lib/utils';

const STEPS = [
  { label: 'Load' },
  { label: 'Family Variant' },
  { label: 'Axis Values' },
  { label: 'Model Codes' },
  { label: 'Preview' },
  { label: 'Execute' },
];

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = currentStep > stepNum;
        const isCurrent = currentStep === stepNum;
        return (
          <div key={stepNum} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                  isCompleted && 'text-white',
                  !isCompleted && !isCurrent && 'bg-gray-200 text-gray-500'
                )}
                style={
                  isCompleted
                    ? { backgroundColor: 'rgb(148, 82, 186)' }
                    : isCurrent
                    ? {
                        backgroundColor: 'rgb(148, 82, 186)',
                        color: 'white',
                        outline: '2px solid rgba(148, 82, 186, 0.35)',
                        outlineOffset: '2px',
                      }
                    : undefined
                }
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              <span
                className={cn(
                  'text-xs mt-1 whitespace-nowrap',
                  !isCurrent && 'text-gray-500'
                )}
                style={isCurrent ? { color: 'rgb(148, 82, 186)', fontWeight: 500 } : undefined}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-8 mx-1 mb-4',
                  currentStep > stepNum ? 'bg-green-500' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
