import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { getDemoTelemetryTable, isDemoMachineId } from "../demoData";

type Machine = {
  _id: string;
  name: string;
};

type TelemetryDashboardProps = {
  machines: Machine[];
  defaultMachineId: string | null;
  convexApi: any;
  fullPage?: boolean;
  onBack?: () => void;
  fixedMachineId?: string | null;
};

const RANGE_OPTIONS = [
  { label: "Last Hour", hours: 1 },
  { label: "Last 24 Hours", hours: 24 },
  { label: "Last Week", hours: 24 * 7 },
];

export function TelemetryDashboard({
  machines,
  defaultMachineId,
  convexApi,
  fullPage = false,
  onBack,
  fixedMachineId = null,
}: TelemetryDashboardProps) {
  const [machineId, setMachineId] = useState<string | null>(fixedMachineId ?? defaultMachineId);
  const [rangeHours, setRangeHours] = useState(24);
  const [alertLevel, setAlertLevel] = useState("ALL");

  useEffect(() => {
    if (!machineId && defaultMachineId) {
      setMachineId(defaultMachineId);
    }
  }, [defaultMachineId, machineId]);

  const activeMachineId = fixedMachineId ?? machineId ?? defaultMachineId;
  const endTimestamp = Date.now();
  const startTimestamp = endTimestamp - rangeHours * 60 * 60 * 1000;
  const demoMode = isDemoMachineId(activeMachineId);
  const rawTelemetryTable =
    useQuery(
      convexApi.telemetry.getTelemetryTable,
      !demoMode && activeMachineId
        ? {
            machineId: activeMachineId,
            startTimestamp,
            endTimestamp,
            alertLevel,
          }
        : "skip",
    ) ?? [];

  const telemetryTable = demoMode && activeMachineId
    ? getDemoTelemetryTable(activeMachineId, alertLevel)
    : rawTelemetryTable;

  const currentMachineName = useMemo(
    () => machines.find((m) => m._id === activeMachineId)?.name ?? "-",
    [machines, activeMachineId],
  );

  return (
    <section className={`panel-dark text-slate-100 p-4 ${fullPage ? "min-h-[78vh]" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {fullPage && (
            <button type="button" className="action-btn action-btn-secondary" onClick={onBack}>
              Back to Dashboard
            </button>
          )}
          <h3 className="section-title">Telemetry Dashboard</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!fixedMachineId && (
            <select
              className="auth-input-field-dark max-w-xs py-2"
              value={activeMachineId ?? ""}
              onChange={(event) => setMachineId(event.target.value || null)}
            >
              {machines.length === 0 ? (
                <option value="">No Machines</option>
              ) : (
                machines.map((machine) => (
                  <option key={machine._id} value={machine._id}>
                    {machine.name}
                  </option>
                ))
              )}
            </select>
          )}
          <select
            className="auth-input-field-dark max-w-xs py-2"
            value={rangeHours}
            onChange={(event) => setRangeHours(Number(event.target.value))}
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.hours} value={opt.hours}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="auth-input-field-dark max-w-xs py-2"
            value={alertLevel}
            onChange={(event) => setAlertLevel(event.target.value)}
          >
            <option value="ALL">All Alerts</option>
            <option value="NORMAL">Normal</option>
            <option value="EARLY">Early</option>
            <option value="CRITICAL">Critical</option>
            <option value="SHUTDOWN">Shutdown</option>
          </select>
        </div>
      </div>

      {!activeMachineId ? (
        <p className="text-sm text-slate-300">Add a machine to view telemetry.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-3">
            Machine: {currentMachineName} | Range: {new Date(startTimestamp).toLocaleString()} to{" "}
            {new Date(endTimestamp).toLocaleString()}
          </p>
          <div className={`${fullPage ? "max-h-[68vh]" : "max-h-80"} overflow-auto border border-slate-700 rounded-container`}>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-800 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-slate-800 z-10">Timestamp</th>
                  <th className="text-left px-3 py-2">Machine ID</th>
                  <th className="text-right px-3 py-2">Temperature</th>
                  <th className="text-right px-3 py-2">Vibration</th>
                  <th className="text-right px-3 py-2">Current</th>
                  <th className="text-right px-3 py-2">MSI Score</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(telemetryTable as any[]).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-slate-400">
                      Waiting for ESP32 data... Last connection: Not detected.
                    </td>
                  </tr>
                ) : (
                  (telemetryTable as any[]).map((row) => (
                    <tr key={`${row.timestamp}-${row.machineId}`} className="border-t border-slate-700">
                      <td className="px-3 py-2 sticky left-0 bg-slate-900 z-[1]">
                        {new Date(row.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{row.machineId}</td>
                      <td className="px-3 py-2 text-right">{row.temperature ?? "N/A"}</td>
                      <td className="px-3 py-2 text-right">{row.vibration ?? "N/A"}</td>
                      <td className="px-3 py-2 text-right">{row.current ?? "N/A"}</td>
                      <td className="px-3 py-2 text-right">{row.msi}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            row.status === "CRITICAL"
                              ? "text-rose-300"
                              : row.status === "HIGH RISK" || row.status === "WARNING"
                                ? "text-amber-300"
                                : "text-emerald-300"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
