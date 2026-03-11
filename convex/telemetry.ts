import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireMachineAccess } from "./permissions";

const alertLevelFromMsi = (msi: number) => {
  if (msi >= 80) return "SHUTDOWN" as const;
  if (msi >= 70) return "CRITICAL" as const;
  if (msi >= 40) return "EARLY" as const;
  return "NORMAL" as const;
};

const sensorStress = (value: number, thresholdCritical: number) => {
  if (thresholdCritical <= 0) {
    return 0;
  }
  return Math.min(33.34, (value / thresholdCritical) * 33.34);
};

async function computeLatestMachineHealth(
  ctx: QueryCtx | MutationCtx,
  machineId: Id<"machines">,
) {
  const sensors = await ctx.db
    .query("sensors")
    .withIndex("by_machineId", (q) => q.eq("machineId", machineId))
    .collect();

  let temperatureValue: number | null = null;
  let vibrationValue: number | null = null;
  let currentValue: number | null = null;
  let temperatureStress = 0;
  let vibrationStress = 0;
  let currentStress = 0;
  let lastUpdatedAt = 0;

  for (const sensor of sensors) {
    const latestSample = await ctx.db
      .query("telemetry")
      .withIndex("by_machine_sensor_timestamp", (q) =>
        q.eq("machineId", machineId).eq("sensorId", sensor._id),
      )
      .order("desc")
      .first();

    if (!latestSample) {
      continue;
    }

    lastUpdatedAt = Math.max(lastUpdatedAt, latestSample.timestamp);

    if (sensor.type === "temperature") {
      temperatureValue = latestSample.value;
      temperatureStress = sensorStress(
        latestSample.value,
        sensor.thresholdCritical,
      );
    }
    if (sensor.type === "vibration") {
      vibrationValue = latestSample.value;
      vibrationStress = sensorStress(latestSample.value, sensor.thresholdCritical);
    }
    if (sensor.type === "current") {
      currentValue = latestSample.value;
      currentStress = sensorStress(latestSample.value, sensor.thresholdCritical);
    }
  }

  const msi = Number(
    (temperatureStress + vibrationStress + currentStress).toFixed(2),
  );
  const riskScore = Number(Math.min(100, msi).toFixed(2));
  const alertLevel = alertLevelFromMsi(msi);

  return {
    machineId,
    readings: {
      temperature: temperatureValue,
      vibration: vibrationValue,
      current: currentValue,
    },
    msi,
    riskScore,
    alertLevel,
    lastUpdatedAt,
  };
}

export const ingestTelemetry = mutation({
  args: {
    machineId: v.id("machines"),
    sensorId: v.id("sensors"),
    value: v.number(),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "editor");
    const sensor = await ctx.db.get(args.sensorId);
    if (!sensor || sensor.machineId !== args.machineId) {
      throw new Error("Sensor does not belong to the specified machine.");
    }

    const timestamp = args.timestamp ?? Date.now();
    const telemetryId = await ctx.db.insert("telemetry", {
      machineId: args.machineId,
      sensorId: args.sensorId,
      value: args.value,
      timestamp,
    });

    const health = await computeLatestMachineHealth(ctx, args.machineId);
    const latestAlert = await ctx.db
      .query("alerts")
      .withIndex("by_machine_createdAt", (q) => q.eq("machineId", args.machineId))
      .order("desc")
      .first();

    const shouldCreateAlert =
      health.alertLevel !== "NORMAL" && latestAlert?.level !== health.alertLevel;

    if (shouldCreateAlert) {
      await ctx.db.insert("alerts", {
        machineId: args.machineId,
        level: health.alertLevel,
        message: `MSI ${health.msi} reached ${health.alertLevel} level.`,
        createdAt: Date.now(),
      });
    }

    if (health.alertLevel === "SHUTDOWN" && latestAlert?.level !== "SHUTDOWN") {
      await ctx.db.insert("deviceCommands", {
        machineId: args.machineId,
        command: "relay_off",
        status: "pending",
        createdAt: Date.now(),
      });
    }

    return { telemetryId, ...health };
  },
});

export const getLatestTelemetry = query({
  args: {
    machineId: v.id("machines"),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    return await computeLatestMachineHealth(ctx, args.machineId);
  },
});

export const getTelemetryHistory = query({
  args: {
    machineId: v.id("machines"),
    sensorId: v.optional(v.id("sensors")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    const limit = Math.min(args.limit ?? 100, 500);
    const records = args.sensorId
      ? await ctx.db
          .query("telemetry")
          .withIndex("by_machine_sensor_timestamp", (q) =>
            q.eq("machineId", args.machineId).eq("sensorId", args.sensorId!),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("telemetry")
          .withIndex("by_machine_timestamp", (q) =>
            q.eq("machineId", args.machineId),
          )
          .order("desc")
          .take(limit);

    return records.reverse();
  },
});
