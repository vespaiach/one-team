export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-(--color-bg) px-4 py-16">
      <div className="flex w-full max-w-(--size-card) flex-col">
        <div className="flex flex-col gap-6 border-2 border-(--color-divider) bg-(--color-bg) px-7.5 pt-7.5 pb-6.5">
          {children}
        </div>
      </div>
    </main>
  );
}