import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser, requireMachineAccess } from "./permissions";

const permissionValidator = v.union(
  v.literal("owner"),
  v.literal("editor"),
  v.literal("viewer"),
);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const shareMachine = mutation({
  args: {
    machineId: v.id("machines"),
    email: v.string(),
    permission: permissionValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuthUser(ctx);
    const { access, machine } = await requireMachineAccess(ctx, args.machineId, "owner");

    if (access !== "owner") {
      throw new Error("Only owner can manage sharing.");
    }

    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("Email is required.");
    }

    const existing = await ctx.db
      .query("machineShares")
      .withIndex("by_machineId_email", (q) =>
        q.eq("machineId", args.machineId).eq("email", email),
      )
      .first();

    if (email === (await ctx.db.get(machine.ownerId))?.email?.toLowerCase()) {
      throw new Error("Owner already has full access.");
    }

    if (!existing) {
      return await ctx.db.insert("machineShares", {
        machineId: args.machineId,
        email,
        permission: args.permission,
        sharedBy: auth.userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(existing._id, {
      permission: args.permission,
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});

export const listMachineShares = query({
  args: {
    machineId: v.id("machines"),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    const shares = await ctx.db
      .query("machineShares")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .collect();
    return shares.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const removeMachineShare = mutation({
  args: {
    shareId: v.id("machineShares"),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db.get(args.shareId);
    if (!share) {
      throw new Error("Share not found.");
    }

    const { access } = await requireMachineAccess(ctx, share.machineId, "owner");
    if (access !== "owner") {
      throw new Error("Only owner can remove shares.");
    }

    await ctx.db.delete(args.shareId);
    return true;
  },
});
