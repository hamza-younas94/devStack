import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

interface BackupEntry {
  id: string;
  date: string;
  size: string;
  contents: string[];
}

interface BackupSchedule {
  frequency: string;
  contents: string[];
}

type Frequency = "off" | "daily" | "weekly" | "monthly";

const frequencyOptions: { value: Frequency; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const frequencyDescriptions: Record<Frequency, string> = {
  off: "Scheduled backups are disabled",
  daily: "Daily at 2:00 AM",
  weekly: "Weekly on Sunday at 2:00 AM",
  monthly: "First of every month at 2:00 AM",
};

const backupContentOptions = [
  { key: "config", label: "DevStack Configuration", desc: "Global settings, PHP config, dnsmasq, environment" },
  { key: "websites", label: "All Websites & Nginx configs", desc: "Site definitions and nginx server blocks" },
  { key: "ssl", label: "SSL Certificates", desc: "DevStack CA and all generated site certificates" },
  { key: "mysql", label: "MySQL Databases", desc: "Full mysqldump of all databases" },
  { key: "postgres", label: "PostgreSQL Databases", desc: "Full pg_dump of all databases" },
  { key: "files", label: "Site files & document roots", desc: "All files in ~/.devstack/sites/" },
];

export default function Backup() {
  const { toast } = useToast();
  // Scheduled backup state
  const [scheduleFrequency, setScheduleFrequency] = useState<Frequency>("off");
  const [scheduleContents, setScheduleContents] = useState<Record<string, boolean>>({
    config: true,
    websites: true,
    ssl: true,
    mysql: true,
    postgres: true,
    files: true,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);

  // Manual backup state
  const [selectedContent, setSelectedContent] = useState<Record<string, boolean>>({
    config: true,
    websites: true,
    ssl: true,
    mysql: true,
    postgres: true,
    files: true,
  });
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshBackups = useCallback(async () => {
    try {
      const list = await invoke<BackupEntry[]>("get_backups");
      setBackups(list);
    } catch {
      // ignore
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const result = await invoke<CmdResult>("get_backup_schedule");
      if (result.success && result.output) {
        const sched: BackupSchedule = JSON.parse(result.output);
        const freq = sched.frequency as Frequency;
        if (frequencyOptions.some((o) => o.value === freq)) {
          setScheduleFrequency(freq);
        }
        if (sched.contents && sched.contents.length > 0) {
          const contents: Record<string, boolean> = {};
          backupContentOptions.forEach((o) => {
            contents[o.key] = sched.contents.includes(o.key);
          });
          setScheduleContents(contents);
        }
      }
    } catch {
      // no schedule set yet, keep defaults
    } finally {
      setScheduleLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshBackups();
    loadSchedule();
  }, [refreshBackups, loadSchedule]);

  const saveSchedule = async (frequency: Frequency, contents: Record<string, boolean>) => {
    setScheduleSaving(true);
    try {
      const selected = backupContentOptions
        .filter((o) => contents[o.key])
        .map((o) => o.key);
      await invoke<CmdResult>("set_backup_schedule", {
        frequency,
        contents: selected,
      });
    } catch (e) {
      console.error("Failed to save backup schedule:", e);
    }
    setScheduleSaving(false);
  };

  const handleFrequencyChange = (freq: Frequency) => {
    setScheduleFrequency(freq);
    saveSchedule(freq, scheduleContents);
  };

  const toggleScheduleContent = (key: string) => {
    const updated = { ...scheduleContents, [key]: !scheduleContents[key] };
    setScheduleContents(updated);
    saveSchedule(scheduleFrequency, updated);
  };

  const toggleContent = (key: string) => {
    setSelectedContent((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    const allSelected = backupContentOptions.every((o) => selectedContent[o.key]);
    const next: Record<string, boolean> = {};
    backupContentOptions.forEach((o) => {
      next[o.key] = !allSelected;
    });
    setSelectedContent(next);
  };

  const handleCreateBackup = async () => {
    const included = backupContentOptions
      .filter((o) => selectedContent[o.key])
      .map((o) => o.key);
    if (included.length === 0) return;
    setLoading(true);
    try {
      await invoke("create_backup", { contents: included });
      await refreshBackups();
      toast("Backup created successfully", "success");
    } catch (e) {
      toast(`Backup failed: ${e}`, "error");
    }
    setLoading(false);
  };

  const handleRestore = async (id: string) => {
    if (!confirm("Restore this backup? This will overwrite current data and restart affected services.")) return;
    setLoading(true);
    try {
      await invoke("restore_backup", { id });
      toast("Backup restored", "success");
    } catch (e) {
      toast(`Restore failed: ${e}`, "error");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this backup? This cannot be undone.")) return;
    try {
      await invoke("delete_backup", { id });
      setBackups((prev) => prev.filter((b) => b.id !== id));
      toast("Backup deleted", "success");
    } catch (e) {
      toast(`Delete failed: ${e}`, "error");
    }
  };

  const selectedCount = backupContentOptions.filter((o) => selectedContent[o.key]).length;
  const scheduleContentCount = backupContentOptions.filter((o) => scheduleContents[o.key]).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Backup</h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleCreateBackup}
          disabled={loading || selectedCount === 0}
        >
          {loading ? <span className="spinner" /> : null} Create Backup
        </button>
      </div>

      <div className="page-body">
        {/* Scheduled Backups */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Scheduled Backups</div>
            {scheduleSaving && (
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />
                Saving...
              </span>
            )}
          </div>
          <div className="card-body">
            {/* Status banner */}
            {scheduleLoaded && (
              <div
                className={scheduleFrequency === "off" ? "info-banner" : "success-banner"}
                style={{ marginBottom: 16 }}
              >
                {scheduleFrequency === "off"
                  ? "Scheduled backups are disabled. Select a frequency to enable automatic backups."
                  : `Scheduled: ${frequencyDescriptions[scheduleFrequency]} \u2014 ${scheduleContentCount} item${scheduleContentCount !== 1 ? "s" : ""} selected`}
              </div>
            )}

            {/* Frequency selector */}
            <div className="settings-row">
              <div>
                <div className="settings-label">Frequency</div>
                <div className="settings-desc">How often to run automatic backups</div>
              </div>
              <div className="appearance-options">
                {frequencyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`appearance-option ${scheduleFrequency === opt.value ? "active" : ""}`}
                    onClick={() => handleFrequencyChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content checkboxes for schedule */}
            {scheduleFrequency !== "off" && (
              <>
                <div className="settings-row" style={{ borderBottom: "none", paddingBottom: 4 }}>
                  <div>
                    <div className="settings-label">Backup Contents</div>
                    <div className="settings-desc">Select what to include in scheduled backups</div>
                  </div>
                </div>
                {backupContentOptions.map((opt) => (
                  <div className="settings-row" key={`sched-${opt.key}`} style={{ paddingTop: 6, paddingBottom: 6 }}>
                    <label className="checkbox-label" style={{ fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={!!scheduleContents[opt.key]}
                        onChange={() => toggleScheduleContent(opt.key)}
                      />
                      {opt.label}
                    </label>
                  </div>
                ))}
              </>
            )}

            <div className="settings-row" style={{ borderBottom: "none" }}>
              <div>
                <div className="settings-label">Backup Location</div>
                <div className="settings-desc">
                  <code style={{ fontSize: 12 }}>~/.devstack/backups/</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Backup Content */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Manual Backup</div>
            <button className="btn btn-sm" onClick={selectAll}>
              {backupContentOptions.every((o) => selectedContent[o.key])
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>
          <div className="card-body">
            {backupContentOptions.map((opt) => (
              <div className="settings-row" key={opt.key}>
                <div>
                  <label className="checkbox-label" style={{ fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={!!selectedContent[opt.key]}
                      onChange={() => toggleContent(opt.key)}
                    />
                    {opt.label}
                  </label>
                  <div className="settings-desc" style={{ marginLeft: 22 }}>
                    {opt.desc}
                  </div>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="btn btn-primary"
                onClick={handleCreateBackup}
                disabled={loading || selectedCount === 0}
              >
                {loading ? <span className="spinner" /> : null} Create Backup Now
              </button>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {selectedCount} of {backupContentOptions.length} items selected
              </span>
            </div>
          </div>
        </div>

        {/* Existing Backups */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Existing Backups</div>
          </div>
          <div className="card-body">
            {backups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 36, opacity: 0.3 }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div className="empty-state-text">No backups yet</div>
                <div className="empty-state-hint">
                  Create your first backup above.
                </div>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Size</th>
                    <th>Contents</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.id}>
                      <td>{backup.date}</td>
                      <td>{backup.size}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {backup.contents.map((c) => (
                            <span key={c} className="badge" style={{ fontSize: 10 }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleRestore(backup.id)}
                            disabled={loading}
                          >
                            Restore
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(backup.id)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Restore */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Restore from File</div>
          </div>
          <div className="card-body">
            <div className="info-banner" style={{ marginBottom: 16 }}>
              Restore a backup from an external archive file. Use this if you moved
              your backup to another machine or need to restore from a manual export.
            </div>

            <div className="warning-banner" style={{ marginBottom: 16 }}>
              Restoring will overwrite your current DevStack configuration, databases,
              and site files. All affected services will be stopped and restarted
              during the restore process. Make sure to back up your current data first.
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="form-input"
                placeholder="Enter path to backup file (.tar.gz)"
                id="restore-file-path"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const input = document.getElementById("restore-file-path") as HTMLInputElement;
                  const filePath = input?.value?.trim();
                  if (!filePath) { toast("Enter a backup file path", "error"); return; }
                  const id = filePath.split("/").pop()?.replace(".tar.gz", "") || "";
                  try {
                    const result = await invoke<CmdResult>("restore_backup", { id });
                    if (result.success) {
                      toast("Backup restored successfully", "success");
                    } else {
                      toast(result.error || "Restore failed", "error");
                    }
                  } catch (e) {
                    toast(`Restore failed: ${e}`, "error");
                  }
                }}
              >
                Restore
              </button>
            </div>
            <span style={{ marginTop: 6, display: "block", fontSize: 12, color: "var(--text-dim)" }}>
              Supports .tar.gz archives from DevStack backups
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
