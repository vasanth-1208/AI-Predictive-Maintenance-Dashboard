"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded bg-slate-800 text-slate-200 border border-slate-600 font-semibold hover:bg-slate-700 transition-colors"
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
}
