import { useEffect, useState } from "react";

const API = process.env.API_URL || "http://localhost:8080";

// ================= API HELPER =================
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) throw new Error("API Error");
  return res.json();
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).split("T")[0];
}

// ================= LOGIN =================
function Login({ setUser }) {
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);

    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });

      const user = await api("/me");
      setUser(user);
    } catch {
      setError("Invalid credentials, mail miraz173r@gmail.com for assistance");
    }
  }

  return (
    <div className="aurora-bg relative flex flex-col min-h-screen w-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-14 h-80 w-80 rounded-full bg-orange-300/35 blur-3xl" />

      <form
        onSubmit={handleSubmit}
        className="glass-card lift relative z-10 w-full max-w-sm space-y-4 rounded-2xl p-8"
      >
        <h2 className="text-center text-2xl font-black tracking-tight text-slate-800">
          Welcome Back
        </h2>
        <p className="text-center text-sm text-slate-500">
          Sign in to manage properties and urgent tasks
        </p>

        {error && <div className="text-sm text-red-500">{error}</div>}

        <input
          name="email"
          placeholder="Email"
          className="w-full rounded-xl border border-cyan-200 bg-white/85 p-3 outline-none ring-cyan-200 transition focus:ring-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="w-full rounded-xl border border-cyan-200 bg-white/85 p-3 outline-none ring-cyan-200 transition focus:ring-2"
        />

        <button className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 p-3 font-bold text-white shadow-lg shadow-cyan-600/30 transition hover:scale-[1.01] hover:brightness-110">
          Login
        </button>
      </form>
      <p className="text-transparent text-xs">
        miraz173r@gmail.com - for login help
      </p>
    </div>
  );
}

// ================= HISTORY MODAL =================
function HistoryModal({ propertyId, onClose }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api(`/history/${propertyId}`).then(setLogs);
  }, [propertyId]);

  return (
    <div className="fixed inset-0 z-50 flex w-screen items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl p-6">
        <h2 className="mb-4 text-xl font-extrabold tracking-tight text-slate-800">
          Activity History
        </h2>

        {logs.map((l) => (
          <div key={l.id} className="border-b border-slate-200/70 py-3 text-sm">
            <div>
              <b>{l.name}</b> changed <b>{l.field_name}</b>
            </div>
            <div className="text-gray-500">
              {l.old_value} → {l.new_value}
            </div>
            <div className="text-xs text-gray-400">{l.changed_at}</div>
          </div>
        ))}

        <button
          onClick={onClose}
          className="mt-5 rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ================= ADD PROPERTY =================
function AddPropertyModal({ onClose, refresh }) {
  const [form, setForm] = useState({
    property_address: "",
    property_details: "",
    client_name: "",
    status: "",
    reason_comment: "",
    due_date: "",
    crew_name: "",
    last_email_update: "",
  });

  async function save() {
    await api("/properties", {
      method: "POST",
      body: JSON.stringify(form),
    });

    refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-xl space-y-3 rounded-2xl p-6">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
          Add Property
        </h2>

        <input
          placeholder="Property Address"
          className="w-full rounded-xl border border-orange-200 p-2.5 outline-none ring-orange-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, property_address: e.target.value })
          }
        />

        <input
          placeholder="Property Details"
          className="w-full rounded-xl border border-orange-200 p-2.5 outline-none ring-orange-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, property_details: e.target.value })
          }
        />

        <input
          placeholder="Client Name"
          className="w-full rounded-xl border border-orange-200 p-2.5 outline-none ring-orange-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, client_name: e.target.value })
          }
        />

        <input
          placeholder="Status"
          className="w-full rounded-xl border border-orange-200 p-2.5 outline-none ring-orange-200 focus:ring-2"
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        />

        <input
          placeholder="Reason"
          className="w-full rounded-xl border border-orange-200 p-2.5 outline-none ring-orange-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, reason_comment: e.target.value })
          }
        />

        <input
          type="date"
          className="w-full rounded-xl border border-orange-200 p-2.5 outline-none ring-orange-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, due_date: e.target.value })
          }
        />

        <input
          placeholder="Crew Name"
          className="w-full rounded-xl border border-orange-200 p-2.5 outline-none ring-orange-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, crew_name: e.target.value })
          }
        />

          <input
          placeholder="Last Email Update"
          className="w-full rounded-xl border border-orange-200 p-2.5 outline-none ring-orange-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, last_email_update: e.target.value })
          }
        />

        {/* <input
          placeholder="Coordinator Name"
          className="w-full border p-2"
          onChange={(e) =>
            setForm({ ...form, coordinator_name: e.target.value })
          }
        /> */}

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110"
          >
            Create
          </button>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-600 px-4 py-2 font-semibold text-white transition hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function AddUrgentModal({ onClose, refresh, properties }) {
  const [form, setForm] = useState({
    property_id: "",
    email: "",
    additional_info: "",
    status1: "",
    status2: "",
    due_date: "",
  });

  async function save() {
    await api("/urgent", {
      method: "POST",
      body: JSON.stringify(form),
    });

    refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-xl space-y-3 rounded-2xl p-6">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
          Add Immediate Task
        </h2>

        {/* PROPERTY SELECT */}
        <select
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, property_id: e.target.value })
          }
        >
          <option value="">Select Property</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.property_details}
            </option>
          ))}
        </select>

        <input
          placeholder="Email update"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <input
          placeholder="Additional Info"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, additional_info: e.target.value })
          }
        />

        <input
          placeholder="Status 1"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, status1: e.target.value })
          }
        />

        <input
          placeholder="Status 2"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, status2: e.target.value })
          }
        />

        <input
          type="date"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, due_date: e.target.value })
          }
        />

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110"
          >
            Create Task
          </button>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-600 px-4 py-2 font-semibold text-white transition hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
// ================= PROPERTY EDIT =================
function EditModal({ property, onClose, refresh }) {
  const [form, setForm] = useState({ ...property });

  async function save() {
    await api(`/properties/${property.id}`, {
      method: "PUT",
      body: JSON.stringify(form),
    });

    refresh();
    onClose();
  }

  async function markInactive() {
    await api(`/properties/${property.id}`, {
      method: "PUT",
      body: JSON.stringify({ is_active: false }),
    });

    refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-xl space-y-3 rounded-2xl p-6">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
          Edit Property
        </h2>

        <input
          value={form.property_address || ""}
          onChange={(e) =>
            setForm({ ...form, property_address: e.target.value })
          }
          placeholder="Property Address"
          className="w-full rounded-xl border border-emerald-200 p-2.5 outline-none ring-emerald-200 focus:ring-2"
        />
        <input
          value={form.property_details || ""}
          onChange={(e) =>
            setForm({ ...form, property_details: e.target.value })
          }
          placeholder="Property Details"
          className="w-full rounded-xl border border-emerald-200 p-2.5 outline-none ring-emerald-200 focus:ring-2"
        />

        <input
          value={form.client_name || ""}
          onChange={(e) =>
            setForm({ ...form, client_name: e.target.value })
          }
          placeholder="Client Name"
          className="w-full rounded-xl border border-emerald-200 p-2.5 outline-none ring-emerald-200 focus:ring-2"
        />

        <input
          value={form.status || ""}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value })
          }
          placeholder="Status"
          className="w-full rounded-xl border border-emerald-200 p-2.5 outline-none ring-emerald-200 focus:ring-2"
        />

        <input
          value={form.reason_comment || ""}
          onChange={(e) =>
            setForm({ ...form, reason_comment: e.target.value })
          }
          placeholder="Reason"
          className="w-full rounded-xl border border-emerald-200 p-2.5 outline-none ring-emerald-200 focus:ring-2"
        />

        <input
          type="date"
          value={form.due_date?.slice(0, 10) || ""}
          onChange={(e) =>
            setForm({ ...form, due_date: e.target.value })
          }
          className="w-full rounded-xl border border-emerald-200 p-2.5 outline-none ring-emerald-200 focus:ring-2"
        />

        <input
          value={form.crew_name || ""}
          onChange={(e) =>
            setForm({ ...form, crew_name: e.target.value })
          }
          placeholder="Crew Name"
          className="w-full rounded-xl border border-emerald-200 p-2.5 outline-none ring-emerald-200 focus:ring-2"
        />

        <input
          value={form.last_email_update || ""}
          onChange={(e) =>
            setForm({ ...form, last_email_update: e.target.value })
          }
          placeholder="Last Email Update"
          className="w-full rounded-xl border border-emerald-200 p-2.5 outline-none ring-emerald-200 focus:ring-2"
         />

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110"
          >
            Save Changes
          </button>

  <button
    onClick={markInactive}
    className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110"
  >
    Set Finished
  </button>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-600 px-4 py-2 font-semibold text-white transition hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUrgentModal({ task, onClose, refresh }) {
  const [form, setForm] = useState(task);

  async function save() {
    await api(`/urgent/${task.id}`, {
      method: "PUT",
      body: JSON.stringify(form),
    });

    refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-xl space-y-3 rounded-2xl p-6">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
          Edit Immediate Task
        </h2>

        <input
          value={form.email || ""}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email Update"
          className="w-full rounded-xl border border-indigo-200 p-2.5 outline-none ring-indigo-200 focus:ring-2"
        />

        <input
          value={form.additional_info || ""}
          onChange={(e) =>
            setForm({ ...form, additional_info: e.target.value })
          }
          placeholder="Additional Info"
          className="w-full rounded-xl border border-indigo-200 p-2.5 outline-none ring-indigo-200 focus:ring-2"
        />

        <input
          value={form.status1 || ""}
          onChange={(e) => setForm({ ...form, status1: e.target.value })}
          placeholder="Status 1"
          className="w-full rounded-xl border border-indigo-200 p-2.5 outline-none ring-indigo-200 focus:ring-2"
        />

        <input
          value={form.status2 || ""}
          onChange={(e) => setForm({ ...form, status2: e.target.value })}
          placeholder="Status 2"
          className="w-full rounded-xl border border-indigo-200 p-2.5 outline-none ring-indigo-200 focus:ring-2"
        />

        <input
          type="date"
          value={form.due_date?.slice(0, 10) || ""}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          className="w-full rounded-xl border border-indigo-200 p-2.5 outline-none ring-indigo-200 focus:ring-2"
        />

        <div className="space-x-2">
          <button
            onClick={save}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110"
          >
            Save
          </button>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-600 px-4 py-2 font-semibold text-white transition hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
// ================= DASHBOARD =================
function Dashboard({ user }) {
  const [properties, setProperties] = useState([]);
  const [urgent, setUrgent] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showUrgent, setShowUrgent] = useState(false);
  const [editingUrgent, setEditingUrgent] = useState(null);

  const [selectedHistory, setSelectedHistory] = useState(null);
  const [editing, setEditing] = useState(null);

  function load() {
    api("/properties").then(setProperties);
    api("/urgent").then(setUrgent);
  }

  useEffect(load, []);

  async function resolve(id) {
    await api(`/urgent/${id}/resolve`, { method: "PUT" });
    load();
  }
async function logout() {
  await api("/logout", { method: "POST" });
  window.location.reload(); // simplest way
}

  return (
    <div className="aurora-bg relative min-h-screen w-screen overflow-hidden p-4 md:p-6">
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl" />
      <div className="relative z-10 space-y-8">

      {/* HEADER */}
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-black tracking-tight text-slate-800">Dashboard</h1>

      <p className="text-transparent text-xs">
        miraz173r@gmail.com - for help
      </p>

        <div className="flex flex-wrap gap-2 md:gap-3 md:items-center">
          <button
            onClick={() => setShowUrgent(true)}
            className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110"
          >
            + Immediate Task
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:brightness-110"
          >
            + Add Property
          </button>

            <div className="ml-auto flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2">
    <span className="text-sm font-medium text-slate-700">{user.email}</span>

    <button
      onClick={logout}
      className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Logout
    </button>
  </div>
        </div>
      </div>

      {/* URGENT TASKS */}
      <div>
        <h2 className="mb-3 text-xl font-extrabold tracking-tight text-red-700">
          Immediate Attention
        </h2>

        <div className="glass-card overflow-x-auto rounded-2xl p-2">
          <table className="w-full overflow-hidden rounded-xl bg-white/80 shadow text-slate-700">
            <thead className="bg-gradient-to-r from-rose-100 to-orange-100 text-center text-sm">
              <tr>
                <th className="p-1 w-[15%]">Property</th>
                <th className="p-1 w-[20%]">Details</th>
                <th className="p-1 w-[15%]">Email Update</th>
                <th className="p-1 w-[15%]">Info</th>
                <th className="p-1 w-[10%]">Status1</th>
                <th className="p-1 w-[10%]">Status2</th>
                <th className="p-1 w-[5%]">Due</th>
                <th className="p-2 w-[10%]">Action</th>
              </tr>
            </thead>

            <tbody>
              {urgent.map((t) => (
                <tr key={t.id} className="border-t border-rose-100 text-center text-sm transition hover:bg-rose-50/60">
                  <td className="p-2">{t.property_address}</td>
                  <td className="p-2">{t.property_details}</td>
                  <td className="p-1">{t.email}</td>
                  <td className="p-1">{t.additional_info}</td>
                  <td className="p-1">{t.status1}</td>
                  <td className="p-1">{t.status2}</td>
                  <td className="p-1">{formatDate(t.due_date)}</td>
                  {user.role === "admin" && (
                    <td className="p-1 text-white">
                      <button
                        onClick={() => resolve(t.id)}
                        className="rounded-lg bg-emerald-500 px-3 py-1 font-semibold shadow-md shadow-emerald-500/30 transition hover:bg-emerald-600"
                      >
                        Resolve
                      </button>
                    </td>
                  )}
                  {user.role === "coordinator" && (
                    <td className="p-1 text-white">
                    <button
                      onClick={() => setEditingUrgent(t)}
                      className="rounded-lg bg-blue-500 px-3 py-1 font-semibold shadow-md shadow-blue-500/30 transition hover:bg-blue-600"
                    >
                      Edit
                    </button></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PROPERTIES */}
      <div>
        <h2 className="mb-3 text-xl font-extrabold tracking-tight text-slate-800">All Properties</h2>

        <div className="glass-card overflow-x-auto rounded-2xl p-2">
          <table className="w-full overflow-hidden rounded-xl bg-white/80 text-sm text-slate-700 shadow">
            <thead className="bg-gradient-to-r from-cyan-100 to-teal-100">
              <tr className="text-center">
                <th className="py-2 px-1 w-[15%]">Property</th>
                <th className="p-1 w-[20%]">Details</th>
                <th className="p-1 w-[15%]">Status</th>
                <th className="p-1 w-[10%]">Reason</th>
                <th className="p-1 w-[10%]">Last Email</th>
                <th className="p-1 w-[5%]">Due</th>
                <th className="p-1 w-[5%]">Crew</th>
                <th className="p-1 w-[7%]">Client</th>
                <th className="p-1 w-[13%]">Actions</th>
              </tr>
            </thead>

            <tbody>
              {properties.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-cyan-100 text-center transition hover:bg-cyan-50/50 ${
                    p.is_active ? "" : "bg-slate-200/80"
                  }`}
                >
                  <td className="p-2">{p.property_address}</td>
                  <td className="p-1">{p.property_details}</td>
                  <td className="p-1">{p.status}</td>
                  <td className="p-1">{p.reason_comment}</td>
                  <td className="p-1">{p.last_email_update}</td>
                  <td className="p-1">{formatDate(p.due_date)}</td>
                  <td className="p-1">{p.crew_name}</td>
                  <td className="p-1">{p.client_name}</td>
                  <td className="space-x-2">
                    <button
                      onClick={() => setSelectedHistory(p.id)}
                      className="rounded-lg bg-cyan-500 px-3 py-1.5 font-semibold text-white shadow-md shadow-cyan-500/30 transition hover:bg-cyan-600"
                    >
                      History
                    </button>

                    <button
                      onClick={() => setEditing(p)}
                      className="rounded-lg bg-teal-500 px-3 py-1.5 font-semibold text-white shadow-md shadow-teal-500/30 transition hover:bg-teal-600"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      {showAdd && (
        <AddPropertyModal
          onClose={() => setShowAdd(false)}
          refresh={load}
        />
      )}

      {showUrgent && (
        <AddUrgentModal
          onClose={() => setShowUrgent(false)}
          refresh={load}
          properties={properties}
        />
      )}

      {editingUrgent && (
        <EditUrgentModal
          task={editingUrgent}
          onClose={() => setEditingUrgent(null)}
          refresh={load}
        />
      )}

      {selectedHistory && (
        <HistoryModal
          propertyId={selectedHistory}
          onClose={() => setSelectedHistory(null)}
        />
      )}

      {editing && (
        <EditModal
          property={editing}
          onClose={() => setEditing(null)}
          refresh={load}
        />
      )}
      </div>
    </div>
  );
}

// ================= APP ROOT =================
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api("/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap');

        * {
          font-family: 'Manrope', 'Trebuchet MS', 'Verdana', sans-serif;
        }

        .aurora-bg {
          background:
            radial-gradient(1000px 500px at 0% 0%, rgba(34, 211, 238, 0.25), transparent),
            radial-gradient(900px 450px at 100% 10%, rgba(251, 146, 60, 0.22), transparent),
            linear-gradient(140deg, #f8fafc 0%, #ecfeff 45%, #fff7ed 100%);
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.65);
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
        }

        .glass-card input,
        .glass-card select,
        .glass-card textarea {
          color-scheme: light;
          background: rgba(255, 255, 255, 0.93);
          color: #0f172a;
          border-color: rgba(148, 163, 184, 0.45);
        }

        .glass-card input::placeholder,
        .glass-card textarea::placeholder {
          color: #64748b;
          opacity: 1;
        }

        .lift {
          animation: liftIn 0.45s ease-out;
        }

        @keyframes liftIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {!user ? <Login setUser={setUser} /> : <Dashboard user={user} />}
    </>
  );
}
