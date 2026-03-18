import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

export default function Mail() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"running" | "stopped" | "not_installed">("not_installed");
  const [provider, setProvider] = useState("mailpit");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<CmdResult>("get_mail_status");
      const out = result.output;
      if (out.includes("running")) {
        setStatus("running");
        setProvider(out.startsWith("mailpit") ? "mailpit" : "mailhog");
      } else if (out.includes("stopped") || out.includes("installed")) {
        setStatus("stopped");
      } else {
        setStatus("not_installed");
      }
    } catch {
      toast("Failed to fetch mail server status", "error");
      setStatus("not_installed");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (action: string) => {
    setActionLoading(action);
    try {
      await invoke<CmdResult>("toggle_mail", { action });
      toast(`Mail server ${action === "start" ? "started" : "stopped"} successfully`, "success");
      await refresh();
    } catch {
      toast(`Failed to ${action} mail server`, "error");
    }
    setActionLoading("");
  };

  const install = async () => {
    setActionLoading("install");
    try {
      await invoke<CmdResult>("install_package", { formula: "mailpit" });
      toast("Mailpit installed successfully", "success");
      await refresh();
    } catch {
      toast("Failed to install Mailpit", "error");
    }
    setActionLoading("");
  };

  const isRunning = status === "running";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mail</h1>
          <p className="page-subtitle">Local mail server for development</p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : null} Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Status */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mail Server</div>
            <span className={`badge ${isRunning ? "badge-running" : status === "stopped" ? "badge-stopped" : ""}`}>
              {isRunning ? "Running" : status === "stopped" ? "Stopped" : "Not Installed"}
            </span>
          </div>
          <div className="card-body">
            {status === "not_installed" ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Mailpit not installed</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Mailpit captures all outgoing mail from your applications for local testing.
                  </div>
                </div>
                <button className="btn btn-primary" onClick={install} disabled={!!actionLoading}>
                  {actionLoading === "install" ? <span className="spinner" /> : null} Install Mailpit
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: "50%", display: "inline-block",
                      backgroundColor: isRunning ? "var(--green)" : "var(--red)",
                      boxShadow: isRunning ? "0 0 8px rgba(34,197,94,0.4)" : "none",
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{provider === "mailpit" ? "Mailpit" : "MailHog"}</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                      SMTP: localhost:1025 · Web UI: http://localhost:8025
                    </div>
                  </div>
                </div>
                <div className="btn-group">
                  {actionLoading ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      <button
                        className={`btn btn-sm ${isRunning ? "btn-danger" : "btn-success"}`}
                        onClick={() => toggle(isRunning ? "stop" : "start")}
                      >
                        {isRunning ? "Stop" : "Start"}
                      </button>
                      {isRunning && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => invoke("open_in_browser", { url: "http://localhost:8025" })}
                        >
                          Open Web UI
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configuration */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Configuration</div>
          </div>
          <div className="card-body">
            <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 2.2, color: "var(--text-dim)" }}>
              <div><span style={{ color: "var(--text)" }}>SMTP Host:</span> localhost</div>
              <div><span style={{ color: "var(--text)" }}>SMTP Port:</span> 1025</div>
              <div><span style={{ color: "var(--text)" }}>Web UI:</span> http://localhost:8025</div>
              <div><span style={{ color: "var(--text)" }}>Encryption:</span> None (local only)</div>
              <div><span style={{ color: "var(--text)" }}>Authentication:</span> Not required</div>
            </div>
          </div>
        </div>

        {/* Integration */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Framework Integration</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
              Configure your application to send mail through Mailpit:
            </div>
            <div className="log-viewer" style={{ maxHeight: 200 }}>
{`# Laravel (.env)
MAIL_MAILER=smtp
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_ENCRYPTION=null

# WordPress (wp-config.php)
define('SMTP_HOST', 'localhost');
define('SMTP_PORT', 1025);

# Node.js (nodemailer)
const transport = nodemailer.createTransport({
  host: 'localhost',
  port: 1025,
});`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
