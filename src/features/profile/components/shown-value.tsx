export function ShownValue({ label, value }: { label: string; value: string }) {
  return (
    <fieldset
      aria-label={label}
      tabIndex={-1}
      className="m-0 flex flex-col gap-1 border-0 p-0">
      <span className="text-label text-(--color-text-muted)">{label}</span>
      <span className="text-control text-(--color-text)">{value}</span>
    </fieldset>
  );
}