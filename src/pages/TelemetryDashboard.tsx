import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";

type Machine = {
  _id: string;
  name: string;
};

type TelemetryDashboardProps = {
  machines: Machine[];
  defaultMachineId: string | null;
  convexApi: any;
};

export function TelemetryDashboard({
  machines,
  defaultMachineId,
  convexApi,
}: TelemetryDashboardProps) {
  const [machineId, setMachineId] = useState<string | null>(defaultMachineId);

  useEffect(() => {
    if (!machineId && defaultMachineId) {
      setMachineId(defaultMachineId);
    }
  }, [defaultMachineId, machineId]);

  const activeMachineId = machineId ?? defaultMachineId;
  const telemetry =
    useQuery(
      convexApi.telemetry.getTelemetryHistory,
      activeMachineId ? { machineId: activeMachineId, limit: 100 } : "skip",
    ) ?? [];

  const grouped = useMemo(() => {
    const byHour = new Map<string, number>();
    for (const row of telemetry as any[]) {
      const hour = new Date(row.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
    return Array.from(byHour.entries()).slice(-12);
  }, [telemetry]);

  return (
    <section className="bg-slate-900 text-slate-100 rounded-container border border-slate-700 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-lg font-semibold text-cyan-300">Telemetry Dashboard</h3>
        <select
          className="auth-input-field-dark max-w-xs"
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
      </div>

      {!activeMachineId ? (
        <p className="text-sm text-slate-300">Add a machine to view telemetry.</p>
      ) : (
        <>
          <div className="grid gap-2 mb-4">
            {grouped.length === 0 ? (
              <p className="text-sm text-slate-300">
                No telemetry points found for this machine.
              </p>
            ) : (
              grouped.map(([time, count]) => (
                <div key={time} className="grid grid-cols-[80px_1fr_40px] gap-2 items-center">
                  <span className="text-xs text-slate-300">{time}</span>
                  <div className="h-2 bg-slate-700 rounded">
                    <div
                      className="h-2 rounded bg-cyan-400"
                      style={{ width: `${Math.min(100, count * 10)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-200 text-right">{count}</span>
                </div>
              ))
            )}
          </div>

          <div className="max-h-48 overflow-auto border border-slate-700 rounded-container">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Timestamp</th>
                  <th className="text-left px-3 py-2">Sensor ID</th>
                  <th className="text-right px-3 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {(telemetry as any[]).slice(-20).reverse().map((row) => (
                  <tr key={row._id} className="border-t border-slate-700">
                    <td className="px-3 py-2">{new Date(row.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2">{row.sensorId}</td>
                    <td className="px-3 py-2 text-right">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
