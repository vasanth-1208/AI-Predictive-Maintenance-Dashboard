type Machine = {
  _id: string;
  name: string;
  location: string;
  deviceId: string;
  status: string;
};

type MachineListPageProps = {
  machines: Machine[];
  selectedMachineId: string | null;
  onSelectMachine: (machineId: string) => void;
  onAddMachine: () => void;
  canAddMachine: boolean;
  userRole: string;
};

export function MachineListPage(props: MachineListPageProps) {
  const {
    machines,
    selectedMachineId,
    onSelectMachine,
    onAddMachine,
    canAddMachine,
    userRole,
  } = props;

  return (
    <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 rounded-container border border-slate-700 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-cyan-300">Machine List</h3>
          <p className="text-xs text-slate-300 mt-1">Role: {userRole}</p>
        </div>
        <button
          type="button"
          className="px-3 py-2 rounded bg-cyan-600 text-white font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onAddMachine}
          disabled={!canAddMachine}
        >
          Add Machine
        </button>
      </div>
      {!canAddMachine && (
        <p className="text-xs text-amber-300 mb-3">
          Only admin can create machines. Ask an admin to create and share.
        </p>
      )}

      <div className="grid gap-3">
        {machines.length === 0 ? (
          <div className="text-sm text-slate-300 border border-dashed border-slate-600 rounded-container p-4">
            No machines found. Add your first machine to start monitoring.
          </div>
        ) : (
          machines.map((machine) => {
            const active = selectedMachineId === machine._id;
            return (
              <button
                key={machine._id}
                type="button"
                onClick={() => onSelectMachine(machine._id)}
                className={`text-left rounded-container border p-3 transition-colors ${
                  active
                    ? "border-cyan-400 bg-cyan-500/10"
                    : "border-slate-600 hover:bg-slate-700/70"
                }`}
              >
                <p className="font-semibold text-white">{machine.name}</p>
                <p className="text-sm text-slate-300">{machine.location}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Device ID: {machine.deviceId} | Status: {machine.status}
                </p>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
