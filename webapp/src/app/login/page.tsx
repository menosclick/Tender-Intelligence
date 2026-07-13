import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <svg viewBox="0 0 32 32" className="mx-auto mb-4 h-11 w-11" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--color-accent)" />
            <circle
              cx="16"
              cy="16"
              r="8.5"
              fill="none"
              stroke="var(--color-rail-fg)"
              strokeWidth="2"
              opacity="0.5"
            />
            <circle cx="16" cy="16" r="3.5" fill="var(--color-rail-fg)" />
          </svg>
          <h1 className="text-xl font-semibold tracking-tight">
            Tender Intelligence
          </h1>
          <p className="mt-1 text-sm text-fg-mid">
            CBA Benelux · internal access only
          </p>
        </div>
        {denied && (
          <p className="mb-4 rounded-lg border border-hot-line bg-hot-soft px-3 py-2 text-center text-sm text-hot">
            That account isn&apos;t authorized for this app.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
