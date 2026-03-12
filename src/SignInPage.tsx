import { SignInForm } from "./SignInForm";

export function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-slate-950/80 rounded-container border border-slate-700 shadow-2xl p-6 backdrop-blur-sm">
        <p className="text-xs tracking-[0.3em] uppercase text-cyan-300 mb-2">AI Maintenance</p>
        <h1 className="text-3xl font-bold text-white mb-2">Secure Sign In</h1>
        <p className="subtle-text mb-5">Access machine operations, telemetry, and shared controls.</p>
        <SignInForm />
      </section>
    </main>
  );
}
