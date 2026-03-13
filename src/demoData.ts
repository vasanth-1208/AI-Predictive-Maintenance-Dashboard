const now = Date.now();

export const demoFleetMachines = [
  {
    _id: "demo-mtr-101",
    name: "Induction Motor - Line 1",
    location: "Assembly Block A",
    deviceId: "MTR-101",
    status: "running",
    access: "owner",
    online: true,
    relayState: "on",
    automationMode: "auto",
    signalStrength: 93,
    batteryStatus: "96%",
    powerStatus: "Mains",
    lastDataReceivedAt: now - 18000,
    msi: 58.4,
    riskScore: 58.4,
    machineHealth: "WARNING",
    readings: { temperature: 72.6, vibration: 4.9, current: 13.1 },
  },
  {
    _id: "demo-pmp-204",
    name: "Cooling Pump - Line 2",
    location: "Utility Bay",
    deviceId: "PMP-204",
    status: "running",
    access: "owner",
    online: true,
    relayState: "on",
    automationMode: "auto",
    signalStrength: 89,
    batteryStatus: "91%",
    powerStatus: "Mains",
    lastDataReceivedAt: now - 22000,
    msi: 31.2,
    riskScore: 31.2,
    machineHealth: "GOOD",
    readings: { temperature: 49.2, vibration: 2.1, current: 8.4 },
  },
  {
    _id: "demo-cmp-309",
    name: "Air Compressor - Line 3",
    location: "Packaging Unit",
    deviceId: "CMP-309",
    status: "running",
    access: "owner",
    online: true,
    relayState: "on",
    automationMode: "auto",
    signalStrength: 78,
    batteryStatus: "83%",
    powerStatus: "Mains",
    lastDataReceivedAt: now - 9000,
    msi: 82.7,
    riskScore: 82.7,
    machineHealth: "CRITICAL",
    readings: { temperature: 89.1, vibration: 7.8, current: 19.7 },
  },
  {
    _id: "demo-mtr-412",
    name: "Conveyor Motor - Line 4",
    location: "Raw Material Feed",
    deviceId: "MTR-412",
    status: "running",
    access: "owner",
    online: true,
    relayState: "on",
    automationMode: "manual",
    signalStrength: 81,
    batteryStatus: "88%",
    powerStatus: "Mains",
    lastDataReceivedAt: now - 12000,
    msi: 71.9,
    riskScore: 71.9,
    machineHealth: "HIGH RISK",
    readings: { temperature: 83.3, vibration: 6.2, current: 16.4 },
  },
  {
    _id: "demo-pmp-118",
    name: "Hydraulic Pump - Reserve",
    location: "Backup Plant Room",
    deviceId: "PMP-118",
    status: "inactive",
    access: "owner",
    online: false,
    relayState: "off",
    automationMode: "manual",
    signalStrength: 0,
    batteryStatus: "N/A",
    powerStatus: "Disconnected",
    lastDataReceivedAt: now - 5 * 60 * 60 * 1000,
    msi: 0,
    riskScore: 0,
    machineHealth: "GOOD",
    readings: { temperature: null, vibration: null, current: null },
  },
] as const;

export const demoFleetTotals = {
  machinesOnline: 4,
  activeAlerts: 2,
  avgHealthScore: 54,
  dataLatency: 710,
};

const sensorCatalog = {
  temperature: {
    _id: "sensor-temperature",
    name: "Temperature Sensor",
    type: "temperature",
    unit: "deg C",
    thresholdWarning: 70,
    thresholdCritical: 85,
  },
  vibration: {
    _id: "sensor-vibration",
    name: "Vibration Sensor",
    type: "vibration",
    unit: "mm/s",
    thresholdWarning: 4.5,
    thresholdCritical: 7,
  },
  current: {
    _id: "sensor-current",
    name: "Current Sensor",
    type: "current",
    unit: "A",
    thresholdWarning: 12,
    thresholdCritical: 17,
  },
} as const;

const machineTelemetrySeries: Record<string, Array<{ minutesAgo: number; temperature: number | null; vibration: number | null; current: number | null; msi: number; status: string; alertLevel: string }>> = {
  "demo-cmp-309": [
    { minutesAgo: 55, temperature: 76.4, vibration: 6.1, current: 15.3, msi: 64.1, status: "WARNING", alertLevel: "EARLY" },
    { minutesAgo: 42, temperature: 80.8, vibration: 6.7, current: 16.1, msi: 69.8, status: "WARNING", alertLevel: "EARLY" },
    { minutesAgo: 28, temperature: 84.5, vibration: 7.1, current: 18.6, msi: 76.9, status: "HIGH RISK", alertLevel: "CRITICAL" },
    { minutesAgo: 16, temperature: 86.2, vibration: 7.5, current: 19.1, msi: 80.1, status: "HIGH RISK", alertLevel: "CRITICAL" },
    { minutesAgo: 4, temperature: 89.1, vibration: 7.8, current: 19.7, msi: 82.7, status: "CRITICAL", alertLevel: "SHUTDOWN" },
  ],
  "demo-mtr-412": [
    { minutesAgo: 70, temperature: 68.1, vibration: 4.6, current: 12.4, msi: 49.2, status: "WARNING", alertLevel: "EARLY" },
    { minutesAgo: 48, temperature: 71.4, vibration: 5.1, current: 13.8, msi: 55.6, status: "WARNING", alertLevel: "EARLY" },
    { minutesAgo: 24, temperature: 78.4, vibration: 5.6, current: 15.2, msi: 66.1, status: "WARNING", alertLevel: "EARLY" },
    { minutesAgo: 8, temperature: 83.3, vibration: 6.2, current: 16.4, msi: 71.9, status: "HIGH RISK", alertLevel: "CRITICAL" },
  ],
  "demo-mtr-101": [
    { minutesAgo: 75, temperature: 63.2, vibration: 3.8, current: 10.8, msi: 37.4, status: "GOOD", alertLevel: "NORMAL" },
    { minutesAgo: 52, temperature: 66.4, vibration: 4.1, current: 11.6, msi: 42.1, status: "WARNING", alertLevel: "EARLY" },
    { minutesAgo: 30, temperature: 70.7, vibration: 4.5, current: 12.7, msi: 51.2, status: "WARNING", alertLevel: "EARLY" },
    { minutesAgo: 12, temperature: 72.6, vibration: 4.9, current: 13.1, msi: 58.4, status: "WARNING", alertLevel: "EARLY" },
  ],
  "demo-pmp-204": [
    { minutesAgo: 80, temperature: 45.1, vibration: 1.8, current: 7.2, msi: 26.8, status: "GOOD", alertLevel: "NORMAL" },
    { minutesAgo: 46, temperature: 46.3, vibration: 1.9, current: 7.8, msi: 28.3, status: "GOOD", alertLevel: "NORMAL" },
    { minutesAgo: 14, temperature: 49.2, vibration: 2.1, current: 8.4, msi: 31.2, status: "GOOD", alertLevel: "NORMAL" },
  ],
  "demo-pmp-118": [
    { minutesAgo: 300, temperature: null, vibration: null, current: null, msi: 0, status: "GOOD", alertLevel: "NORMAL" },
  ],
};

function timestampFromMinutesAgo(minutesAgo: number) {
  return now - minutesAgo * 60 * 1000;
}

export function isDemoMachineId(machineId: string | null | undefined) {
  return typeof machineId === "string" && machineId.startsWith("demo-");
}

export function getDemoFleetOverview() {
  return {
    machines: [...demoFleetMachines],
    totals: { ...demoFleetTotals },
  };
}

export function getDemoMachine(machineId: string) {
  return demoFleetMachines.find((machine) => machine._id === machineId) ?? null;
}

export function getDemoSensors() {
  return Object.values(sensorCatalog);
}

export function getDemoLatestTelemetry(machineId: string) {
  const machine = getDemoMachine(machineId);
  const rows = machineTelemetrySeries[machineId] ?? [];
  const latest = rows[rows.length - 1];
  if (!machine || !latest) return null;
  return {
    machineId,
    readings: {
      temperature: latest.temperature,
      vibration: latest.vibration,
      current: latest.current,
    },
    msi: latest.msi,
    riskScore: latest.msi,
    alertLevel: latest.alertLevel,
    machineHealth: machine.machineHealth,
    failurePrediction: {
      reason:
        machineId === "demo-cmp-309"
          ? "Increasing vibration trend, High current usage, Temperature above nominal profile"
          : machineId === "demo-mtr-412"
            ? "Increasing vibration trend, Temperature above nominal profile"
            : machineId === "demo-pmp-118"
              ? "Signal lost from edge device"
              : "Stable sensor profile",
    },
    lastUpdatedAt: machine.lastDataReceivedAt,
  };
}

export function getDemoTelemetryHistory(machineId: string) {
  const rows = machineTelemetrySeries[machineId] ?? [];
  return rows.flatMap((row) => {
    const timestamp = timestampFromMinutesAgo(row.minutesAgo);
    return [
      row.temperature == null
        ? null
        : { _id: `${machineId}-${timestamp}-temp`, machineId, sensorId: sensorCatalog.temperature._id, value: row.temperature, timestamp },
      row.vibration == null
        ? null
        : { _id: `${machineId}-${timestamp}-vib`, machineId, sensorId: sensorCatalog.vibration._id, value: row.vibration, timestamp },
      row.current == null
        ? null
        : { _id: `${machineId}-${timestamp}-cur`, machineId, sensorId: sensorCatalog.current._id, value: row.current, timestamp },
    ].filter(Boolean);
  });
}

export function getDemoHealthTimeline(machineId: string) {
  const rows = machineTelemetrySeries[machineId] ?? [];
  return rows.map((row) => ({
    timestamp: timestampFromMinutesAgo(row.minutesAgo),
    temperature: row.temperature,
    vibration: row.vibration,
    current: row.current,
    msi: row.msi,
  }));
}

export function getDemoTelemetryTable(machineId: string, alertLevel?: string) {
  const rows = machineTelemetrySeries[machineId] ?? [];
  return rows
    .map((row) => ({
      timestamp: timestampFromMinutesAgo(row.minutesAgo),
      machineId,
      temperature: row.temperature,
      vibration: row.vibration,
      current: row.current,
      msi: row.msi,
      status: row.status,
      alertLevel: row.alertLevel,
    }))
    .filter((row) => !alertLevel || alertLevel === "ALL" || row.alertLevel === alertLevel)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getDemoAlerts(machineId: string) {
  if (machineId === "demo-cmp-309") {
    return [
      {
        _id: "alert-demo-1",
        createdAt: timestampFromMinutesAgo(16),
        level: "CRITICAL",
        message: "Current and vibration crossed the critical threshold. Long alarm queued.",
      },
      {
        _id: "alert-demo-2",
        createdAt: timestampFromMinutesAgo(4),
        level: "SHUTDOWN",
        message: "MSI crossed 80. Automatic shutdown recommended to protect compressor bearings.",
      },
    ];
  }
  if (machineId === "demo-mtr-412") {
    return [
      {
        _id: "alert-demo-3",
        createdAt: timestampFromMinutesAgo(8),
        level: "CRITICAL",
        message: "Motor load is rising rapidly. Inspect alignment and bearing wear.",
      },
    ];
  }
  if (machineId === "demo-pmp-118") {
    return [
      {
        _id: "alert-demo-4",
        createdAt: timestampFromMinutesAgo(300),
        level: "EARLY",
        message: "Device communication lost. Sensor values unavailable.",
      },
    ];
  }
  return [];
}

export function getDemoCommands(machineId: string) {
  if (machineId === "demo-cmp-309") {
    return [
      { _id: "cmd-1", createdAt: timestampFromMinutesAgo(16), command: "beep_long" },
      { _id: "cmd-2", createdAt: timestampFromMinutesAgo(4), command: "relay_off" },
    ];
  }
  if (machineId === "demo-mtr-412") {
    return [{ _id: "cmd-3", createdAt: timestampFromMinutesAgo(8), command: "beep_short" }];
  }
  return [];
}

export function getDemoShares() {
  return [
    { _id: "share-1", email: "adminapmd@gmail.com", permission: "owner" },
    { _id: "share-2", email: "maintenance.team@factory.com", permission: "viewer" },
  ];
}
