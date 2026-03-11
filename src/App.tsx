import { Authenticated, useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { MultiMachineDashboard } from "./MultiMachineDashboard";
import { SignInPage } from "./SignInPage";

export default function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SignInPage />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,#1e293b,#0b1220_60%)]">
      <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md h-16 flex justify-between items-center border-b border-slate-700 px-4">
        <h2 className="text-xl font-semibold text-cyan-300">AI Predictive Maintenance Dashboard</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-4 md:p-8">
        <div className="w-full max-w-6xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <div className="text-center mb-2">
        <h1 className="text-4xl font-bold text-white mb-2">
          Multi-Machine Monitoring Platform
        </h1>
        <Authenticated>
          <p className="text-base md:text-lg text-slate-300">
            Welcome back, {loggedInUser?.email ?? "friend"}!
          </p>
        </Authenticated>
      </div>

      <Authenticated>
        <MultiMachineDashboard />
      </Authenticated>
    </div>
  );
}
