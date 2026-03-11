import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export type AccessLevel = "owner" | "editor" | "viewer" | "none";
type Ctx = QueryCtx | MutationCtx;

const accessPriority: Record<Exclude<AccessLevel, "none">, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function requireAuthUser(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required.");
  }

  const user = await ctx.db.get(userId);
  if (!user || !user.email) {
    throw new Error("User email not available.");
  }

  return {
    userId,
    email: normalizeEmail(user.email),
  };
}

function getConfiguredAdminEmails() {
  const raw = process.env.ADMIN_EMAILS ?? "admin@apmd.com";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function ensureUserProfile(ctx: Ctx) {
  const auth = await requireAuthUser(ctx);
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", auth.userId))
    .first();

  const adminEmails = getConfiguredAdminEmails();
  const defaultRole = adminEmails.includes(auth.email) ? "admin" : "user";

  return {
    ...auth,
    role: existing?.role ?? defaultRole,
  };
}

export async function requireAdmin(ctx: Ctx) {
  const profile = await ensureUserProfile(ctx);
  if (profile.role !== "admin") {
    throw new Error("Only admins can create machines.");
  }
  return profile;
}

export async function resolveMachineAccess(
  ctx: Ctx,
  machine: Doc<"machines">,
): Promise<AccessLevel> {
  const profile = await ensureUserProfile(ctx);
  if (machine.ownerId === profile.userId) {
    return "owner";
  }

  const share = await ctx.db
    .query("machineShares")
    .withIndex("by_machineId_email", (q) =>
      q.eq("machineId", machine._id).eq("email", profile.email),
    )
    .first();

  if (!share) {
    return "none";
  }

  if (share.permission === "owner") {
    return "owner";
  }
  if (share.permission === "editor") {
    return "editor";
  }
  if (share.permission === "viewer") {
    return "viewer";
  }
  return "none";
}

export async function requireMachineAccess(
  ctx: Ctx,
  machineId: Id<"machines">,
  minimum: Exclude<AccessLevel, "none"> = "viewer",
) {
  const machine = await ctx.db.get(machineId);
  if (!machine) {
    throw new Error("Machine not found.");
  }

  const access = await resolveMachineAccess(ctx, machine);
  if (access === "none") {
    throw new Error("Machine not found.");
  }
  if (accessPriority[access] < accessPriority[minimum]) {
    throw new Error("Insufficient permissions.");
  }

  return { machine, access };
}
