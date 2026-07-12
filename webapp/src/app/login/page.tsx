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
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent font-bold text-white">
            T
          </div>
          <h1 className="text-xl font-semibold">Tender Intelligence</h1>
          <p className="mt-1 text-sm text-neutral-500">
            CBA Benelux — internal access only
          </p>
        </div>
        {denied && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            That account isn&apos;t authorized for this app.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
