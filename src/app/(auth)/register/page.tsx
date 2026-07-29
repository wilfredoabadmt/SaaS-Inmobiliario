import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-subtle px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-bg p-8">
        <h1 className="text-lg font-[650] text-accent-text">Homya</h1>
        <p className="mt-1 text-sm text-text-3">Crea tu cuenta y tu agencia.</p>
        <div className="mt-6">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
