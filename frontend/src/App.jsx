import { useEffect, useState } from "react";

const API = (import.meta.env.VITE_API_URL || "https://zijanproperty.up.railway.app"// || "http://localhost:5000").replace(/\/$/, "");

// ================= API HELPER =================
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = "API Error";

    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // Keep fallback message.
      }
    }

    throw new Error(message);
  }
  return res.json();
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).split("T")[0];
}

function getChangedFields(original, current) {
  const changed = {};

  Object.keys(current).forEach((key) => {
    if (key.startsWith("_")) return;
    if (["id", "created_at", "updated_at"].includes(key)) return;

    const oldValue = original[key] ?? null;
    const newValue = current[key] ?? null;

    if (String(oldValue) !== String(newValue)) {
      changed[key] = newValue;
    }
  });

  return changed;
}

function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isOverdueTask(task) {
  const due = toDateOnly(task.due_date);
  if (!due) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due < today;
}

function getWeekRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start, end, today };
}

function matchesDuePreset(task, preset) {
  const due = toDateOnly(task.due_date);
  const { start, end, today } = getWeekRange();

  if (preset === "today") {
    if (!due) return false;
    return due.getTime() === today.getTime();
  }

  if (preset === "week") {
    if (!due) return false;
    return due >= start && due <= end;
  }

  if (preset === "overdue") {
    if (!due) return false;
    return due < today;
  }

  if (preset === "nodue") {
    return !due;
  }

  return true;
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function buildCircleArc(cx, cy, r, startAngle, endAngle) {
  const polarToCartesian = (angle) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const start = polarToCartesian(endAngle);
  const end = polarToCartesian(startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function PieChartCard({ title, slices, total }) {
  let currentAngle = 0;

  return (
    <div className="glass-card panel-card stats-card rounded-2xl p-4">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
      <div className="mt-3 flex items-center gap-4">
        <svg width="160" height="160" viewBox="0 0 160 160" aria-label={title}>
          <circle cx="80" cy="80" r="60" fill="#eef2ff" />
          {slices.map((slice) => {
            if (!slice.value || total <= 0) return null;
            const angle = (slice.value / total) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            return (
              <path
                key={slice.label}
                d={buildCircleArc(80, 80, 60, startAngle, endAngle)}
                stroke={slice.color}
                strokeWidth="26"
                fill="none"
                strokeLinecap="butt"
              />
            );
          })}
          <circle cx="80" cy="80" r="42" fill="white" />
          <text x="80" y="76" textAnchor="middle" className="chart-total-label">Total</text>
          <text x="80" y="96" textAnchor="middle" className="chart-total-value">{total}</text>
        </svg>

        <div className="space-y-2 text-sm text-slate-700">
          {slices.map((slice) => (
            <div key={slice.label} className="flex items-center gap-2">
              <span className="legend-dot" style={{ background: slice.color }} />
              <span>{slice.label}: <b>{slice.value}</b></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChartCard({ title, bars, maxValue }) {
  return (
    <div className="glass-card panel-card stats-card rounded-2xl p-4">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
      <div className="mt-3 space-y-3">
        {bars.map((bar) => {
          const width = maxValue > 0 ? Math.max(6, (bar.value / maxValue) * 100) : 0;
          return (
            <div key={bar.label}>
              <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                <span>{bar.label}</span>
                <b>{bar.value}</b>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${width}%`, background: bar.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone = "default", helper }) {
  return (
    <div className={`stat-tile tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {helper ? <div className="stat-helper">{helper}</div> : null}
    </div>
  );
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function dateKey(dateValue) {
  const d = toDateOnly(dateValue);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay();
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;

  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
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
        className="glass-card panel-card auth-card lift relative z-10 w-full max-w-sm space-y-4 rounded-2xl p-8"
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

// ================= ADD PROPERTY =================
function AddPropertyModal({ onClose, refresh }) {
  const [form, setForm] = useState({
    property_address: "",
    property_details: "",
    client_name: "",
  });

  async function save() {
    await api("/properties", {
      method: "POST",
      body: JSON.stringify(form),
    });

    await refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card panel-card modal-card w-full max-w-xl space-y-3 rounded-2xl p-6">
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
    crew_name: "",
    status: "",
    reason_comment: "",
    due_date: "",
    last_email_update: "",
  });

  async function save() {
    await api("/urgent", {
      method: "POST",
      body: JSON.stringify(form),
    });

    await refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card panel-card modal-card w-full max-w-xl space-y-3 rounded-2xl p-6">
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
          placeholder="Crew Name"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, crew_name: e.target.value })
          }
        />

        <input
          placeholder="Status"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, status: e.target.value })
          }
        />

        <input
          placeholder="Reason"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, reason_comment: e.target.value })
          }
        />

        <input
          placeholder="Last Email Update"
          className="w-full rounded-xl border border-rose-200 p-2.5 outline-none ring-rose-200 focus:ring-2"
          onChange={(e) =>
            setForm({ ...form, last_email_update: e.target.value })
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
    const changed = getChangedFields(property, form);
    if (!Object.keys(changed).length) {
      onClose();
      return;
    }

    await api(`/properties/${property.id}`, {
      method: "PUT",
      body: JSON.stringify(changed),
    });

    await refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card panel-card modal-card w-full max-w-xl space-y-3 rounded-2xl p-6">
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

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Number(form.is_active) > 0}
            readOnly
          />
          Active is auto-calculated from urgent task count ({Number(form.is_active) || 0})
        </label>

        <div className="flex gap-2 pt-2">
          <button
            onClick={save}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110"
          >
            Save Changes
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
    const payload = {
      crew_name: form.crew_name || null,
      status: form.status || null,
      reason_comment: form.reason_comment || null,
      due_date: form.due_date || null,
      last_email_update: form.last_email_update || null,
    };

    await api(`/urgent/${task.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    await refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="glass-card panel-card modal-card w-full max-w-xl space-y-3 rounded-2xl p-6">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
          Edit Immediate Task
        </h2>

        <input
          value={form.crew_name || ""}
          onChange={(e) => setForm({ ...form, crew_name: e.target.value })}
          placeholder="Crew Name"
          className="w-full rounded-xl border border-indigo-200 p-2.5 outline-none ring-indigo-200 focus:ring-2"
        />

        <input
          value={form.status || ""}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value })
          }
          placeholder="Status"
          className="w-full rounded-xl border border-indigo-200 p-2.5 outline-none ring-indigo-200 focus:ring-2"
        />

        <input
          value={form.reason_comment || ""}
          onChange={(e) => setForm({ ...form, reason_comment: e.target.value })}
          placeholder="Reason"
          className="w-full rounded-xl border border-indigo-200 p-2.5 outline-none ring-indigo-200 focus:ring-2"
        />

        <input
          value={form.last_email_update || ""}
          onChange={(e) => setForm({ ...form, last_email_update: e.target.value })}
          placeholder="Last Email Update"
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
  const [activeTab, setActiveTab] = useState("overview");
  const [properties, setProperties] = useState([]);
  const [urgent, setUrgent] = useState([]);
  const [historyAll, setHistoryAll] = useState([]);

  const [propertySearch, setPropertySearch] = useState("");
  const [urgentSearch, setUrgentSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [crewSearch, setCrewSearch] = useState("");
  const [duePreset, setDuePreset] = useState("all");

  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [historySort, setHistorySort] = useState({ key: "changed_at", direction: "desc" });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => dateKey(new Date()));

  const [showAdd, setShowAdd] = useState(false);
  const [showUrgent, setShowUrgent] = useState(false);
  const [editingUrgent, setEditingUrgent] = useState(null);

  const [editing, setEditing] = useState(null);

  async function load() {
    const [propertiesData, urgentData, historyData] = await Promise.all([
      api("/properties"),
      api("/urgent"),
      api("/history"),
    ]);

    setProperties(propertiesData);
    setUrgent(urgentData);
    setHistoryAll(historyData);
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(id) {
    await api(`/urgent/${id}/resolve`, { method: "PUT" });
    await load();
  }

  async function deleteUrgent(id) {
    const confirmed = window.confirm("Delete this immediate task?");
    if (!confirmed) return;

    await api(`/urgent/${id}`, { method: "DELETE" });
    await load();
  }

  async function deleteProperty(id) {
    const confirmed = window.confirm(
      "Delete this property and its related urgent tasks/history?"
    );
    if (!confirmed) return;

    await api(`/properties/${id}`, { method: "DELETE" });
    await load();
  }

async function logout() {
  await api("/logout", { method: "POST", credentials: "include" });
  window.location.reload(); // simplest way
}

  const propertyQuery = normalizeText(propertySearch);
  const clientQuery = normalizeText(clientSearch);
  const urgentQuery = normalizeText(urgentSearch);
  const crewQuery = normalizeText(crewSearch);

  const filteredProperties = properties
    .filter((p) => {
      const propertyMatch = !propertyQuery || [
        p.id,
        p.property_address,
        p.property_details,
      ].some((v) => normalizeText(v).includes(propertyQuery));

      const clientMatch = !clientQuery || normalizeText(p.client_name).includes(clientQuery);

      return propertyMatch && clientMatch;
    })
    .sort((a, b) => {
      const activeDelta = Number(b.is_active || 0) - Number(a.is_active || 0);
      if (activeDelta !== 0) return activeDelta;
      return Number(b.id || 0) - Number(a.id || 0);
    });

  const filteredUrgent = urgent.filter((t) => {
    const textMatch = !urgentQuery || [
      t.id,
      t.property_id,
      t.property_address,
      t.property_details,
      t.status,
      t.reason_comment,
      t.crew_name,
      t.last_email_update,
    ].some((v) => normalizeText(v).includes(urgentQuery));

    const crewMatch = !crewQuery || normalizeText(t.crew_name).includes(crewQuery);
    const presetMatch = matchesDuePreset(t, duePreset);

    return textMatch && crewMatch && presetMatch;
  });

  const overdueCount = urgent.filter(isOverdueTask).length;
  const ongoingCount = urgent.length - overdueCount;
  const archivedCount = historyAll.length;
  const totalTaskCount = urgent.length + archivedCount;
  const activePropertyCount = properties.filter((p) => Number(p.is_active) > 0).length;
  const inactivePropertyCount = properties.length - activePropertyCount;
  const dueWeekCount = urgent.filter((t) => matchesDuePreset(t, "week")).length;
  const dueMonthCount = urgent.filter((t) => {
    const due = toDateOnly(t.due_date);
    if (!due) return false;
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return due >= toDateOnly(now) && due <= toDateOnly(end);
  }).length;
  const pendingCount = urgent.filter((t) => normalizeText(t.status).includes("pending")).length;
  const inProgressCount = urgent.filter((t) => normalizeText(t.status).includes("progress")).length;
  const activeCrewsCount = new Set(
    urgent.map((t) => normalizeText(t.crew_name)).filter((v) => v && v !== "-")
  ).size;
  const completionRate = totalTaskCount > 0 ? Math.round((archivedCount / totalTaskCount) * 100) : 0;

  const pieSlices = [
    { label: "Ongoing", value: ongoingCount, color: "#0891b2" },
    { label: "Overdue", value: overdueCount, color: "#dc2626" },
    { label: "Archived", value: archivedCount, color: "#10b981" },
  ];

  const barSeries = [
    { label: "Total Tasks", value: totalTaskCount, color: "linear-gradient(90deg, #0ea5e9, #06b6d4)" },
    { label: "Active Urgent", value: urgent.length, color: "linear-gradient(90deg, #f97316, #ef4444)" },
    { label: "Overdue", value: overdueCount, color: "linear-gradient(90deg, #ef4444, #dc2626)" },
    { label: "Active Properties", value: activePropertyCount, color: "linear-gradient(90deg, #14b8a6, #0d9488)" },
  ];
  const maxBar = Math.max(...barSeries.map((b) => b.value), 1);

  const selectedPropertyHistory = selectedPropertyId
    ? historyAll.filter((h) => String(h.property_id) === String(selectedPropertyId))
    : [];

  function toggleHistorySort(key) {
    setHistorySort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }

  const sortedSelectedPropertyHistory = [...selectedPropertyHistory].sort((a, b) => {
    const key = historySort.key;
    const direction = historySort.direction === "asc" ? 1 : -1;

    const getValue = (row) => {
      if (key === "changed_at" || key === "due_date") {
        const t = Date.parse(row[key]);
        return Number.isNaN(t) ? 0 : t;
      }

      if (key === "id" || key === "urgent_task_id") {
        return Number(row[key] || 0);
      }

      return normalizeText(row[key]);
    };

    const av = getValue(a);
    const bv = getValue(b);

    if (av < bv) return -1 * direction;
    if (av > bv) return 1 * direction;
    return 0;
  });

  function sortMarker(key) {
    if (historySort.key !== key) return "";
    return historySort.direction === "asc" ? " ▲" : " ▼";
  }

  const calendarCells = buildMonthGrid(calendarMonth);
  const taskCountByDate = urgent.reduce((acc, task) => {
    const key = dateKey(task.due_date);
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const calendarTasks = urgent.filter((t) => dateKey(t.due_date) === selectedCalendarDate);

  function duePresetButton(label, value) {
    return (
      <button
        type="button"
        className={`preset-btn ${duePreset === value ? "is-on" : ""}`}
        onClick={() => setDuePreset(value)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="dashboard-shell aurora-bg relative min-h-screen w-screen overflow-hidden p-4 md:p-6">
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl" />
      <div className="relative z-10 space-y-8">

      {/* HEADER */}
      <div className="glass-card panel-card dashboard-header flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-black tracking-tight text-slate-800">Property Command Center</h1>

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

      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === "overview" ? "is-active" : ""}`} onClick={() => setActiveTab("overview")}>Dashboard</button>
        <button className={`tab-btn ${activeTab === "properties" ? "is-active" : ""}`} onClick={() => setActiveTab("properties")}>Properties</button>
        <button className={`tab-btn ${activeTab === "urgent" ? "is-active" : ""}`} onClick={() => setActiveTab("urgent")}>Urgent Tasks</button>
        <button className={`tab-btn ${activeTab === "calendar" ? "is-active" : ""}`} onClick={() => setActiveTab("calendar")}>Calendar</button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="metrics-grid">
            <StatTile label="Total Properties" value={properties.length} tone="sky" />
            <StatTile label="Completion Rate" value={`${completionRate}%`} helper={`${archivedCount}/${totalTaskCount} tasks archived`} tone="green" />
            <StatTile label="Overdue" value={overdueCount} tone="red" />
            <StatTile label="In Progress" value={inProgressCount} tone="orange" />
            <StatTile label="Pending" value={pendingCount} tone="violet" />
            <StatTile label="Active Crews" value={activeCrewsCount} tone="teal" />
            <StatTile label="Due in Week" value={dueWeekCount} tone="amber" />
            <StatTile label="Due in Month" value={dueMonthCount} tone="pink" />
            <StatTile label="Active Properties" value={activePropertyCount} tone="cyan" />
            <StatTile label="Inactive Properties" value={inactivePropertyCount} tone="slate" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <PieChartCard title="Task Distribution" slices={pieSlices} total={totalTaskCount} />
            <BarChartCard title="Task Summary" bars={barSeries} maxValue={maxBar} />
          </div>
        </div>
      )}

      {activeTab === "properties" && (
        <div className="space-y-4">
          <div className="glass-card panel-card rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-800">All Properties</h2>
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30"
              >
                + Add Property
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} placeholder="Search property id/address/details" />
              <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search by client" />
            </div>
          </div>

          <div className="glass-card panel-card table-wrap overflow-x-auto rounded-2xl p-2">
            <table className="data-table properties-table w-full overflow-hidden rounded-xl bg-white/80 text-sm text-slate-700 shadow">
              <thead className="bg-gradient-to-r from-cyan-100 to-teal-100">
                <tr className="text-center">
                  <th className="py-2 px-1 w-[6%]">Property ID</th>
                  <th className="py-2 px-1 w-[25%]">Property</th>
                  <th className="p-1 w-[25%]">Details</th>
                  <th className="p-1 w-[15%]">Status</th>
                  <th className="p-1 w-[8%]">Client</th>
                  <th className="p-1 w-[16%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((p) => (
                  <tr key={p.id} className={`border-t border-cyan-100 text-center transition hover:bg-cyan-50/50 ${Number(p.is_active) > 0 ? "" : "is-inactive"}`}>
                    <td className="p-1">{p.id}</td>
                    <td className="p-2">{p.property_address}</td>
                    <td className="p-1">{p.property_details}</td>
                    <td className="p-1">{Number(p.is_active) > 0 ? `Active (${p.is_active})` : "Inactive (0)"}</td>
                    <td className="p-1">{p.client_name}</td>
                    <td className="action-cell space-x-2">
                      <button onClick={() => setSelectedPropertyId(p.id)} className="rounded-lg bg-cyan-500 px-3 py-1.5 font-semibold text-white shadow-md shadow-cyan-500/30">History</button>
                      <button onClick={() => setEditing(p)} className="rounded-lg bg-teal-500 px-3 py-1.5 font-semibold text-white shadow-md shadow-teal-500/30">Edit</button>
                      {(user.role === "admin" || user.role === "coordinator") && (
                        <button onClick={() => deleteProperty(p.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white shadow-md shadow-rose-600/30">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-card panel-card rounded-2xl p-4">
            <h3 className="mb-3 text-lg font-extrabold text-slate-800">
              {selectedPropertyId ? `History Timeline for Property #${selectedPropertyId}` : "Select a property and click History"}
            </h3>
            {!selectedPropertyId && <p className="text-slate-500">Archived snapshots for a selected property appear here.</p>}
            {selectedPropertyId && selectedPropertyHistory.length === 0 && <p className="text-slate-500">No archived snapshots found for this property.</p>}
            {selectedPropertyHistory.length > 0 && (
              <div className="overflow-x-auto">
                <table className="data-table w-full min-w-[920px] text-base">
                  <thead>
                    <tr>
                      <th><button type="button" className="history-sort-btn" onClick={() => toggleHistorySort("id")}>Snapshot ID{sortMarker("id")}</button></th>
                      <th><button type="button" className="history-sort-btn" onClick={() => toggleHistorySort("urgent_task_id")}>Task ID{sortMarker("urgent_task_id")}</button></th>
                      <th><button type="button" className="history-sort-btn" onClick={() => toggleHistorySort("status")}>Status{sortMarker("status")}</button></th>
                      <th><button type="button" className="history-sort-btn" onClick={() => toggleHistorySort("crew_name")}>Crew{sortMarker("crew_name")}</button></th>
                      <th><button type="button" className="history-sort-btn" onClick={() => toggleHistorySort("reason_comment")}>Reason{sortMarker("reason_comment")}</button></th>
                      <th><button type="button" className="history-sort-btn" onClick={() => toggleHistorySort("due_date")}>Due Date{sortMarker("due_date")}</button></th>
                      <th><button type="button" className="history-sort-btn" onClick={() => toggleHistorySort("last_email_update")}>Last Email Update{sortMarker("last_email_update")}</button></th>
                      <th><button type="button" className="history-sort-btn" onClick={() => toggleHistorySort("changed_at")}>Archived At{sortMarker("changed_at")}</button></th>
                    </tr>
                  </thead>
                  <tbody className="text-center">
                    {sortedSelectedPropertyHistory.map((log) => (
                      <tr key={log.id}>
                        <td>{log.id}</td>
                        <td>{log.urgent_task_id || "-"}</td>
                        <td>{log.status || "-"}</td>
                        <td>{log.crew_name || "-"}</td>
                        <td>{log.reason_comment || "-"}</td>
                        <td>{formatDate(log.due_date)}</td>
                        <td>{log.last_email_update || "-"}</td>
                        <td>{formatDate(log.changed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "urgent" && (
        <div className="space-y-4">
          <div className="glass-card panel-card rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-red-700">All Urgent Tasks</h2>
              <button
                onClick={() => setShowUrgent(true)}
                className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/30"
              >
                + Add Urgent Task
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={urgentSearch} onChange={(e) => setUrgentSearch(e.target.value)} placeholder="Search task/property/status/reason" />
              <input value={crewSearch} onChange={(e) => setCrewSearch(e.target.value)} placeholder="Search by crew" />
            </div>
            <div className="preset-row mt-2">
              {duePresetButton("Today", "today")}
              {duePresetButton("This Week", "week")}
              {duePresetButton("Overdue", "overdue")}
              {duePresetButton("No Due Date", "nodue")}
              {duePresetButton("All", "all")}
            </div>
          </div>

          <div className="glass-card panel-card table-wrap overflow-x-auto rounded-2xl p-2">
            <table className="data-table urgent-table w-full overflow-hidden rounded-xl bg-white/80 shadow text-slate-700">
              <thead className="bg-gradient-to-r from-rose-100 to-orange-100 text-center text-sm">
                <tr>
                  <th className="p-1 w-[4%]">ID</th>
                  <th className="p-1 w-[4%]">Prop ID</th>
                  <th className="p-1 w-[15%]">Property</th>
                  <th className="p-1 w-[15%]">Details</th>
                  <th className="p-1 w-[15%]">Email Update</th>
                  <th className="p-1 w-[10%]">Reason</th>
                  <th className="p-1 w-[8%]">Status</th>
                  <th className="p-1 w-[7%]">Crew</th>
                  <th className="p-1 w-[7%]">Due</th>
                  <th className="p-2 w-[15%]">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUrgent.map((t) => (
                  <tr key={t.id} className="border-t border-rose-100 text-center text-sm transition hover:bg-rose-50/60">
                    <td className="p-1">{t.id}</td>
                    <td className="p-1">{t.property_id}</td>
                    <td className="p-2">{t.property_address}</td>
                    <td className="p-2">{t.property_details}</td>
                    <td className="p-1">{t.last_email_update}</td>
                    <td className="p-1">{t.reason_comment}</td>
                    <td className="p-1">{t.status}</td>
                    <td className="p-1">{t.crew_name}</td>
                    <td className="p-1">{formatDate(t.due_date)}</td>
                    <td className="action-cell p-1 text-white">
                      {(user.role === "admin" || user.role === "coordinator") && (
                        <button onClick={() => setEditingUrgent(t)} className="rounded-lg bg-blue-500 px-3 py-1 font-semibold shadow-md shadow-blue-500/30">Edit</button>
                      )}
                      {(user.role === "admin" || user.role === "coordinator") && (
                        <button onClick={() => deleteUrgent(t.id)} className="rounded-lg bg-rose-600 px-3 py-1 font-semibold shadow-md shadow-rose-600/30">Delete</button>
                      )}
                      {user.role === "admin" && (
                        <button onClick={() => resolve(t.id)} className="rounded-lg bg-emerald-500 px-3 py-1 font-semibold shadow-md shadow-emerald-500/30">Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="space-y-4">
          <div className="glass-card panel-card rounded-2xl p-4">
            <div className="calendar-top">
              <h2 className="text-xl font-extrabold text-slate-800">Calendar View</h2>
              <div className="flex gap-2">
                <button type="button" className="preset-btn" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>Prev</button>
                <button type="button" className="preset-btn" onClick={() => setCalendarMonth(new Date())}>Today</button>
                <button type="button" className="preset-btn" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>Next</button>
              </div>
            </div>
            <h3 className="calendar-month-title">{monthLabel(calendarMonth)}</h3>
            <div className="calendar-grid-head">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
            <div className="calendar-grid">
              {calendarCells.map((cellDate) => {
                const key = dateKey(cellDate);
                const inMonth = cellDate.getMonth() === calendarMonth.getMonth();
                const count = taskCountByDate[key] || 0;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedCalendarDate(key)}
                    className={`cal-cell ${inMonth ? "" : "is-dim"} ${selectedCalendarDate === key ? "is-selected" : ""}`}
                  >
                    <span className="cal-day">{cellDate.getDate()}</span>
                    {count > 0 ? <span className="cal-badge">{count}</span> : <span className="cal-empty">-</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-card panel-card rounded-2xl p-4">
            <h3 className="text-lg font-extrabold text-slate-800">Tasks Due on {selectedCalendarDate || "-"}</h3>
            {calendarTasks.length === 0 && <p className="mt-2 text-slate-500">No tasks due on this date.</p>}
            {calendarTasks.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="data-table w-full min-w-[720px]">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Property ID</th>
                      <th>Property</th>
                      <th>Status</th>
                      <th>Crew</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody className="text-center">
                    {calendarTasks.map((t) => (
                      <tr key={t.id}>
                        <td>{t.id}</td>
                        <td>{t.property_id}</td>
                        <td>{t.property_address}</td>
                        <td>{t.status || "-"}</td>
                        <td>{t.crew_name || "-"}</td>
                        <td>{t.reason_comment || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap');

        :root {
          --ink-950: #0f172a;
          --ink-700: #334155;
          --ink-500: #64748b;
          --surface-0: #f8fafc;
          --surface-1: #ffffff;
          --line: #d9e2ec;
          --accent: #007a6b;
          --accent-strong: #006156;
          --danger: #c0362c;
          --danger-soft: #fff0ee;
          --shadow: 0 18px 48px rgba(15, 23, 42, 0.14);
        }

        * {
          box-sizing: border-box;
          font-family: 'Source Sans 3', 'Segoe UI', 'Trebuchet MS', sans-serif;
        }

        h1,
        h2,
        h3,
        button {
          font-family: 'Space Grotesk', 'Source Sans 3', sans-serif;
        }

        .dashboard-shell {
          color: var(--ink-950);
        }

        .aurora-bg {
          background:
            radial-gradient(900px 420px at 2% 0%, rgba(45, 212, 191, 0.18), transparent),
            radial-gradient(900px 500px at 100% 12%, rgba(251, 191, 36, 0.2), transparent),
            linear-gradient(146deg, #f8fbfc 0%, #eff6f8 44%, #fff7ed 100%);
        }

        .panel-card,
        .glass-card {
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(217, 226, 236, 0.8);
          box-shadow: var(--shadow);
        }

        .dashboard-header {
          border-left: 5px solid var(--accent);
        }

        .auth-card,
        .modal-card {
          border-top: 4px solid #f59e0b;
        }

        .section-title {
          letter-spacing: 0.01em;
          margin-bottom: 14px;
        }

        .table-wrap {
          border-radius: 20px;
          padding: 10px;
        }

        .stats-card {
          min-height: 220px;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          display: inline-block;
        }

        .chart-total-label {
          font-size: 12px;
          fill: #64748b;
        }

        .chart-total-value {
          font-size: 18px;
          font-weight: 700;
          fill: #0f172a;
        }

        .bar-track {
          width: 100%;
          height: 12px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 220ms ease;
        }

        .preset-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 6px;
        }

        .preset-btn {
          border: none;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.01em;
          color: #0f172a;
          background: linear-gradient(120deg, #bae6fd, #e9d5ff);
          box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
        }

        .preset-btn.is-on {
          color: white;
          background: linear-gradient(120deg, #f97316, #ef4444);
          box-shadow: 0 10px 18px rgba(239, 68, 68, 0.35);
        }

        .tab-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .tab-btn {
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 13px;
          color: #1e293b;
          background: white;
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
        }

        .tab-btn.is-active {
          color: white;
          border-color: transparent;
          background: linear-gradient(120deg, #0ea5e9, #14b8a6);
          box-shadow: 0 10px 20px rgba(20, 184, 166, 0.3);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }

        .stat-tile {
          border-radius: 14px;
          padding: 12px;
          border: 1px solid #e2e8f0;
          background: white;
        }

        .stat-label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
        }

        .stat-value {
          margin-top: 4px;
          font-size: 28px;
          font-weight: 800;
          line-height: 1;
          color: #0f172a;
        }

        .stat-helper {
          margin-top: 6px;
          font-size: 12px;
          color: #475569;
        }

        .tone-sky { background: linear-gradient(150deg, #eff6ff, #f8fafc); }
        .tone-green { background: linear-gradient(150deg, #ecfdf5, #f0fdf4); }
        .tone-red { background: linear-gradient(150deg, #fef2f2, #fff1f2); }
        .tone-orange { background: linear-gradient(150deg, #fff7ed, #fffbeb); }
        .tone-violet { background: linear-gradient(150deg, #f5f3ff, #faf5ff); }
        .tone-teal { background: linear-gradient(150deg, #ecfeff, #f0fdfa); }
        .tone-amber { background: linear-gradient(150deg, #fffbeb, #fefce8); }
        .tone-pink { background: linear-gradient(150deg, #fdf2f8, #fff1f2); }
        .tone-cyan { background: linear-gradient(150deg, #ecfeff, #f0f9ff); }
        .tone-slate { background: linear-gradient(150deg, #f8fafc, #f1f5f9); }

        .timeline-wrap {
          border-left: 2px dashed #cbd5e1;
          padding-left: 14px;
          display: grid;
          gap: 12px;
        }

        .timeline-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .timeline-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          margin-top: 6px;
          background: linear-gradient(120deg, #06b6d4, #0ea5e9);
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);
        }

        .timeline-content {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          width: 100%;
        }

        .calendar-top {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          margin-bottom: 8px;
        }

        .calendar-month-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 8px;
        }

        .calendar-grid-head,
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
        }

        .calendar-grid-head span {
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .cal-cell {
          min-height: 68px;
          border: 1px solid #dbeafe;
          border-radius: 10px;
          background: white;
          padding: 6px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
        }

        .cal-cell.is-dim {
          opacity: 0.5;
        }

        .cal-cell.is-selected {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
        }

        .cal-day {
          font-size: 12px;
          font-weight: 700;
          color: #1e293b;
        }

        .cal-badge {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: white;
          background: linear-gradient(120deg, #f97316, #ef4444);
        }

        .cal-empty {
          font-size: 11px;
          color: #94a3b8;
        }

        .data-table {
          min-width: 980px;
          border-collapse: collapse;
          border-radius: 16px;
          overflow: hidden;
          background: var(--surface-1);
        }

        .data-table thead tr {
          background: linear-gradient(90deg, #e8f7f4, #fff5e8);
        }

        .data-table th {
          color: var(--ink-700);
          font-size: 0.78rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-weight: 700;
          padding: 0.72rem 0.5rem;
        }

        .history-sort-btn {
          width: auto;
          background: transparent;
          color: inherit;
          font-size: inherit;
          font-weight: inherit;
          letter-spacing: inherit;
          text-transform: inherit;
          padding: 0;
        }

        .data-table td {
          border-top: 1px solid #edf2f7;
          color: #1e293b;
          padding: 0.64rem 0.5rem;
          vertical-align: middle;
        }

        .data-table tbody tr:hover {
          background: #f6fbfb;
        }

        .data-table .is-inactive {
          background: #edf2f7;
          opacity: 0.85;
        }

        .action-cell {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        button {
          border: none;
          cursor: pointer;
          transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
        }

        button:hover {
          transform: translateY(-1px);
          filter: brightness(1.02);
        }

        button:active {
          transform: translateY(0);
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 10px 12px;
          color: var(--ink-950);
          background: #fff;
          outline: none;
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #0d9488;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
        }

        .lift {
          animation: liftIn 0.5s ease-out;
        }

        @keyframes liftIn {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 768px) {
          .dashboard-header {
            border-left-width: 0;
            border-top: 5px solid var(--accent);
          }

          .section-title {
            font-size: 1.05rem;
          }

          .data-table {
            min-width: 920px;
          }
        }
      `}</style>

      {!user ? <Login setUser={setUser} /> : <Dashboard user={user} />}
    </>
  );
}
