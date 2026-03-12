import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthUser, requireMachineAccess } from "./permissions";

const commandValidator = v.union(
  v.literal("beep_short"),
  v.literal("beep_long"),
  v.literal("relay_off"),
  v.literal("relay_on"),
);

export const sendCommand = mutation({
  args: {
    machineId: v.id("machines"),
    command: commandValidator,
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "editor");
    const commandId = await ctx.db.insert("deviceCommands", {
      machineId: args.machineId,
      command: args.command,
      status: "pending",
      createdAt: Date.now(),
    });

    if (args.command === "relay_off") {
      await ctx.db.patch(args.machineId, { relayState: "off" });
    }
    if (args.command === "relay_on") {
      await ctx.db.patch(args.machineId, { relayState: "on" });
    }

    return commandId;
  },
});

export const getPendingCommands = query({
  args: {
    machineId: v.id("machines"),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    return await ctx.db
      .query("deviceCommands")
      .withIndex("by_machine_status_createdAt", (q) =>
        q.eq("machineId", args.machineId).eq("status", "pending"),
      )
      .order("desc")
      .collect();
  },
});

export const getRecentCommands = query({
  args: {
    machineId: v.id("machines"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    const limit = Math.min(args.limit ?? 20, 100);
    return await ctx.db
      .query("deviceCommands")
      .withIndex("by_machine_createdAt", (q) => q.eq("machineId", args.machineId))
      .order("desc")
      .take(limit);
  },
});

export const acknowledgeCommand = mutation({
  args: {
    commandId: v.id("deviceCommands"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);
    const command = await ctx.db.get(args.commandId);
    if (!command) {
      throw new Error("Command not found.");
    }
    const machine = await ctx.db.get(command.machineId);
    if (!machine) {
      throw new Error("Command not found.");
    }
    await requireMachineAccess(ctx, machine._id, "editor");

    const nextStatus = args.status ?? "acknowledged";
    await ctx.db.patch(args.commandId, { status: nextStatus });

    return { ...command, status: nextStatus };
  },
});
