import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { getDemoFleetOverview } from "./demoData";
import { AddMachineForm } from "./pages/AddMachineForm";
import { MachineDetailPage } from "./pages/MachineDetailPage";
import { MachineListPage } from "./pages/MachineListPage";
import { TelemetryDashboard } from "./pages/TelemetryDashboard";

type Machine = {
  _id: string;
  name: string;
  location: string;
  deviceId: string;
  status: string;
  msi?: number;
  riskScore?: number;
  machineHealth?: string;
  online?: boolean;
  readings?: {
    temperature?: number | null;
    vibration?: number | null;
    current?: number | null;
  };
};

const convexApi = api as any;

export function MultiMachineDashboard() {
  const fleetOverview = useQuery(convexApi.telemetry.getFleetOverview);
  const effectiveFleetOverview = fleetOverview && fleetOverview.machines.length > 0
    ? fleetOverview
    : getDemoFleetOverview();
  const machines = (effectiveFleetOverview.machines ?? []) as Machine[];
  const myProfile = useQuery(convexApi.machines.getMyRole);
  const addMachine = useMutation(convexApi.machines.addMachine);

  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [showAddMachine, setShowAddMachine] = useState(false);
  const [telemetryViewMachineId, setTelemetryViewMachineId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) {
      setSelectedMachineId(machines[0]._id);
    }
  }, [machines, selectedMachineId]);

  const activeMachineId = useMemo(() => {
    if (selectedMachineId) return selectedMachineId;
    return machines[0]?._id ?? null;
  }, [machines, selectedMachineId]);

  const handleCreateMachine = async (input: {
    name: string;
    location: string;
    deviceId: string;
  }) => {
    try {
      const machineId = await addMachine(input);
      setSelectedMachineId(machineId);
      setShowAddMachine(false);
      toast.success("Machine created.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="grid gap-4">
      {telemetryViewMachineId && (
        <TelemetryDashboard
          machines={machines}
          defaultMachineId={telemetryViewMachineId}
          convexApi={convexApi}
          fullPage
          fixedMachineId={telemetryViewMachineId}
          onBack={() => setTelemetryViewMachineId(null)}
        />
      )}

      {!telemetryViewMachineId && (
      <>
      <section className="panel-dark p-4">
        <h3 className="section-title mb-3">System Status Bar</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatusCard
            label="Machines Online"
            value={String(effectiveFleetOverview?.totals?.machinesOnline ?? 0)}
            tone="ok"
          />
          <StatusCard
            label="Active Alerts"
            value={String(effectiveFleetOverview?.totals?.activeAlerts ?? 0)}
            tone={(effectiveFleetOverview?.totals?.activeAlerts ?? 0) > 0 ? "danger" : "ok"}
          />
          <StatusCard
            label="Avg Health Score"
            value={`${effectiveFleetOverview?.totals?.avgHealthScore ?? 0}%`}
            tone="info"
          />
          <StatusCard
            label="Data Latency"
            value={`${effectiveFleetOverview?.totals?.dataLatency ?? 0} ms`}
            tone="warn"
          />
        </div>
      </section>

      <section className="panel-dark p-4">
        <h3 className="section-title mb-3">Machine Grid Dashboard</h3>
        <MachineListPage
          machines={machines}
          selectedMachineId={selectedMachineId}
          onSelectMachine={setSelectedMachineId}
          onAddMachine={() => {
            if (myProfile?.role !== "admin") {
              toast.error("Only admin can create machines.");
              return;
            }
            setShowAddMachine((prev) => !prev);
          }}
          canAddMachine={myProfile?.role === "admin"}
          userRole={myProfile?.role ?? "user"}
        />
      </section>

      <div className="grid gap-4">
        {showAddMachine && (
          <AddMachineForm onSubmit={handleCreateMachine} onCancel={() => setShowAddMachine(false)} />
        )}

        {activeMachineId ? (
          <MachineDetailPage
            machineId={activeMachineId}
            convexApi={convexApi}
            onOpenTelemetryView={(machineId) => setTelemetryViewMachineId(machineId)}
          />
        ) : (
          <section className="panel-dark p-4 subtle-text">
            Select a machine to view details.
          </section>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger" | "info";
}) {
  const toneClass =
    tone === "ok"
      ? "from-emerald-500/25 to-emerald-700/10 border-emerald-400/50"
      : tone === "warn"
        ? "from-amber-400/25 to-amber-600/10 border-amber-300/50"
        : tone === "danger"
          ? "from-rose-500/25 to-rose-700/10 border-rose-400/50"
          : "from-cyan-500/25 to-cyan-700/10 border-cyan-400/50";
  return (
    <article className={`rounded-container border bg-gradient-to-br p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-widest text-slate-300">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </article>
  );
}
