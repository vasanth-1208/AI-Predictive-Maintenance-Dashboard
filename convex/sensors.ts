import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMachineAccess } from "./permissions";

export const addSensor = mutation({
  args: {
    machineId: v.id("machines"),
    name: v.optional(v.string()),
    type: v.string(),
    unit: v.string(),
    thresholdWarning: v.number(),
    thresholdCritical: v.number(),
  },
  handler: async (ctx, args) => {
    if (!args.type.trim()) {
      throw new Error("Sensor type is required.");
    }
    if (!args.name?.trim()) {
      throw new Error("Sensor name is required.");
    }
    await requireMachineAccess(ctx, args.machineId, "editor");
    return await ctx.db.insert("sensors", {
      ...args,
      name: args.name.trim(),
      type: args.type.trim().toLowerCase(),
      unit: args.unit.trim(),
    });
  },
});

export const listSensorsByMachine = query({
  args: {
    machineId: v.id("machines"),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    return await ctx.db
      .query("sensors")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .collect();
  },
});

export const updateSensor = mutation({
  args: {
    sensorId: v.id("sensors"),
    name: v.optional(v.string()),
    type: v.string(),
    unit: v.string(),
    thresholdWarning: v.number(),
    thresholdCritical: v.number(),
  },
  handler: async (ctx, args) => {
    const sensor = await ctx.db.get(args.sensorId);
    if (!sensor) {
      throw new Error("Sensor not found.");
    }
    await requireMachineAccess(ctx, sensor.machineId, "editor");
    await ctx.db.patch(args.sensorId, {
      name: args.name?.trim(),
      type: args.type.trim().toLowerCase(),
      unit: args.unit.trim(),
      thresholdWarning: args.thresholdWarning,
      thresholdCritical: args.thresholdCritical,
    });
    return args.sensorId;
  },
});

export const deleteSensor = mutation({
  args: {
    sensorId: v.id("sensors"),
  },
  handler: async (ctx, args) => {
    const sensor = await ctx.db.get(args.sensorId);
    if (!sensor) {
      throw new Error("Sensor not found.");
    }
    await requireMachineAccess(ctx, sensor.machineId, "editor");

    const samples = await ctx.db
      .query("telemetry")
      .withIndex("by_machine_sensor_timestamp", (q) =>
        q.eq("machineId", sensor.machineId).eq("sensorId", sensor._id),
      )
      .collect();
    for (const sample of samples) {
      await ctx.db.delete(sample._id);
    }

    await ctx.db.delete(args.sensorId);
    return true;
  },
});
