type Machine = {
  _id: string;
  name: string;
  location: string;
  deviceId: string;
  status: string;
  msi?: number;
  machineHealth?: string;
  online?: boolean;
  readings?: {
    temperature?: number | null;
    vibration?: number | null;
    current?: number | null;
  };
};

type MachineListPageProps = {
  machines: Machine[];
  selectedMachineId: string | null;
  onSelectMachine: (machineId: string) => void;
  onAddMachine: () => void;
  canAddMachine: boolean;
  userRole: string;
};

function healthTone(health?: string, online?: boolean) {
  if (!online) return "border-slate-600/80 bg-slate-800/60";
  if (health === "CRITICAL" || health === "HIGH RISK") return "border-rose-500/50 bg-rose-500/10";
  if (health === "WARNING") return "border-amber-400/50 bg-amber-500/10";
  return "border-emerald-400/40 bg-emerald-500/10";
}

export function MachineListPage(props: MachineListPageProps) {
  const { machines, selectedMachineId, onSelectMachine, onAddMachine, canAddMachine, userRole } = props;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-300">Role: {userRole}</p>
        {canAddMachine && (
          <button
            type="button"
            className="action-btn action-btn-primary"
            onClick={onAddMachine}
          >
            Add Machine
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {machines.length === 0 ? (
          <div className="text-sm text-slate-300 border border-dashed border-slate-600 rounded-container p-4">
            No machines found.
          </div>
        ) : (
          machines.map((machine) => {
            const active = selectedMachineId === machine._id;
            return (
              <button
                key={machine._id}
                type="button"
                onClick={() => onSelectMachine(machine._id)}
                className={`text-left rounded-container border p-4 transition-colors ${healthTone(
                  machine.machineHealth,
                  machine.online,
                )} ${active ? "ring-2 ring-cyan-300" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-white text-lg leading-tight">{machine.name}</p>
                  <span className={`text-xs mt-1 ${machine.online ? "text-emerald-300" : "text-slate-400"}`}>
                    {machine.online ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1">{machine.location}</p>
                <p className="text-xs text-slate-400 mt-1">Device ID: {machine.deviceId}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="rounded border border-slate-700/70 px-2 py-2">
                    <p className="text-slate-400 text-xs">Health</p>
                    <p className="font-semibold text-cyan-200 leading-tight">{machine.machineHealth ?? "N/A"}</p>
                  </div>
                  <div className="rounded border border-slate-700/70 px-2 py-2">
                    <p className="text-slate-400 text-xs">MSI</p>
                    <p className="font-semibold text-white leading-tight">{machine.msi?.toFixed(1) ?? "0.0"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-slate-300">
                  <div>T: {machine.readings?.temperature ?? "N/A"}</div>
                  <div>V: {machine.readings?.vibration ?? "N/A"}</div>
                  <div>I: {machine.readings?.current ?? "N/A"}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
