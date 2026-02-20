interface ValidationErrorProps {
  errors: string[];
}

export function ValidationError({ errors }: ValidationErrorProps) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-md bg-red-50 border border-red-200 p-3 mt-3">
      <p className="text-sm font-medium text-red-800 mb-1">Validation errors:</p>
      <ul className="list-disc list-inside space-y-0.5">
        {errors.map((e, i) => (
          <li key={i} className="text-sm text-red-700">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}
