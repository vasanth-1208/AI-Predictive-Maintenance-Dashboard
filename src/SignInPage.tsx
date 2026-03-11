import { SignInForm } from "./SignInForm";

export function SignInPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a,#020617_55%)] flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-white rounded-container border border-slate-200 shadow-xl p-6">
        <p className="text-xs tracking-[0.25em] uppercase text-slate-500 mb-2">AI Maintenance</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Sign in</h1>
        <p className="text-sm text-secondary mb-5">Access your machines and sensor operations.</p>
        <SignInForm />
      </section>
    </main>
  );
}
