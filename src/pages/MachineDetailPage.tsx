import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type MachineDetailPageProps = {
  machineId: string;
  convexApi: any;
  onOpenTelemetryView?: (machineId: string) => void;
};

const suggestedSensorTypes = ["temperature", "vibration", "current"];
const shareLevels = ["owner", "editor", "viewer"] as const;

function toTitleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function toDateTimeLocalValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function MachineDetailPage({
  machineId,
  convexApi,
  onOpenTelemetryView,
}: MachineDetailPageProps) {
  const machine = useQuery(convexApi.machines.getMachineById, { machineId });
  const loggedInUser = useQuery(convexApi.auth.loggedInUser);
  const sensors = useQuery(convexApi.sensors.listSensorsByMachine, { machineId }) ?? [];
  const latestTelemetry = useQuery(convexApi.telemetry.getLatestTelemetry, { machineId });
  const telemetryHistory =
    useQuery(convexApi.telemetry.getTelemetryHistory, { machineId, limit: 60 }) ?? [];
  const shares = useQuery(convexApi.shares.listMachineShares, { machineId }) ?? [];
  const recentAlerts = useQuery(convexApi.telemetry.getRecentAlerts, { machineId, limit: 20 }) ?? [];
  const recentCommands = useQuery(convexApi.commands.getRecentCommands, { machineId, limit: 20 }) ?? [];
  const [timelineRangeHours, setTimelineRangeHours] = useState(24);
  const healthTimeline =
    useQuery(convexApi.telemetry.getHealthTimeline, { machineId, rangeHours: timelineRangeHours }) ?? [];

  const addSensor = useMutation(convexApi.sensors.addSensor);
  const updateSensor = useMutation(convexApi.sensors.updateSensor);
  const deleteSensor = useMutation(convexApi.sensors.deleteSensor);
  const updateMachine = useMutation(convexApi.machines.updateMachine);
  const setAutomationMode = useMutation(convexApi.machines.setAutomationMode);
  const deleteMachine = useMutation(convexApi.machines.deleteMachine);
  const sendCommand = useMutation(convexApi.commands.sendCommand);
  const sendReportEmail = useAction(convexApi.reportsNode.sendMachineReportEmail);
  const downloadReportPdf = useAction(convexApi.reportsNode.downloadMachineReportPdf);
  const shareMachine = useMutation(convexApi.shares.shareMachine);
  const removeShare = useMutation(convexApi.shares.removeMachineShare);

  const [sensorName, setSensorName] = useState("");
  const [sensorType, setSensorType] = useState("");
  const [unit, setUnit] = useState("");
  const [warningThreshold, setWarningThreshold] = useState("");
  const [criticalThreshold, setCriticalThreshold] = useState("");
  const [savingSensor, setSavingSensor] = useState(false);
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [editingSensorName, setEditingSensorName] = useState("");
  const [editingSensorType, setEditingSensorType] = useState("");
  const [editingSensorUnit, setEditingSensorUnit] = useState("");
  const [editingSensorWarning, setEditingSensorWarning] = useState("");
  const [editingSensorCritical, setEditingSensorCritical] = useState("");

  const [machineName, setMachineName] = useState("");
  const [machineLocation, setMachineLocation] = useState("");
  const [machineDeviceId, setMachineDeviceId] = useState("");
  const [machineStatus, setMachineStatus] = useState("active");
  const [isEditingMachine, setIsEditingMachine] = useState(false);

  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<(typeof shareLevels)[number]>(
    "viewer",
  );
  const [sharing, setSharing] = useState(false);
  const [managingShareId, setManagingShareId] = useState<string | null>(null);
  const [managingPermission, setManagingPermission] =
    useState<(typeof shareLevels)[number]>("viewer");
  const [reportEmail, setReportEmail] = useState("");
  const [reportFrom, setReportFrom] = useState(() =>
    toDateTimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  );
  const [reportTo, setReportTo] = useState(() => toDateTimeLocalValue(new Date()));
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeView, setActiveView] = useState<"monitor" | "settings">("monitor");
  const [nowTs, setNowTs] = useState(Date.now());

  const startTimestamp = reportFrom ? new Date(reportFrom).getTime() : NaN;
  const endTimestamp = reportTo ? new Date(reportTo).getTime() : NaN;
  const telemetryRange =
    useQuery(
      convexApi.telemetry.getTelemetryByRange,
      activeView === "monitor" &&
        Number.isFinite(startTimestamp) &&
        Number.isFinite(endTimestamp) &&
        startTimestamp <= endTimestamp
        ? {
            machineId,
            startTimestamp,
            endTimestamp,
            limit: 1500,
          }
        : "skip",
    ) ?? [];

  useEffect(() => {
    if (!machine) return;
    setMachineName(machine.name);
    setMachineLocation(machine.location);
    setMachineDeviceId(machine.deviceId);
    setMachineStatus(machine.status);
  }, [machine?._id, machine?.name, machine?.location, machine?.deviceId, machine?.status]);

  useEffect(() => {
    if (!loggedInUser?.email) return;
    setReportEmail((prev) => prev || loggedInUser.email || "");
  }, [loggedInUser?.email]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const sensorsById = useMemo(() => {
    return new Map(sensors.map((sensor: any) => [sensor._id as string, sensor]));
  }, [sensors]);

  const chartPoints = useMemo(() => {
    return telemetryHistory.map((point: any) => {
      const sensor = sensorsById.get(point.sensorId as string);
      return {
        ...point,
        type: sensor?.type ?? "unknown",
        sensorName: sensor?.name ?? sensor?.type ?? "unknown",
        sensorUnit: sensor?.unit ?? "",
      };
    });
  }, [telemetryHistory, sensorsById]);

  const latestBySensor = useMemo(() => {
    const latestMap = new Map<string, any>();
    for (const point of [...chartPoints].reverse()) {
      if (!latestMap.has(point.sensorId)) {
        latestMap.set(point.sensorId, point);
      }
    }
    return latestMap;
  }, [chartPoints]);

  const reportRows = useMemo(() => {
    return (telemetryRange as any[]).map((row) => {
      const sensor = sensorsById.get(row.sensorId as string);
      return {
        timestamp: row.timestamp,
        sensorName: sensor?.name ?? sensor?.type ?? "unknown",
        sensorType: sensor?.type ?? "unknown",
        unit: sensor?.unit ?? "",
        value: row.value,
      };
    });
  }, [telemetryRange, sensorsById]);

  const temperatureSeries = useMemo(
    () =>
      chartPoints
        .filter((point: any) => point.type === "temperature")
        .map((point: any) => Number(point.value))
        .slice(-20),
    [chartPoints],
  );
  const vibrationSeries = useMemo(
    () =>
      chartPoints
        .filter((point: any) => point.type === "vibration")
        .map((point: any) => Number(point.value))
        .slice(-20),
    [chartPoints],
  );
  const currentSeries = useMemo(
    () =>
      chartPoints
        .filter((point: any) => point.type === "current")
        .map((point: any) => Number(point.value))
        .slice(-20),
    [chartPoints],
  );
  const msiSeries = useMemo(
    () => (healthTimeline as any[]).map((point) => Number(point.msi)).slice(-40),
    [healthTimeline],
  );

  const sensorByType = useMemo(() => {
    const map = new Map<string, any>();
    for (const sensor of sensors as any[]) {
      if (!map.has(sensor.type)) map.set(sensor.type, sensor);
    }
    return map;
  }, [sensors]);

  const latestTimestampLabel = latestTelemetry?.lastUpdatedAt
    ? new Date(latestTelemetry.lastUpdatedAt).toLocaleString()
    : "No telemetry yet";
  const latestAgeSeconds = latestTelemetry?.lastUpdatedAt
    ? Math.max(0, Math.floor((nowTs - latestTelemetry.lastUpdatedAt) / 1000))
    : null;
  const deviceOnline =
    machine?.lastDataReceivedAt != null && nowTs - machine.lastDataReceivedAt < 2 * 60 * 1000;

  const canEdit = machine?.access === "owner" || machine?.access === "editor";
  const canShare = machine?.access === "owner";
  const machineOn = (machine?.relayState ?? "on") !== "off";

  const handleAddSensor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSensor(true);
    try {
      const normalizedType = sensorType.trim().toLowerCase();
      if (!normalizedType) {
        throw new Error("Sensor type is required.");
      }
      if (!sensorName.trim()) {
        throw new Error("Sensor name is required.");
      }
      if (!unit.trim()) {
        throw new Error("Unit is required.");
      }
      if (!warningThreshold.trim() || !criticalThreshold.trim()) {
        throw new Error("Thresholds are required.");
      }
      await addSensor({
        machineId,
        name: sensorName.trim(),
        type: normalizedType,
        unit: unit.trim(),
        thresholdWarning: Number(warningThreshold),
        thresholdCritical: Number(criticalThreshold),
      });
      setSensorName("");
      setSensorType("");
      setUnit("");
      setWarningThreshold("");
      setCriticalThreshold("");
      toast.success("Sensor added.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingSensor(false);
    }
  };

  const handleCommand = async (
    command: "beep_short" | "beep_long" | "relay_off" | "relay_on",
  ) => {
    try {
      if (command === "relay_off") {
        const confirmed = window.confirm("Are you sure you want to turn OFF the relay?");
        if (!confirmed) return;
      }
      await sendCommand({ machineId, command });
      toast.success(`Command queued: ${command}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAutomationModeChange = async (mode: "auto" | "manual") => {
    try {
      await setAutomationMode({ machineId, mode });
      toast.success(`Mode switched to ${toTitleCase(mode)}.`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleShare = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSharing(true);
    try {
      await shareMachine({
        machineId,
        email: shareEmail.trim().toLowerCase(),
        permission: sharePermission,
      });
      setShareEmail("");
      toast.success("Machine shared.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSharing(false);
    }
  };

  const startManageAccess = (share: any) => {
    setManagingShareId(share._id);
    setManagingPermission(share.permission as (typeof shareLevels)[number]);
  };

  const saveManagedAccess = async (share: any) => {
    try {
      await shareMachine({
        machineId,
        email: share.email,
        permission: managingPermission,
      });
      setManagingShareId(null);
      toast.success("Access updated.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const startEditSensor = (sensor: any) => {
    setEditingSensorId(sensor._id);
    setEditingSensorName(sensor.name ?? sensor.type);
    setEditingSensorType(sensor.type);
    setEditingSensorUnit(sensor.unit);
    setEditingSensorWarning(String(sensor.thresholdWarning));
    setEditingSensorCritical(String(sensor.thresholdCritical));
  };

  const saveEditSensor = async () => {
    if (!editingSensorId) return;
    try {
      await updateSensor({
        sensorId: editingSensorId,
        name: editingSensorName,
        type: editingSensorType,
        unit: editingSensorUnit,
        thresholdWarning: Number(editingSensorWarning),
        thresholdCritical: Number(editingSensorCritical),
      });
      setEditingSensorId(null);
      toast.success("Sensor updated.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDeleteSensor = async (sensorId: string) => {
    const confirmed = window.confirm("Delete this sensor and all its telemetry?");
    if (!confirmed) return;
    try {
      await deleteSensor({ sensorId });
      toast.success("Sensor deleted.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleUpdateMachine = async () => {
    try {
      await updateMachine({
        machineId,
        name: machineName,
        location: machineLocation,
        deviceId: machineDeviceId,
        status: machineStatus,
      });
      setIsEditingMachine(false);
      toast.success("Machine updated.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleCancelMachineEdit = () => {
    if (!machine) return;
    setMachineName(machine.name);
    setMachineLocation(machine.location);
    setMachineDeviceId(machine.deviceId);
    setMachineStatus(machine.status);
    setIsEditingMachine(false);
  };

  const handleDeleteMachine = async () => {
    const confirmed = window.confirm(
      "Delete this machine and all linked sensors/telemetry/alerts/commands?",
    );
    if (!confirmed) return;
    try {
      await deleteMachine({ machineId });
      toast.success("Machine deleted.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    const confirmed = window.confirm("Remove access for this shared user?");
    if (!confirmed) return;
    try {
      await removeShare({ shareId });
      toast.success("Shared access removed.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || startTimestamp > endTimestamp) {
        toast.error("Please choose a valid date/time range.");
        return;
      }
      setDownloadingPdf(true);
      const result = await downloadReportPdf({
        machineId,
        startTimestamp,
        endTimestamp,
      });
      const binary = atob(result.pdfBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded.");
    } catch (error) {
      toast.error((error as Error).message || "Failed to generate PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!reportEmail.trim()) {
      toast.error("Recipient email is required.");
      return;
    }
    if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || startTimestamp > endTimestamp) {
      toast.error("Please choose a valid date/time range.");
      return;
    }
    setSendingEmail(true);
    setEmailStatus("Sending...");
    try {
      const result = await sendReportEmail({
        machineId,
        recipientEmail: reportEmail.trim(),
        startTimestamp,
        endTimestamp,
      });
      setEmailStatus(`Sent successfully (Message ID: ${result.messageId})`);
      toast.success("Email sent successfully.");
    } catch (error) {
      setEmailStatus(`Failed to send: ${(error as Error).message}`);
      toast.error((error as Error).message);
    } finally {
      setSendingEmail(false);
    }
  };

  if (!machine) {
    return (
      <section className="bg-slate-900 text-slate-100 rounded-container border border-slate-700 p-4 shadow-sm">
        <p className="text-slate-300 text-sm">Loading machine details...</p>
      </section>
    );
  }

  return (
    <section className="panel-dark text-slate-100 p-4">
      <div className="mb-4 rounded-container border border-slate-700 bg-slate-800/70 p-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs flex-1">
            <span className="badge badge-accent">{machine.name}</span>
            <span className="badge bg-slate-700/70 text-slate-100 border border-slate-600">
              Location: {machine.location}
            </span>
            <span className="badge bg-slate-700/70 text-slate-100 border border-slate-600">
              Device: {machine.deviceId}
            </span>
            <span className="badge bg-slate-700/70 text-slate-100 border border-slate-600">
              Access: {toTitleCase(machine.access)}
            </span>
            <span className="badge bg-slate-700/70 text-slate-100 border border-slate-600">
              Last Telemetry: {latestAgeSeconds == null ? "Not detected" : `${latestAgeSeconds}s ago`}
            </span>
            <span className={`badge ${deviceOnline ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40" : "bg-slate-700/70 text-slate-300 border border-slate-600"}`}>
              ESP32: {deviceOnline ? "Connected" : "Disconnected"}
            </span>
            <span className="badge bg-cyan-500/20 text-cyan-200 border border-cyan-400/40">
              Last Update: {latestAgeSeconds == null ? "N/A" : `${latestAgeSeconds}s`}
            </span>
          </div>
          <button
            type="button"
            className="action-btn action-btn-primary lg:min-w-[170px]"
            onClick={() => onOpenTelemetryView?.(machineId)}
          >
            Telemetry View
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-container border border-slate-700 bg-slate-800/70 p-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 items-end">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-cyan-200">Machine Stress Index</p>
              <div className="flex items-center gap-4 text-sm text-slate-200">
                <p>
                  Status: <span className="font-semibold">{latestTelemetry?.machineHealth ?? "GOOD"}</span>
                </p>
                <p>
                  MSI: <span className="font-bold text-white">{(latestTelemetry?.msi ?? 0).toFixed(2)}</span>
                  {"  "}Risk: <span className="font-semibold">{(latestTelemetry?.riskScore ?? 0).toFixed(2)}%</span>
                </p>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full ${
                  (latestTelemetry?.msi ?? 0) <= 40
                    ? "bg-emerald-400"
                    : (latestTelemetry?.msi ?? 0) <= 70
                      ? "bg-amber-400"
                      : (latestTelemetry?.msi ?? 0) <= 85
                        ? "bg-orange-400"
                        : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, latestTelemetry?.msi ?? 0))}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`action-btn w-full ${activeView === "monitor" ? "action-btn-primary" : "action-btn-secondary"}`}
              onClick={() => setActiveView("monitor")}
            >
              Monitoring View
            </button>
            <button
              type="button"
              className={`action-btn w-full ${activeView === "settings" ? "action-btn-primary" : "action-btn-secondary"}`}
              onClick={() => setActiveView("settings")}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {latestTelemetry?.alertLevel && latestTelemetry.alertLevel !== "NORMAL" && (
        <div
          className={`mb-4 rounded-container border px-4 py-3 ${
            latestTelemetry.alertLevel === "SHUTDOWN" || latestTelemetry.alertLevel === "CRITICAL"
              ? "border-rose-400/50 bg-rose-500/15"
              : "border-amber-400/50 bg-amber-500/15"
          }`}
        >
          <p className="text-sm font-semibold">
            {latestTelemetry.alertLevel === "SHUTDOWN" || latestTelemetry.alertLevel === "CRITICAL"
              ? "CRITICAL"
              : "WARNING"}
            :{" "}
            {latestTelemetry.failurePrediction?.reason ?? "Machine stress trend detected."}
          </p>
          <p className="text-xs text-slate-200 mt-1">
            {latestTelemetry.alertLevel === "SHUTDOWN"
              ? "Automatic shutdown can be triggered in AUTO mode when relay is ON."
              : "Recommended inspection within 24 hours."}
          </p>
        </div>
      )}

      {activeView === "settings" && canEdit && (
        <div className="mb-5 border border-slate-700 bg-slate-800/60 rounded-container p-3">
          <h4 className="section-title mb-2">Machine Details</h4>
          {isEditingMachine ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                <input
                  className="auth-input-field-dark"
                  value={machineName}
                  onChange={(event) => setMachineName(event.target.value)}
                  placeholder="Machine Name"
                />
                <input
                  className="auth-input-field-dark"
                  value={machineLocation}
                  onChange={(event) => setMachineLocation(event.target.value)}
                  placeholder="Location"
                />
                <input
                  className="auth-input-field-dark"
                  value={machineDeviceId}
                  onChange={(event) => setMachineDeviceId(event.target.value)}
                  placeholder="Device ID"
                />
                <select
                  className="auth-input-field-dark"
                  value={machineStatus}
                  onChange={(event) => setMachineStatus(event.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="running">Running</option>
                  <option value="stopped">Stopped</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="action-btn action-btn-primary"
                  onClick={() => void handleUpdateMachine()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="action-btn action-btn-secondary"
                  onClick={handleCancelMachineEdit}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-300">
                {machine.name} | {machine.location} | Device ID: {machine.deviceId} | Status:{" "}
                {toTitleCase(machine.status)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="action-btn action-btn-secondary"
                  onClick={() => setIsEditingMachine(true)}
                >
                  Edit
                </button>
                {machine.access === "owner" && (
                  <button
                    type="button"
                    className="action-btn action-btn-danger"
                    onClick={() => void handleDeleteMachine()}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <MetricCard
          label="Temperature"
          value={latestTelemetry?.readings?.temperature}
          sensor={sensorByType.get("temperature")}
        />
        <MetricCard
          label="Vibration"
          value={latestTelemetry?.readings?.vibration}
          sensor={sensorByType.get("vibration")}
        />
        <MetricCard
          label="Current"
          value={latestTelemetry?.readings?.current}
          sensor={sensorByType.get("current")}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 mb-5">
        <div className="border border-slate-700 bg-slate-800 rounded-container p-3">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="section-title">Machine Health Timeline</h4>
            <select
              className="auth-input-field-dark py-2 !w-auto min-w-[170px] max-w-[170px] flex-none ml-auto"
              value={timelineRangeHours}
              onChange={(event) => setTimelineRangeHours(Number(event.target.value))}
            >
              <option value={1}>Last Hour</option>
              <option value={24}>Last 24 Hours</option>
              <option value={168}>Last Week</option>
            </select>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <TrendCard title="Temperature Trend" values={temperatureSeries} color="#ff6b6b" />
            <TrendCard title="Vibration Trend" values={vibrationSeries} color="#fbbf24" />
            <TrendCard title="Current Trend" values={currentSeries} color="#60a5fa" />
            <TrendCard title="MSI Trend" values={msiSeries} color="#22d3ee" />
          </div>
        </div>
      </div>

      {activeView === "settings" && (
      <div className="mb-5">
        <h4 className="section-title mb-2">Sensors</h4>
        {canEdit ? (
          <form
            onSubmit={handleAddSensor}
            className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3 border border-slate-700 bg-slate-800/60 rounded-container p-3"
          >
            <datalist id="sensor-type-options">
              {suggestedSensorTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
            <input
              className="auth-input-field-dark"
              value={sensorName}
              onChange={(event) => setSensorName(event.target.value)}
              placeholder="Sensor Name"
              required
            />
            <input
              className="auth-input-field-dark"
              value={sensorType}
              list="sensor-type-options"
              onChange={(event) => setSensorType(event.target.value)}
              placeholder="Sensor Type"
              required
            />
            <input
              className="auth-input-field-dark"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="Unit"
              required
            />
            <input
              className="auth-input-field-dark"
              value={warningThreshold}
              onChange={(event) => setWarningThreshold(event.target.value)}
              type="number"
              placeholder="Warning Threshold"
              required
            />
            <input
              className="auth-input-field-dark"
              value={criticalThreshold}
              onChange={(event) => setCriticalThreshold(event.target.value)}
              type="number"
              placeholder="Critical Threshold"
              required
            />
            <button className="action-btn action-btn-primary" type="submit" disabled={savingSensor}>
              {savingSensor ? "Adding..." : "Add Sensor"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-amber-300 mb-3">You have view-only access for sensors.</p>
        )}

        <div className="overflow-auto border border-slate-700 rounded-container">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-200">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Sensor</th>
                <th className="text-left px-3 py-2">Unit</th>
                <th className="text-right px-3 py-2">Warning</th>
                <th className="text-right px-3 py-2">Critical</th>
                <th className="text-right px-3 py-2">Latest Value</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sensors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-slate-300">
                    No sensors linked yet.
                  </td>
                </tr>
              ) : (
                sensors.map((sensor: any) => {
                  const latest = latestBySensor.get(sensor._id);
                  const isEditing = editingSensorId === sensor._id;
                  return (
                    <tr key={sensor._id} className="border-t border-slate-700">
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className="auth-input-field-dark py-2"
                            value={editingSensorName}
                            onChange={(event) => setEditingSensorName(event.target.value)}
                          />
                        ) : (
                          sensor.name ?? sensor.type
                        )}
                      </td>
                      <td className="px-3 py-2 capitalize">
                        {isEditing ? (
                          <input
                            className="auth-input-field-dark py-2"
                            value={editingSensorType}
                            onChange={(event) => setEditingSensorType(event.target.value)}
                          />
                        ) : (
                          sensor.type
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className="auth-input-field-dark py-2"
                            value={editingSensorUnit}
                            onChange={(event) => setEditingSensorUnit(event.target.value)}
                          />
                        ) : (
                          sensor.unit
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input
                            className="auth-input-field-dark py-2 text-right"
                            type="number"
                            value={editingSensorWarning}
                            onChange={(event) => setEditingSensorWarning(event.target.value)}
                          />
                        ) : (
                          sensor.thresholdWarning
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input
                            className="auth-input-field-dark py-2 text-right"
                            type="number"
                            value={editingSensorCritical}
                            onChange={(event) => setEditingSensorCritical(event.target.value)}
                          />
                        ) : (
                          sensor.thresholdCritical
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {latest ? `${latest.value} ${sensor.unit}` : "N/A"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canEdit ? (
                          <div className="flex justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="action-btn action-btn-primary"
                                  onClick={() => void saveEditSensor()}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="action-btn action-btn-secondary"
                                  onClick={() => setEditingSensorId(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="action-btn action-btn-secondary"
                                  onClick={() => startEditSensor(sensor)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="action-btn action-btn-danger"
                                  onClick={() => void handleDeleteSensor(sensor._id)}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {activeView === "monitor" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="border border-slate-700 bg-slate-800 rounded-container p-3 text-center">
          <h4 className="section-title mb-2">Power Control</h4>
          <button
            type="button"
            className={`w-24 h-24 rounded-full border-2 font-bold text-lg transition-colors ${
              machineOn
                ? "border-emerald-400 text-emerald-400 hover:bg-emerald-400/10"
                : "border-rose-400 text-rose-400 hover:bg-rose-400/10"
            }`}
            onClick={() => void handleCommand(machineOn ? "relay_off" : "relay_on")}
            disabled={!canEdit}
          >
            {machineOn ? "ON" : "OFF"}
          </button>
          <p className="text-sm mt-2 text-slate-300">
            {machineOn ? "Relay is ON" : "Relay is OFF"}
          </p>
          <p className="text-xs mt-2 text-slate-400">
            {!machineOn ? "Automation shutdown is disabled while relay is OFF." : ""}
          </p>
          <div className="mt-3">
            <p className="text-xs uppercase text-slate-400 mb-2">Safety Override Mode</p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                className={`action-btn ${machine.automationMode === "auto" ? "action-btn-primary" : "action-btn-secondary"}`}
                onClick={() => void handleAutomationModeChange("auto")}
                disabled={!canEdit}
              >
                Auto Mode
              </button>
              <button
                type="button"
                className={`action-btn ${machine.automationMode === "manual" ? "action-btn-primary" : "action-btn-secondary"}`}
                onClick={() => void handleAutomationModeChange("manual")}
                disabled={!canEdit}
              >
                Manual Mode
              </button>
            </div>
          </div>
        </div>
        <div className="border border-slate-700 bg-slate-800 rounded-container p-3">
          <h4 className="section-title mb-2">Device Status Monitoring</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-slate-700 p-2">
              <p className="text-[11px] text-slate-400 uppercase">ESP32</p>
              <p className={deviceOnline ? "text-emerald-300 font-semibold" : "text-rose-300 font-semibold"}>
                {deviceOnline ? "Online" : "Offline"}
              </p>
            </div>
            <div className="rounded border border-slate-700 p-2">
              <p className="text-[11px] text-slate-400 uppercase">Signal</p>
              <p className="text-slate-100 font-semibold">{machine.signalStrength ?? "N/A"}%</p>
            </div>
            <div className="rounded border border-slate-700 p-2 col-span-2">
              <p className="text-[11px] text-slate-400 uppercase">Last Data Received</p>
              <p className="text-slate-100 font-semibold">
                {machine.lastDataReceivedAt ? new Date(machine.lastDataReceivedAt).toLocaleString() : "N/A"}
              </p>
            </div>
            <div className="rounded border border-slate-700 p-2">
              <p className="text-[11px] text-slate-400 uppercase">Battery</p>
              <p className="text-slate-100 font-semibold">{machine.batteryStatus ?? "N/A"}</p>
            </div>
            <div className="rounded border border-slate-700 p-2">
              <p className="text-[11px] text-slate-400 uppercase">Power</p>
              <p className="text-slate-100 font-semibold">{machine.powerStatus ?? "N/A"}</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {activeView === "monitor" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        <div className="border border-slate-700 bg-slate-800 rounded-container p-3">
          <h4 className="section-title mb-2">Alert Log</h4>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded border border-slate-700 p-2">
                  <p className="text-[11px] uppercase text-slate-400">Alerts</p>
                  <p className="text-lg font-bold text-white">{(recentAlerts as any[]).length}</p>
                </div>
                <div className="rounded border border-slate-700 p-2">
                  <p className="text-[11px] uppercase text-slate-400">Status</p>
                  <p className="text-lg font-bold text-cyan-200">
                    {(recentAlerts as any[]).length > 0 ? "Attention" : "Normal"}
                  </p>
                </div>
              </div>
              <div className="overflow-y-auto overflow-x-hidden scrollbar-hidden space-y-2 max-h-48">
                {(recentAlerts as any[]).length === 0 ? (
                  <div className="rounded border border-slate-700 p-3">
                    <p className="text-base text-slate-300">No alerts yet.</p>
                    <p className="text-sm text-slate-400 mt-1">System is currently within normal operating range.</p>
                  </div>
                ) : (
                  (recentAlerts as any[]).map((alert) => (
                    <div key={alert._id} className="rounded border border-slate-700 p-3">
                      <p className="text-xs text-slate-400">{new Date(alert.createdAt).toLocaleString()}</p>
                      <p className="text-base font-semibold text-amber-300">{alert.level}</p>
                      <p className="text-sm text-slate-200">{alert.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="border border-slate-700 rounded-container p-3">
              <p className="text-sm font-semibold text-slate-200 mb-2">Predictive Alert Timeline</p>
              <div className="max-h-56 overflow-y-auto overflow-x-hidden scrollbar-hidden space-y-2">
                {(recentCommands as any[]).slice(0, 8).map((command) => (
                  <div key={command._id} className="rounded border border-slate-700 px-2 py-1.5 flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-200">{new Date(command.createdAt).toLocaleTimeString()}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${
                        command.command === "relay_off"
                          ? "border-rose-400/50 text-rose-300 bg-rose-500/10"
                          : command.command === "relay_on"
                            ? "border-emerald-400/50 text-emerald-300 bg-emerald-500/10"
                            : "border-amber-400/50 text-amber-300 bg-amber-500/10"
                      }`}
                    >
                      {command.command}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border border-slate-700 bg-slate-800 rounded-container p-3">
          <h4 className="section-title mb-2">Report & Email Dispatch</h4>
          <div className="grid grid-cols-1 gap-2">
            <input
              className="auth-input-field-dark"
              type="datetime-local"
              value={reportFrom}
              onChange={(event) => setReportFrom(event.target.value)}
            />
            <input
              className="auth-input-field-dark"
              type="datetime-local"
              value={reportTo}
              onChange={(event) => setReportTo(event.target.value)}
            />
            <input
              className="auth-input-field-dark"
              type="email"
              placeholder="Recipient email"
              value={reportEmail}
              onChange={(event) => setReportEmail(event.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="action-btn action-btn-primary flex-1"
              onClick={() => void handleSendEmail()}
              disabled={sendingEmail}
            >
              {sendingEmail ? "Sending..." : "Send Email"}
            </button>
            <button
              type="button"
              className="action-btn action-btn-secondary flex-1"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? "Downloading..." : "Download PDF"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Telemetry rows in selected range: {reportRows.length}
          </p>
          {emailStatus && <p className="text-xs text-cyan-300 mt-1">{emailStatus}</p>}
        </div>

      </div>
      )}

      {activeView === "settings" && (
      <div>
        <h4 className="section-title mb-2">Share Machine Access</h4>
        {canShare ? (
          <form
            onSubmit={handleShare}
            className="grid grid-cols-1 md:grid-cols-[1fr_170px_120px] gap-2 mb-3"
          >
            <input
              className="auth-input-field-dark"
              type="email"
              placeholder="User email"
              value={shareEmail}
              onChange={(event) => setShareEmail(event.target.value)}
              required
            />
            <select
              className="auth-input-field-dark"
              value={sharePermission}
              onChange={(event) =>
                setSharePermission(event.target.value as (typeof shareLevels)[number])
              }
            >
              {shareLevels.map((level) => (
                <option key={level} value={level}>
                  {toTitleCase(level)}
                </option>
              ))}
            </select>
            <button className="action-btn action-btn-primary" type="submit" disabled={sharing}>
              {sharing ? "Sharing..." : "Share"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-amber-300 mb-3">
            Only owner can add/remove shared access.
          </p>
        )}

        <div className="overflow-auto border border-slate-700 rounded-container">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-200">
              <tr>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Access</th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(shares as any[]).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-slate-300">
                    No shared users yet.
                  </td>
                </tr>
              ) : (
                (shares as any[]).map((share) => (
                  <tr key={share._id} className="border-t border-slate-700">
                    <td className="px-3 py-2">{share.email}</td>
                    <td className="px-3 py-2">{toTitleCase(share.permission)}</td>
                    <td className="px-3 py-2 text-right">
                      {canShare ? (
                        <div className="flex justify-end items-center gap-2">
                          {managingShareId === share._id ? (
                            <>
                              <select
                                className="auth-input-field-dark py-2 w-28"
                                value={managingPermission}
                                onChange={(event) =>
                                  setManagingPermission(
                                    event.target.value as (typeof shareLevels)[number],
                                  )
                                }
                              >
                                {shareLevels.map((level) => (
                                  <option key={level} value={level}>
                                    {toTitleCase(level)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="action-btn action-btn-primary"
                                onClick={() => void saveManagedAccess(share)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="action-btn action-btn-secondary"
                                onClick={() => setManagingShareId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="action-btn action-btn-secondary"
                                onClick={() => startManageAccess(share)}
                              >
                                Manage Access
                              </button>
                              <button
                                type="button"
                                className="action-btn action-btn-danger"
                                onClick={() => void handleRemoveShare(share._id)}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

    </section>
  );
}

function valueState(value: number | null | undefined, sensor: any) {
  if (value == null || !sensor) return { label: "No Data", color: "text-slate-400" };
  if (value >= sensor.thresholdCritical) return { label: "Critical", color: "text-rose-300" };
  if (value >= sensor.thresholdWarning) return { label: "Warning", color: "text-amber-300" };
  return { label: "Normal", color: "text-emerald-300" };
}

function MetricCard({
  label,
  value,
  sensor,
}: {
  label: string;
  value: number | null | undefined;
  sensor?: any;
}) {
  const state = valueState(value, sensor);
  return (
    <div className="border border-slate-700 bg-slate-800 rounded-container p-3 min-h-[72px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-200 font-semibold">{label}</p>
        <p className="text-lg font-bold text-white whitespace-nowrap">
          {value ?? "N/A"} {sensor?.unit ?? ""}
        </p>
      </div>
      <p className={`text-xs font-semibold mt-1 ${state.color}`}>{state.label}</p>
    </div>
  );
}

function TrendCard({
  title,
  values,
  color,
}: {
  title: string;
  values: number[];
  color: string;
}) {
  return (
    <div className="border border-slate-700 bg-slate-800 rounded-container p-3">
      <h5 className="text-sm font-semibold text-slate-200 mb-2">{title}</h5>
      {values.length === 0 ? (
        <p className="text-xs text-slate-400">
          Waiting for ESP32 data... Last connection: Not detected.
        </p>
      ) : (
        <LineChart values={values} color={color} />
      )}
    </div>
  );
}

function LineChart({ values, color }: { values: number[]; color: string }) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length < 2) {
    return <p className="text-xs text-slate-400">Insufficient points for chart.</p>;
  }
  const width = 280;
  const height = 120;
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(safeValues.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
