import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const applicationTables = {
  machines: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    location: v.string(),
    deviceId: v.string(),
    status: v.string(),
    relayState: v.optional(v.string()),
    automationMode: v.optional(v.string()),
    lastDataReceivedAt: v.optional(v.number()),
    signalStrength: v.optional(v.number()),
    batteryStatus: v.optional(v.string()),
    powerStatus: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_deviceId", ["deviceId"]),
  userProfiles: defineTable({
    userId: v.id("users"),
    email: v.string(),
    role: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),
  machineShares: defineTable({
    machineId: v.id("machines"),
    email: v.string(),
    permission: v.string(),
    sharedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_machineId", ["machineId"])
    .index("by_machineId_email", ["machineId", "email"])
    .index("by_email", ["email"]),
  sensors: defineTable({
    machineId: v.id("machines"),
    name: v.optional(v.string()),
    type: v.string(),
    unit: v.string(),
    thresholdWarning: v.number(),
    thresholdCritical: v.number(),
  })
    .index("by_machineId", ["machineId"])
    .index("by_machineId_type", ["machineId", "type"]),
  telemetry: defineTable({
    machineId: v.id("machines"),
    sensorId: v.id("sensors"),
    value: v.number(),
    timestamp: v.number(),
  })
    .index("by_machine_timestamp", ["machineId", "timestamp"])
    .index("by_machine_sensor_timestamp", ["machineId", "sensorId", "timestamp"]),
  alerts: defineTable({
    machineId: v.id("machines"),
    level: v.string(),
    message: v.string(),
    createdAt: v.number(),
  }).index("by_machine_createdAt", ["machineId", "createdAt"]),
  notificationLogs: defineTable({
    machineId: v.id("machines"),
    channel: v.string(),
    level: v.string(),
    message: v.string(),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_machine_createdAt", ["machineId", "createdAt"]),
  deviceCommands: defineTable({
    machineId: v.id("machines"),
    command: v.string(),
    status: v.string(),
    createdAt: v.number(),
  })
    .index("by_machine_createdAt", ["machineId", "createdAt"])
    .index("by_machine_status_createdAt", ["machineId", "status", "createdAt"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
