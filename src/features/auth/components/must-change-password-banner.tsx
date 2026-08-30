export function MustChangePasswordBanner() {
  return (
    <div className="w-full bg-[var(--color-advisory-fill)] px-4 py-2 text-center text-sm text-[var(--color-advisory-text)]">
      Your password is still the one set when this server was installed.
    </div>
  );
}