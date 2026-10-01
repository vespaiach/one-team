export function FieldError({ fieldId, message }: { fieldId: string; message: string }) {
  return (
    <p
      id={`${fieldId}-error`}
      className="mt-1 font-text text-caption text-ink wrap-anywhere">
      {message}
    </p>
  );
}