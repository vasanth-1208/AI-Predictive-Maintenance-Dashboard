import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { ensureUserProfile, requireMachineAccess } from "./permissions";

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
  return Math.min(100, (value / thresholdCritical) * 100);
};

const workingHoursStress = (machineCreatedAt: number) => {
  const hours = (Date.now() - machineCreatedAt) / (1000 * 60 * 60);
  // Cap stress at 100 after ~1000 hours for a stable long-term contribution.
  return Math.min(100, (hours / 1000) * 100);
};

const healthLabelFromMsi = (msi: number) => {
  if (msi >= 85) return "CRITICAL";
  if (msi >= 70) return "HIGH RISK";
  if (msi >= 40) return "WARNING";
  return "GOOD";
};

async function computeLatestMachineHealth(
  ctx: QueryCtx | MutationCtx,
  machineId: Id<"machines">,
) {
  const machine = await ctx.db.get(machineId);
  if (!machine) {
    throw new Error("Machine not found.");
  }

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

  const hoursStress = workingHoursStress(machine.createdAt);
  const msi = Number(
    (
      0.35 * vibrationStress +
      0.3 * currentStress +
      0.2 * temperatureStress +
      0.15 * hoursStress
    ).toFixed(2),
  );
  const riskScore = Number(Math.min(100, msi).toFixed(2));
  const alertLevel = alertLevelFromMsi(msi);
  const machineHealth = healthLabelFromMsi(msi);

  const estimatedHoursToFailure =
    msi >= 85
      ? 4
      : msi >= 70
        ? 12
        : msi >= 40
          ? 48
          : 120;

  const reasons: string[] = [];
  if (vibrationStress >= currentStress && vibrationStress >= temperatureStress) {
    reasons.push("Increasing vibration trend");
  }
  if (currentStress >= 60) {
    reasons.push("High current usage");
  }
  if (temperatureStress >= 60) {
    reasons.push("Temperature above nominal profile");
  }
  if (reasons.length === 0) {
    reasons.push("Stable sensor profile");
  }

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
    machineHealth,
    stressBreakdown: {
      vibrationStress: Number(vibrationStress.toFixed(2)),
      currentStress: Number(currentStress.toFixed(2)),
      temperatureStress: Number(temperatureStress.toFixed(2)),
      workingHoursStress: Number(hoursStress.toFixed(2)),
    },
    failurePrediction: {
      probability: Number(Math.min(99, Math.max(3, msi)).toFixed(1)),
      estimatedHoursToFailure,
      reason: reasons.join(", "),
      recommendation:
        msi >= 70
          ? "Inspect motor bearings, alignment, and current load immediately."
          : msi >= 40
            ? "Schedule preventive maintenance within 48 hours."
            : "Continue routine monitoring.",
    },
    lastUpdatedAt,
  };
}

async function applyAlertingAndAutomation(
  ctx: MutationCtx,
  machine: any,
  health: {
    alertLevel: "NORMAL" | "EARLY" | "CRITICAL" | "SHUTDOWN";
    msi: number;
  },
) {
  const latestAlert = await ctx.db
    .query("alerts")
    .withIndex("by_machine_createdAt", (q) => q.eq("machineId", machine._id))
    .order("desc")
    .first();

  const shouldCreateAlert =
    health.alertLevel !== "NORMAL" && latestAlert?.level !== health.alertLevel;

  if (shouldCreateAlert) {
    await ctx.db.insert("alerts", {
      machineId: machine._id,
      level: health.alertLevel,
      message: `MSI ${health.msi} reached ${health.alertLevel} level.`,
      createdAt: Date.now(),
    });
    await ctx.db.insert("notificationLogs", {
      machineId: machine._id,
      channel: "dashboard",
      level: health.alertLevel,
      message: `Alert: ${health.alertLevel} triggered at MSI ${health.msi}.`,
      status: "sent",
      createdAt: Date.now(),
    });

    if ((machine.relayState ?? "on") !== "off") {
      if (health.alertLevel === "EARLY") {
        await ctx.db.insert("deviceCommands", {
          machineId: machine._id,
          command: "beep_short",
          status: "pending",
          createdAt: Date.now(),
        });
        await ctx.db.insert("notificationLogs", {
          machineId: machine._id,
          channel: "email",
          level: "EARLY",
          message: "Warning threshold crossed. Short buzzer command queued.",
          status: "pending",
          createdAt: Date.now(),
        });
      }
      if (health.alertLevel === "CRITICAL") {
        await ctx.db.insert("deviceCommands", {
          machineId: machine._id,
          command: "beep_long",
          status: "pending",
          createdAt: Date.now(),
        });
        await ctx.db.insert("notificationLogs", {
          machineId: machine._id,
          channel: "email",
          level: "CRITICAL",
          message: "Critical threshold crossed. Long buzzer command queued.",
          status: "pending",
          createdAt: Date.now(),
        });
      }
    }
  }

  if (
    (machine.relayState ?? "on") !== "off" &&
    (machine.automationMode ?? "auto") === "auto" &&
    health.alertLevel === "SHUTDOWN" &&
    latestAlert?.level !== "SHUTDOWN"
  ) {
    await ctx.db.insert("deviceCommands", {
      machineId: machine._id,
      command: "relay_off",
      status: "pending",
      createdAt: Date.now(),
    });
    await ctx.db.patch(machine._id, { relayState: "off" });
    await ctx.db.insert("notificationLogs", {
      machineId: machine._id,
      channel: "email",
      level: "SHUTDOWN",
      message: "Emergency shutdown executed automatically.",
      status: "pending",
      createdAt: Date.now(),
    });
  }
}

export const ingestTelemetry = mutation({
  args: {
    machineId: v.id("machines"),
    sensorId: v.id("sensors"),
    value: v.number(),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { machine } = await requireMachineAccess(ctx, args.machineId, "editor");
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
    await ctx.db.patch(args.machineId, { lastDataReceivedAt: timestamp });

    const health = await computeLatestMachineHealth(ctx, args.machineId);
    await applyAlertingAndAutomation(ctx, machine, health);

    return { telemetryId, ...health };
  },
});

export const ingestDeviceSnapshot = mutation({
  args: {
    deviceId: v.string(),
    temperature: v.optional(v.number()),
    vibration: v.optional(v.number()),
    current: v.optional(v.number()),
    timestamp: v.optional(v.number()),
    signalStrength: v.optional(v.number()),
    batteryStatus: v.optional(v.string()),
    powerStatus: v.optional(v.string()),
    ingestKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requiredKey = process.env.ESP32_INGEST_KEY;
    if (requiredKey && args.ingestKey !== requiredKey) {
      throw new Error("Unauthorized ingest key.");
    }

    const machine = await ctx.db
      .query("machines")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .first();
    if (!machine) {
      throw new Error("No machine configured for this deviceId.");
    }

    const sensors = await ctx.db
      .query("sensors")
      .withIndex("by_machineId", (q) => q.eq("machineId", machine._id))
      .collect();
    const byType = new Map(sensors.map((sensor) => [sensor.type, sensor]));
    const timestamp = args.timestamp ?? Date.now();

    const writes: Array<{ sensorId: Id<"sensors">; value: number }> = [];
    if (args.temperature != null && byType.has("temperature")) {
      writes.push({ sensorId: byType.get("temperature")!._id, value: args.temperature });
    }
    if (args.vibration != null && byType.has("vibration")) {
      writes.push({ sensorId: byType.get("vibration")!._id, value: args.vibration });
    }
    if (args.current != null && byType.has("current")) {
      writes.push({ sensorId: byType.get("current")!._id, value: args.current });
    }

    for (const write of writes) {
      await ctx.db.insert("telemetry", {
        machineId: machine._id,
        sensorId: write.sensorId,
        value: write.value,
        timestamp,
      });
    }

    await ctx.db.patch(machine._id, {
      lastDataReceivedAt: timestamp,
      signalStrength: args.signalStrength,
      batteryStatus: args.batteryStatus,
      powerStatus: args.powerStatus,
    });

    const health = await computeLatestMachineHealth(ctx, machine._id);
    await applyAlertingAndAutomation(ctx, machine, health);
    return { writes: writes.length, ...health };
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

export const getTelemetryByRange = query({
  args: {
    machineId: v.id("machines"),
    startTimestamp: v.number(),
    endTimestamp: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    if (args.endTimestamp < args.startTimestamp) {
      throw new Error("Invalid time range.");
    }

    const limit = Math.min(args.limit ?? 1000, 5000);
    const records = await ctx.db
      .query("telemetry")
      .withIndex("by_machine_timestamp", (q) =>
        q
          .eq("machineId", args.machineId)
          .gte("timestamp", args.startTimestamp)
          .lte("timestamp", args.endTimestamp),
      )
      .order("desc")
      .take(limit);

    return records.reverse();
  },
});

export const getRecentAlerts = query({
  args: {
    machineId: v.id("machines"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    const limit = Math.min(args.limit ?? 20, 100);
    return await ctx.db
      .query("alerts")
      .withIndex("by_machine_createdAt", (q) => q.eq("machineId", args.machineId))
      .order("desc")
      .take(limit);
  },
});

export const getNotificationLogs = query({
  args: {
    machineId: v.id("machines"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    const limit = Math.min(args.limit ?? 20, 100);
    return await ctx.db
      .query("notificationLogs")
      .withIndex("by_machine_createdAt", (q) => q.eq("machineId", args.machineId))
      .order("desc")
      .take(limit);
  },
});

export const getHealthTimeline = query({
  args: {
    machineId: v.id("machines"),
    rangeHours: v.number(),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
    const end = Date.now();
    const start = end - args.rangeHours * 60 * 60 * 1000;
    const telemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_machine_timestamp", (q) =>
        q.eq("machineId", args.machineId).gte("timestamp", start).lte("timestamp", end),
      )
      .order("asc")
      .take(5000);
    const sensors = await ctx.db
      .query("sensors")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .collect();
    const sensorById = new Map(sensors.map((s) => [s._id, s]));
    const byTimestamp = new Map<number, { temperature?: number; vibration?: number; current?: number }>();
    for (const row of telemetry) {
      const sensor = sensorById.get(row.sensorId);
      if (!sensor) continue;
      const bucket = byTimestamp.get(row.timestamp) ?? {};
      if (sensor.type === "temperature") bucket.temperature = row.value;
      if (sensor.type === "vibration") bucket.vibration = row.value;
      if (sensor.type === "current") bucket.current = row.value;
      byTimestamp.set(row.timestamp, bucket);
    }
    return Array.from(byTimestamp.entries()).map(([timestamp, values]) => {
      const temperatureSensor = sensors.find((s) => s.type === "temperature");
      const vibrationSensor = sensors.find((s) => s.type === "vibration");
      const currentSensor = sensors.find((s) => s.type === "current");
      const temperatureStress = values.temperature != null
        ? sensorStress(values.temperature, temperatureSensor?.thresholdCritical ?? 100)
        : 0;
      const vibrationStress = values.vibration != null
        ? sensorStress(values.vibration, vibrationSensor?.thresholdCritical ?? 100)
        : 0;
      const currentStress = values.current != null
        ? sensorStress(values.current, currentSensor?.thresholdCritical ?? 100)
        : 0;
      const msi = Number(
        (
          0.35 * vibrationStress +
          0.3 * currentStress +
          0.2 * temperatureStress +
          0.15 * 50
        ).toFixed(2),
      );
      return {
        timestamp,
        temperature: values.temperature ?? null,
        vibration: values.vibration ?? null,
        current: values.current ?? null,
        msi,
      };
    });
  },
});

export const getTelemetryTable = query({
  args: {
    machineId: v.id("machines"),
    startTimestamp: v.number(),
    endTimestamp: v.number(),
    alertLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMachineAccess(ctx, args.machineId, "viewer");
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
    const sensors = await ctx.db
      .query("sensors")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .collect();
    const sensorById = new Map(sensors.map((s) => [s._id, s]));
    const rowsByTime = new Map<number, { temperature?: number; vibration?: number; current?: number }>();
    for (const row of telemetry) {
      const sensor = sensorById.get(row.sensorId);
      if (!sensor) continue;
      const entry = rowsByTime.get(row.timestamp) ?? {};
      if (sensor.type === "temperature") entry.temperature = row.value;
      if (sensor.type === "vibration") entry.vibration = row.value;
      if (sensor.type === "current") entry.current = row.value;
      rowsByTime.set(row.timestamp, entry);
    }
    const temperatureSensor = sensors.find((s) => s.type === "temperature");
    const vibrationSensor = sensors.find((s) => s.type === "vibration");
    const currentSensor = sensors.find((s) => s.type === "current");
    const rows = Array.from(rowsByTime.entries()).map(([timestamp, values]) => {
      const temperatureStress = values.temperature != null
        ? sensorStress(values.temperature, temperatureSensor?.thresholdCritical ?? 100)
        : 0;
      const vibrationStress = values.vibration != null
        ? sensorStress(values.vibration, vibrationSensor?.thresholdCritical ?? 100)
        : 0;
      const currentStress = values.current != null
        ? sensorStress(values.current, currentSensor?.thresholdCritical ?? 100)
        : 0;
      const msi = Number(
        (
          0.35 * vibrationStress +
          0.3 * currentStress +
          0.2 * temperatureStress +
          0.15 * 50
        ).toFixed(2),
      );
      const alertLevel = alertLevelFromMsi(msi);
      return {
        timestamp,
        machineId: args.machineId,
        temperature: values.temperature ?? null,
        vibration: values.vibration ?? null,
        current: values.current ?? null,
        msi,
        status: healthLabelFromMsi(msi),
        alertLevel,
      };
    });
    return rows.filter((row) => !args.alertLevel || args.alertLevel === "ALL" || row.alertLevel === args.alertLevel);
  },
});

export const getFleetOverview = query({
  handler: async (ctx) => {
    const profile = await ensureUserProfile(ctx);
    const ownedMachines = await ctx.db
      .query("machines")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", profile.userId))
      .collect();
    const sharedRecords = await ctx.db
      .query("machineShares")
      .withIndex("by_email", (q) => q.eq("email", profile.email))
      .collect();
    const sharedMap = new Map(sharedRecords.map((record) => [record.machineId, record.permission]));
    const sharedMachines = await Promise.all(sharedRecords.map((record) => ctx.db.get(record.machineId)));

    const deduped = new Map<string, any>();
    for (const machine of ownedMachines) deduped.set(machine._id, machine);
    for (const machine of sharedMachines) {
      if (machine) deduped.set(machine._id, machine);
    }
    const machines = Array.from(deduped.values());

    const machineHealth = await Promise.all(
      machines.map(async (machine) => {
        const health = await computeLatestMachineHealth(ctx, machine._id);
        const online =
          machine.lastDataReceivedAt != null &&
          Date.now() - machine.lastDataReceivedAt <= 2 * 60 * 1000;
        return {
          ...machine,
          access: machine.ownerId === profile.userId ? "owner" : sharedMap.get(machine._id) ?? "viewer",
          online,
          msi: health.msi,
          riskScore: health.riskScore,
          machineHealth: health.machineHealth,
          readings: health.readings,
          alertLevel: health.alertLevel,
          lastUpdatedAt: health.lastUpdatedAt,
        };
      }),
    );

    const machinesOnline = machineHealth.filter((machine) => machine.online).length;
    const activeAlerts = machineHealth.filter(
      (machine) => machine.alertLevel === "CRITICAL" || machine.alertLevel === "SHUTDOWN",
    ).length;
    const avgHealthScore = machineHealth.length
      ? Math.round(
          machineHealth.reduce((sum, machine) => sum + (100 - machine.riskScore), 0) /
            machineHealth.length,
        )
      : 0;
    const latencySamples = machineHealth
      .filter((machine) => machine.lastDataReceivedAt)
      .map((machine) => Date.now() - machine.lastDataReceivedAt);
    const dataLatency = latencySamples.length
      ? Math.round(latencySamples.reduce((sum, value) => sum + value, 0) / latencySamples.length)
      : 0;

    return {
      machines: machineHealth.sort((a, b) => b.createdAt - a.createdAt),
      totals: {
        systemOnline: true,
        totalMachines: machineHealth.length,
        machinesOnline,
        activeAlerts,
        activeDevices: machinesOnline,
        avgHealthScore,
        dataLatency,
      },
    };
  },
});
