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
    <section className="panel-dark p-4">
      <h3 className="section-title mb-3">Add Machine</h3>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <input
          className="auth-input-field-dark"
          placeholder="Machine Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          className="auth-input-field-dark"
          placeholder="Location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          required
        />
        <input
          className="auth-input-field-dark"
          placeholder="Device ID"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          required
        />
        <div className="flex gap-2">
          <button className="action-btn action-btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Machine"}
          </button>
          <button
            type="button"
            className="action-btn action-btn-secondary"
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
