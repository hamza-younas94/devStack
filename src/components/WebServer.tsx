import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface ServiceStatus {
  name: string;
  display_name: string;
  status: string;
  version: string;
  pid: string;
  brew_name: string;
}

interface DashboardData {
  services: ServiceStatus[];
  runtimes: ServiceStatus[];
  site_count: number;
  dns_ok: boolean;
  ca_ok: boolean;
}

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

type LogTab = "error" | "access";
type ViewTab = "status" | "config" | "logs";

const CONFIG_PATH = "/opt/homebrew/etc/nginx/nginx.conf";

export default function WebServer() {
  const { toast } = useToast();
  const [nginx, setNginx] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [viewTab, setViewTab] = useState<ViewTab>("status");
  const [logTab, setLogTab] = useState<LogTab>("error");
  const [logs, setLogs] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoTail, setAutoTail] = useState(false);
  const tailRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [configContent, setConfigContent] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const dashboard = await invoke<DashboardData>("get_dashboard");
      const nginxSvc = dashboard.services.find(
        (s) => s.name.toLowerCase() === "nginx" || s.brew_name === "nginx"
      );
      setNginx(nginxSvc ?? null);
    } catch (e) {
      console.error("WebServer refresh failed:", e);
    }
    setLoading(false);
  }, []);

  const fetchLogs = useCallback(async (tab: LogTab) => {
    setLogsLoading(true);
    try {
      const logName = tab === "access" ? "nginx-access" : "nginx";
      const result = await invoke<CmdResult>("get_logs", { name: logName });
      setLogs(result.success ? result.output : result.error || "Failed to load logs");
    } catch (e) {
      setLogs(`Error loading logs: ${e}`);
    }
    setLogsLoading(false);
  }, []);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const result = await invoke<CmdResult>("read_config_file", { path: CONFIG_PATH });
      setConfigContent(result.success ? result.output : result.error || "Failed to load config");
      setConfigDirty(false);
    } catch (e) {
      setConfigContent(`Error: ${e}`);
    }
    setConfigLoading(false);
  }, []);

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const result = await invoke<CmdResult>("write_config_file", { path: CONFIG_PATH, content: configContent });
      if (result.success) {
        setConfigDirty(false);
        toast("Config saved", "success");
      } else {
        toast("Failed to save config", "error");
      }
    } catch { toast("Failed to save config", "error"); }
    setConfigSaving(false);
  };

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (viewTab === "logs") fetchLogs(logTab);
    if (viewTab === "config") loadConfig();
  }, [viewTab, logTab, fetchLogs, loadConfig]);

  // Auto-tail: refresh logs every 3s when enabled
  useEffect(() => {
    if (autoTail && viewTab === "logs") {
      tailRef.current = setInterval(() => {
        fetchLogs(logTab);
      }, 3000);
    }
    return () => {
      if (tailRef.current) clearInterval(tailRef.current);
    };
  }, [autoTail, viewTab, logTab, fetchLogs]);

  // Scroll to bottom on new logs when auto-tail is on
  useEffect(() => {
    if (autoTail && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoTail]);

  const handleAction = async (action: "start" | "stop" | "restart" | "reload") => {
    setActionLoading(action);
    try {
      if (action === "reload") {
        await invoke<CmdResult>("reload_nginx");
      } else if (action === "restart") {
        await invoke<CmdResult>("restart_service", { name: "nginx" });
      } else {
        await invoke<CmdResult>("toggle_service", { name: "nginx", action });
      }
      await refresh();
      toast(`Nginx ${action} successful`, "success");
    } catch (e) {
      toast(`Nginx ${action} failed`, "error");
      console.error(`Nginx ${action} failed:`, e);
    }
    setActionLoading("");
  };

  const isRunning = nginx?.status === "running";

  if (loading && !nginx) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <span className="spinner" /> Loading web server status...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Web Server</h1>
          <p className="page-subtitle">Nginx web server management</p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : null} Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Status Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 10, height: 10, borderRadius: "50%", display: "inline-block",
                  backgroundColor: isRunning ? "var(--green)" : "var(--red)",
                  boxShadow: isRunning ? "0 0 8px rgba(34,197,94,0.4)" : "none",
                }}
              />
              <div className="card-title">
                Nginx {nginx?.version ? `(${nginx.version})` : ""}
              </div>
            </div>
            <span className={`badge ${isRunning ? "badge-running" : "badge-stopped"}`}>
              {nginx?.status || "unknown"}
            </span>
          </div>
          <div className="card-body">
            {nginx?.pid ? (
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
                PID: {nginx.pid}
              </div>
            ) : null}
            <div className="btn-group">
              {isRunning ? (
                <button className="btn btn-sm btn-danger" onClick={() => handleAction("stop")} disabled={!!actionLoading}>
                  {actionLoading === "stop" ? <span className="spinner" /> : "Stop"}
                </button>
              ) : (
                <button className="btn btn-sm btn-success" onClick={() => handleAction("start")} disabled={!!actionLoading}>
                  {actionLoading === "start" ? <span className="spinner" /> : "Start"}
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={() => handleAction("restart")} disabled={!!actionLoading}>
                {actionLoading === "restart" ? <span className="spinner" /> : "Restart"}
              </button>
              <button className="btn btn-sm" onClick={() => handleAction("reload")} disabled={!!actionLoading}>
                {actionLoading === "reload" ? <span className="spinner" /> : "Reload Config"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {(["status", "config", "logs"] as ViewTab[]).map((t) => (
            <button
              key={t}
              className={`tab ${viewTab === t ? "active" : ""}`}
              onClick={() => setViewTab(t)}
            >
              {t === "status" ? "Configuration" : t === "config" ? "Edit nginx.conf" : "Logs"}
            </button>
          ))}
        </div>

        {viewTab === "status" && (
          <div className="card">
            <div className="card-body">
              <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 2.2, color: "var(--text-dim)" }}>
                <div><span style={{ color: "var(--text)" }}>Config:</span> /opt/homebrew/etc/nginx/nginx.conf</div>
                <div><span style={{ color: "var(--text)" }}>Sites:</span> /opt/homebrew/etc/nginx/servers/</div>
                <div><span style={{ color: "var(--text)" }}>Logs:</span> /opt/homebrew/var/log/nginx/</div>
                <div><span style={{ color: "var(--text)" }}>Web Root:</span> /opt/homebrew/var/www</div>
                <div><span style={{ color: "var(--text)" }}>Listen:</span> *:80, *:443</div>
                <div><span style={{ color: "var(--text)" }}>Worker Processes:</span> auto</div>
              </div>
            </div>
          </div>
        )}

        {viewTab === "config" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                nginx.conf
                {configDirty && <span style={{ color: "var(--yellow)", marginLeft: 8, fontSize: 11 }}>(unsaved)</span>}
              </div>
              <div className="btn-group">
                <button className="btn btn-sm" onClick={loadConfig} disabled={configLoading}>
                  {configLoading ? <span className="spinner" /> : "Reload"}
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={saveConfig}
                  disabled={configSaving || !configDirty}
                >
                  {configSaving ? <span className="spinner" /> : "Save"}
                </button>
                {configDirty && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={async () => { await saveConfig(); await handleAction("reload"); }}
                    disabled={configSaving}
                  >
                    Save & Reload
                  </button>
                )}
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <textarea
                className="config-editor"
                value={configContent}
                onChange={(e) => { setConfigContent(e.target.value); setConfigDirty(true); }}
                style={{ minHeight: 400, borderRadius: 0, border: "none", resize: "vertical" }}
              />
            </div>
          </div>
        )}

        {viewTab === "logs" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Logs</div>
              <div className="btn-group">
                <button className={`btn btn-sm ${logTab === "error" ? "btn-primary" : ""}`} onClick={() => setLogTab("error")}>
                  Error Log
                </button>
                <button className={`btn btn-sm ${logTab === "access" ? "btn-primary" : ""}`} onClick={() => setLogTab("access")}>
                  Access Log
                </button>
                <label className="checkbox-label" style={{ fontSize: 11 }}>
                  <input type="checkbox" checked={autoTail} onChange={() => setAutoTail(!autoTail)} />
                  Auto-tail
                </label>
                <button className="btn btn-sm" onClick={() => fetchLogs(logTab)} disabled={logsLoading}>
                  {logsLoading ? <span className="spinner" /> : "Refresh"}
                </button>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="log-viewer">
                {logsLoading && !logs ? (
                  <div style={{ padding: 16, textAlign: "center" }}>
                    <span className="spinner" /> Loading logs...
                  </div>
                ) : logs || <span style={{ color: "var(--text-dim)" }}>No log entries</span>}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
