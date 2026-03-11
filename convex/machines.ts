import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ensureUserProfile, requireAdmin, requireMachineAccess } from "./permissions";

export const addMachine = mutation({
  args: {
    name: v.string(),
    location: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireAdmin(ctx);
    return await ctx.db.insert("machines", {
      ownerId: profile.userId,
      name: args.name,
      location: args.location,
      deviceId: args.deviceId,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const listMachines = query({
  handler: async (ctx) => {
    const profile = await ensureUserProfile(ctx);
    const ownedMachines = await ctx.db
      .query("machines")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", profile.userId))
      .order("desc")
      .collect();

    const sharedRecords = await ctx.db
      .query("machineShares")
      .withIndex("by_email", (q) => q.eq("email", profile.email))
      .collect();

    const sharedMachines = await Promise.all(
      sharedRecords.map((record) => ctx.db.get(record.machineId)),
    );

    const deduped = new Map<string, (typeof ownedMachines)[number]>();
    for (const machine of ownedMachines) {
      deduped.set(machine._id, machine);
    }
    for (const machine of sharedMachines) {
      if (machine) {
        deduped.set(machine._id, machine);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getMachineById = query({
  args: {
    machineId: v.id("machines"),
  },
  handler: async (ctx, args) => {
    const { machine, access } = await requireMachineAccess(ctx, args.machineId, "viewer");
    return { ...machine, access };
  },
});

export const getMyRole = query({
  handler: async (ctx) => {
    const profile = await ensureUserProfile(ctx);
    return { role: profile.role, email: profile.email };
  },
});

export const updateMachine = mutation({
  args: {
    machineId: v.id("machines"),
    name: v.string(),
    location: v.string(),
    deviceId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "editor");
    await ctx.db.patch(args.machineId, {
      name: args.name,
      location: args.location,
      deviceId: args.deviceId,
      status: args.status,
    });
    return args.machineId;
  },
});

export const deleteMachine = mutation({
  args: {
    machineId: v.id("machines"),
  },
  handler: async (ctx, args) => {
    const { access } = await requireMachineAccess(ctx, args.machineId, "owner");
    if (access !== "owner") {
      throw new Error("Only owner can delete machine.");
    }

    const sensors = await ctx.db
      .query("sensors")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .collect();
    for (const sensor of sensors) {
      const samples = await ctx.db
        .query("telemetry")
        .withIndex("by_machine_sensor_timestamp", (q) =>
          q.eq("machineId", args.machineId).eq("sensorId", sensor._id),
        )
        .collect();
      for (const sample of samples) {
        await ctx.db.delete(sample._id);
      }
      await ctx.db.delete(sensor._id);
    }

    const shares = await ctx.db
      .query("machineShares")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .collect();
    for (const share of shares) {
      await ctx.db.delete(share._id);
    }

    const commands = await ctx.db
      .query("deviceCommands")
      .withIndex("by_machine_createdAt", (q) => q.eq("machineId", args.machineId))
      .collect();
    for (const command of commands) {
      await ctx.db.delete(command._id);
    }

    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_machine_createdAt", (q) => q.eq("machineId", args.machineId))
      .collect();
    for (const alert of alerts) {
      await ctx.db.delete(alert._id);
    }

    await ctx.db.delete(args.machineId);
    return true;
  },
});
