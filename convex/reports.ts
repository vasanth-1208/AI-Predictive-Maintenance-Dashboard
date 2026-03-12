import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireMachineAccess } from "./permissions";

export const getReportData = query({
  args: {
    machineId: v.id("machines"),
    startTimestamp: v.number(),
    endTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    if (args.endTimestamp < args.startTimestamp) {
      throw new Error("Invalid time range.");
    }

    const machine = await ctx.db.get(args.machineId);
    if (!machine) {
      throw new Error("Machine not found.");
    }

    const sensors = await ctx.db
      .query("sensors")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .collect();

    const telemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_machine_timestamp", (q) =>
        q
          .eq("machineId", args.machineId)
          .gte("timestamp", args.startTimestamp)
          .lte("timestamp", args.endTimestamp),
      )
      .order("desc")
      .take(2000);

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_machine_createdAt", (q) =>
        q.eq("machineId", args.machineId).gte("createdAt", args.startTimestamp).lte("createdAt", args.endTimestamp),
      )
      .order("desc")
      .take(300);

    const commands = await ctx.db
      .query("deviceCommands")
      .withIndex("by_machine_createdAt", (q) =>
        q.eq("machineId", args.machineId).gte("createdAt", args.startTimestamp).lte("createdAt", args.endTimestamp),
      )
      .order("desc")
      .take(400);

    const notificationLogs = await ctx.db
      .query("notificationLogs")
      .withIndex("by_machine_createdAt", (q) =>
        q.eq("machineId", args.machineId).gte("createdAt", args.startTimestamp).lte("createdAt", args.endTimestamp),
      )
      .order("desc")
      .take(300);

    const shares = await ctx.db
      .query("machineShares")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .collect();

    return {
      machine,
      sensors,
      telemetry: telemetry.reverse(),
      alerts: alerts.reverse(),
      commands: commands.reverse(),
      notificationLogs: notificationLogs.reverse(),
      shares,
    };
  },
});
