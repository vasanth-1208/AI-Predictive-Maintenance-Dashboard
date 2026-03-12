import { Authenticated, useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { MultiMachineDashboard } from "./MultiMachineDashboard";
import { SignInPage } from "./SignInPage";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

export default function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsBrowserOnline(true);
    const onOffline = () => setIsBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md h-16 flex justify-between items-center border-b border-slate-700 px-4">
        <div className="flex items-center gap-3">
          <span className={`badge ${isBrowserOnline ? "badge-accent" : "bg-amber-500/20 text-amber-200 border border-amber-400/40"}`}>
            {isBrowserOnline ? "STREAM CONNECTED" : "RECONNECTING..."}
          </span>
          <h2 className="text-xl font-semibold text-cyan-300">AI Predictive Maintenance Dashboard</h2>
        </div>
        <div className="flex items-center gap-2">
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-3 md:p-5">
        <div className="w-full">
          <ErrorBoundary>
            <Content />
          </ErrorBoundary>
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
      <Authenticated>
        <p className="text-sm text-slate-400 mb-1">
          Control Room Session: {loggedInUser?.email ?? "user"}
        </p>
      </Authenticated>
      <Authenticated>
        <MultiMachineDashboard />
      </Authenticated>
    </div>
  );
}
