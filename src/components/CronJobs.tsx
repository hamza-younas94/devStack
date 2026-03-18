import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface CronJob {
  schedule: string;
  command: string;
  raw: string;
}

type CronTab = "visual" | "raw";

const PRESETS = [
  { label: "Every Minute", value: "* * * * *" },
  { label: "Every Hour", value: "0 * * * *" },
  { label: "Every Day", value: "0 0 * * *" },
  { label: "Every Week", value: "0 0 * * 0" },
  { label: "Every Month", value: "0 0 1 * *" },
];

export default function CronJobs() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<CronTab>("visual");
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [schedule, setSchedule] = useState("");
  const [command, setCommand] = useState("");
  const [adding, setAdding] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [rawLoading, setRawLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await invoke<CronJob[]>("get_cron_jobs");
      setJobs(data);
    } catch (err) {
      toast(`Failed to load cron jobs: ${err}`, "error");
    }
    setLoading(false);
  };

  const loadRaw = async () => {
    setRawLoading(true);
    try {
      const content = await invoke<string>("get_cron_raw");
      setRawContent(content);
    } catch (err) {
      toast(`Failed to load crontab: ${err}`, "error");
    }
    setRawLoading(false);
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (activeTab === "raw") {
      loadRaw();
    }
  }, [activeTab]);

  const handleAdd = async () => {
    if (!schedule.trim() || !command.trim()) return;
    setAdding(true);
    try {
      await invoke("add_cron_job", { schedule: schedule.trim(), command: command.trim() });
      toast("Cron job added", "success");
      setSchedule("");
      setCommand("");
      await loadJobs();
    } catch (err) {
      toast(`Failed to add cron job: ${err}`, "error");
    }
    setAdding(false);
  };

  const handleRemove = async (job: CronJob) => {
    try {
      await invoke("remove_cron_job", { raw: job.raw });
      toast("Cron job removed", "success");
      await loadJobs();
    } catch (err) {
      toast(`Failed to remove cron job: ${err}`, "error");
    }
  };

  const handleSaveRaw = async () => {
    setSaving(true);
    try {
      await invoke("save_cron_raw", { content: rawContent });
      toast("Crontab saved", "success");
    } catch (err) {
      toast(`Failed to save crontab: ${err}`, "error");
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cron Jobs</h1>
          <p className="page-subtitle">Manage scheduled tasks</p>
        </div>
        <div className="btn-group">
          <button className="btn" onClick={activeTab === "visual" ? loadJobs : loadRaw} disabled={loading || rawLoading}>
            {(loading || rawLoading) ? <span className="spinner" /> : null} Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <div className="tabs">
              <button
                className={`tab ${activeTab === "visual" ? "active" : ""}`}
                onClick={() => setActiveTab("visual")}
              >
                Visual
              </button>
              <button
                className={`tab ${activeTab === "raw" ? "active" : ""}`}
                onClick={() => setActiveTab("raw")}
              >
                Raw Editor
              </button>
            </div>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {/* ===== Visual Tab ===== */}
            {activeTab === "visual" && (
              <div>
                <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
                  <div className="card-title" style={{ marginBottom: 12 }}>Add Cron Job</div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        className="btn btn-xs"
                        onClick={() => setSchedule(preset.value)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div className="form-group" style={{ flex: "0 0 200px" }}>
                      <label className="form-label">Schedule</label>
                      <input
                        className="form-input"
                        placeholder="* * * * *"
                        value={schedule}
                        onChange={(e) => setSchedule(e.target.value)}
                        style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
                      />
                      <span className="form-hint">minute hour day month weekday</span>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Command</label>
                      <input
                        className="form-input"
                        placeholder="/path/to/script.sh"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAdd();
                        }}
                        style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
                      />
                    </div>
                    <div style={{ paddingTop: 22 }}>
                      <button
                        className="btn btn-success"
                        onClick={handleAdd}
                        disabled={adding || !schedule.trim() || !command.trim()}
                      >
                        {adding ? <span className="spinner" /> : null} Add
                      </button>
                    </div>
                  </div>
                </div>

                <table className="table">
                  <thead>
                    <tr>
                      <th>Schedule</th>
                      <th>Command</th>
                      <th style={{ width: 80 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && jobs.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          <div className="empty-state">
                            <span className="spinner" /> Loading...
                          </div>
                        </td>
                      </tr>
                    )}
                    {!loading && jobs.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          <div className="empty-state">No cron jobs configured</div>
                        </td>
                      </tr>
                    )}
                    {jobs.map((job, idx) => (
                      <tr key={idx}>
                        <td>
                          <code>{job.schedule}</code>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                          {job.command}
                        </td>
                        <td>
                          <button
                            className="btn btn-xs btn-danger"
                            onClick={() => handleRemove(job)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ===== Raw Editor Tab ===== */}
            {activeTab === "raw" && (
              <div style={{ padding: 16 }}>
                <div className="warning-banner" style={{ marginBottom: 12 }}>
                  Edit carefully — invalid syntax will prevent all cron jobs from running
                </div>

                {rawLoading ? (
                  <div className="empty-state">
                    <span className="spinner" /> Loading...
                  </div>
                ) : (
                  <>
                    <textarea
                      className="config-editor"
                      value={rawContent}
                      onChange={(e) => setRawContent(e.target.value)}
                      style={{
                        width: "100%",
                        minHeight: 300,
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveRaw}
                        disabled={saving}
                      >
                        {saving ? <span className="spinner" /> : null} Save
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
