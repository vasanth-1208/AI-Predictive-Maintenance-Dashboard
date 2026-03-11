import { FormEvent, useState } from "react";

type AddMachineFormProps = {
  onSubmit: (input: { name: string; location: string; deviceId: string }) => Promise<void>;
  onCancel: () => void;
};

export function AddMachineForm({ onSubmit, onCancel }: AddMachineFormProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name, location, deviceId });
      setName("");
      setLocation("");
      setDeviceId("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-container border border-gray-200 p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Add Machine</h3>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <input
          className="auth-input-field"
          placeholder="Machine Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          className="auth-input-field"
          placeholder="Location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          required
        />
        <input
          className="auth-input-field"
          placeholder="Device ID"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          required
        />
        <div className="flex gap-2">
          <button className="auth-button" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Machine"}
          </button>
          <button
            type="button"
            className="px-4 py-3 rounded border border-gray-300 text-secondary hover:bg-gray-50"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
