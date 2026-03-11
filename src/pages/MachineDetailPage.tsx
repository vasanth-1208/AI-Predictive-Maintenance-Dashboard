import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type MachineDetailPageProps = {
  machineId: string;
  convexApi: any;
};

const suggestedSensorTypes = ["temperature", "vibration", "current"];
const shareLevels = ["owner", "editor", "viewer"] as const;

export function MachineDetailPage({ machineId, convexApi }: MachineDetailPageProps) {
  const machine = useQuery(convexApi.machines.getMachineById, { machineId });
  const sensors = useQuery(convexApi.sensors.listSensorsByMachine, { machineId }) ?? [];
  const latestTelemetry = useQuery(convexApi.telemetry.getLatestTelemetry, { machineId });
  const telemetryHistory =
    useQuery(convexApi.telemetry.getTelemetryHistory, { machineId, limit: 60 }) ?? [];
  const pendingCommands = useQuery(convexApi.commands.getPendingCommands, { machineId }) ?? [];
  const shares = useQuery(convexApi.shares.listMachineShares, { machineId }) ?? [];

  const addSensor = useMutation(convexApi.sensors.addSensor);
  const updateSensor = useMutation(convexApi.sensors.updateSensor);
  const deleteSensor = useMutation(convexApi.sensors.deleteSensor);
  const updateMachine = useMutation(convexApi.machines.updateMachine);
  const deleteMachine = useMutation(convexApi.machines.deleteMachine);
  const sendCommand = useMutation(convexApi.commands.sendCommand);
  const shareMachine = useMutation(convexApi.shares.shareMachine);
  const removeShare = useMutation(convexApi.shares.removeMachineShare);

  const [sensorName, setSensorName] = useState("");
  const [sensorType, setSensorType] = useState("");
  const [unit, setUnit] = useState("");
  const [warningThreshold, setWarningThreshold] = useState("");
  const [criticalThreshold, setCriticalThreshold] = useState("");
  const [savingSensor, setSavingSensor] = useState(false);
  const [machineOn, setMachineOn] = useState(true);
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

  useEffect(() => {
    if (!machine) return;
    setMachineName(machine.name);
    setMachineLocation(machine.location);
    setMachineDeviceId(machine.deviceId);
    setMachineStatus(machine.status);
  }, [machine?._id, machine?.name, machine?.location, machine?.deviceId, machine?.status]);

  const sensorsById = useMemo(() => {
    return new Map(sensors.map((sensor: any) => [sensor._id as string, sensor]));
  }, [sensors]);

  const chartPoints = telemetryHistory.map((point: any) => {
    const sensor = sensorsById.get(point.sensorId as string);
    return {
      ...point,
      type: sensor?.type ?? "unknown",
      sensorName: sensor?.name ?? sensor?.type ?? "unknown",
      sensorUnit: sensor?.unit ?? "",
    };
  });

  const latestBySensor = useMemo(() => {
    const latestMap = new Map<string, any>();
    for (const point of [...chartPoints].reverse()) {
      if (!latestMap.has(point.sensorId)) {
        latestMap.set(point.sensorId, point);
      }
    }
    return latestMap;
  }, [chartPoints]);

  const temperatureSeries = chartPoints
    .filter((point: any) => point.type === "temperature")
    .map((point: any) => Number(point.value))
    .slice(-20);
  const vibrationSeries = chartPoints
    .filter((point: any) => point.type === "vibration")
    .map((point: any) => Number(point.value))
    .slice(-20);
  const currentSeries = chartPoints
    .filter((point: any) => point.type === "current")
    .map((point: any) => Number(point.value))
    .slice(-20);

  const canEdit = machine?.access === "owner" || machine?.access === "editor";
  const canShare = machine?.access === "owner";

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
      await sendCommand({ machineId, command });
      if (command === "relay_off") {
        setMachineOn(false);
      }
      if (command === "relay_on") {
        setMachineOn(true);
      }
      toast.success(`Command queued: ${command}`);
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

  if (!machine) {
    return (
      <section className="bg-slate-900 text-slate-100 rounded-container border border-slate-700 p-4 shadow-sm">
        <p className="text-slate-300 text-sm">Loading machine details...</p>
      </section>
    );
  }

  return (
    <section className="bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 rounded-container border border-slate-700 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-bold text-cyan-300">{machine.name}</h3>
          <p className="text-sm text-slate-300">
            {machine.location} | Device ID: {machine.deviceId}
          </p>
          <p className="text-xs text-slate-400 mt-1">Access: {machine.access}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-300">MSI</p>
          <p className="text-2xl font-bold text-cyan-300">{latestTelemetry?.msi ?? 0}</p>
          <p className="text-xs text-slate-300">Risk Score: {latestTelemetry?.riskScore ?? 0}%</p>
        </div>
      </div>

      {canEdit && (
        <div className="mb-5 border border-slate-700 bg-slate-800/60 rounded-container p-3">
          <h4 className="text-sm font-semibold text-cyan-300 mb-2">Machine Details</h4>
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
                  <option value="active">active</option>
                  <option value="running">running</option>
                  <option value="stopped">stopped</option>
                  <option value="maintenance">maintenance</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="auth-button w-auto px-4"
                  onClick={() => void handleUpdateMachine()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="px-4 py-3 rounded border border-slate-500 text-slate-200 hover:bg-slate-700"
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
                {machine.status}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-cyan-300 hover:text-cyan-200"
                  onClick={() => setIsEditingMachine(true)}
                >
                  Edit
                </button>
                {machine.access === "owner" && (
                  <button
                    type="button"
                    className="text-rose-300 hover:text-rose-200"
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
        <MetricCard label="Temperature" value={latestTelemetry?.readings?.temperature} />
        <MetricCard label="Vibration" value={latestTelemetry?.readings?.vibration} />
        <MetricCard label="Current" value={latestTelemetry?.readings?.current} />
      </div>

      <div className="mb-5">
        <h4 className="text-sm font-semibold text-cyan-300 mb-2">Trend Graphs</h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <TrendCard title="Temperature Trend" values={temperatureSeries} color="#ff6b6b" />
          <TrendCard title="Vibration Trend" values={vibrationSeries} color="#4ecdc4" />
          <TrendCard title="Current Trend" values={currentSeries} color="#45b7d1" />
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-sm font-semibold text-cyan-300 mb-2">Sensors</h4>
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
            <button className="auth-button" type="submit" disabled={savingSensor}>
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
                                  className="text-cyan-300 hover:text-cyan-200"
                                  onClick={() => void saveEditSensor()}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="text-slate-300 hover:text-slate-100"
                                  onClick={() => setEditingSensorId(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="text-cyan-300 hover:text-cyan-200"
                                  onClick={() => startEditSensor(sensor)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="text-rose-300 hover:text-rose-200"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="border border-slate-700 bg-slate-800 rounded-container p-3 text-center">
          <h4 className="text-sm font-semibold text-cyan-300 mb-2">Power Control</h4>
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
            {machineOn ? "Machine is running normally" : "Machine is powered off"}
          </p>
        </div>
        <div className="border border-slate-700 bg-slate-800 rounded-container p-3 text-center">
          <h4 className="text-sm font-semibold text-cyan-300 mb-2">Emergency Shutdown</h4>
          <button
            type="button"
            className="px-4 py-2 rounded bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
            onClick={() => void handleCommand("relay_off")}
            disabled={!canEdit}
          >
            Turn Off Machine
          </button>
          <p className="text-sm mt-2 text-slate-300">Auto-shutdown when MSI &gt; 80</p>
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-sm font-semibold text-cyan-300 mb-2">Machine Commands</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            className="auth-button w-auto px-4"
            onClick={() => void handleCommand("beep_short")}
            disabled={!canEdit}
          >
            Beep Short
          </button>
          <button
            type="button"
            className="auth-button w-auto px-4"
            onClick={() => void handleCommand("beep_long")}
            disabled={!canEdit}
          >
            Beep Long
          </button>
          <button
            type="button"
            className="auth-button w-auto px-4"
            onClick={() => void handleCommand("relay_off")}
            disabled={!canEdit}
          >
            Relay Off
          </button>
          <button
            type="button"
            className="auth-button w-auto px-4"
            onClick={() => void handleCommand("relay_on")}
            disabled={!canEdit}
          >
            Relay On
          </button>
        </div>

        <p className="text-sm text-slate-300">
          Pending Commands: <span className="font-semibold">{pendingCommands.length}</span>
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-cyan-300 mb-2">Share Machine Access</h4>
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
                  {level}
                </option>
              ))}
            </select>
            <button className="auth-button" type="submit" disabled={sharing}>
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
                    <td className="px-3 py-2 capitalize">{share.permission}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-rose-300 hover:text-rose-200 disabled:opacity-50"
                        onClick={() => void removeShare({ shareId: share._id })}
                        disabled={!canShare}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="border border-slate-700 bg-slate-800 rounded-container p-3">
      <p className="text-xs uppercase tracking-wide text-slate-300">{label}</p>
      <p className="text-xl font-bold text-white">{value ?? "N/A"}</p>
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
        <p className="text-xs text-slate-400">No telemetry yet.</p>
      ) : (
        <LineChart values={values} color={color} />
      )}
    </div>
  );
}

function LineChart({ values, color }: { values: number[]; color: string }) {
  const width = 280;
  const height = 120;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
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
