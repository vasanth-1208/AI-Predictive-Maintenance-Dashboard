import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
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
};

const convexApi = api as any;

export function MultiMachineDashboard() {
  const machines = (useQuery(convexApi.machines.listMachines) ?? []) as Machine[];
  const myProfile = useQuery(convexApi.machines.getMyRole);
  const addMachine = useMutation(convexApi.machines.addMachine);

  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [showAddMachine, setShowAddMachine] = useState(false);

  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) {
      setSelectedMachineId(machines[0]._id);
    }
  }, [machines, selectedMachineId]);

  const activeMachineId = useMemo(() => {
    if (selectedMachineId) {
      return selectedMachineId;
    }
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
    <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
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

      <div className="grid gap-4">
        {showAddMachine && (
          <AddMachineForm
            onSubmit={handleCreateMachine}
            onCancel={() => setShowAddMachine(false)}
          />
        )}

        {activeMachineId ? (
          <MachineDetailPage machineId={activeMachineId} convexApi={convexApi} />
        ) : (
          <section className="bg-white rounded-container border border-gray-200 p-4 shadow-sm text-secondary text-sm">
            Select a machine to view details.
          </section>
        )}

        <TelemetryDashboard
          machines={machines}
          defaultMachineId={activeMachineId}
          convexApi={convexApi}
        />
      </div>
    </div>
  );
}
