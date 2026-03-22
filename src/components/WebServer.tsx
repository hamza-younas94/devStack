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

type ServerType = "nginx" | "caddy" | "apache";
type ViewTab = "status" | "config" | "logs";
type NginxLogTab = "error" | "access";

interface ServerConfig {
  id: ServerType;
  name: string;
  brewName: string;
  configLabel: string;
  statusPaths: { label: string; value: string }[];
  logTabs: { id: string; label: string }[];
}

const SERVERS: ServerConfig[] = [
  {
    id: "nginx",
    name: "Nginx",
    brewName: "nginx",
    configLabel: "nginx.conf",
    statusPaths: [
      { label: "Config", value: "/opt/homebrew/etc/nginx/nginx.conf" },
      { label: "Sites", value: "/opt/homebrew/etc/nginx/servers/" },
      { label: "Logs", value: "/opt/homebrew/var/log/nginx/" },
      { label: "Web Root", value: "/opt/homebrew/var/www" },
      { label: "Listen", value: "*:80, *:443" },
      { label: "Worker Processes", value: "auto" },
    ],
    logTabs: [
      { id: "error", label: "Error Log" },
      { id: "access", label: "Access Log" },
    ],
  },
  {
    id: "caddy",
    name: "Caddy",
    brewName: "caddy",
    configLabel: "Caddyfile",
    statusPaths: [
      { label: "Config", value: "/opt/homebrew/etc/Caddyfile" },
      { label: "Data", value: "~/Library/Application Support/Caddy/" },
      { label: "Logs", value: "/opt/homebrew/var/log/caddy/" },
      { label: "Listen", value: "*:80, *:443 (auto HTTPS)" },
    ],
    logTabs: [{ id: "default", label: "Caddy Log" }],
  },
  {
    id: "apache",
    name: "Apache",
    brewName: "httpd",
    configLabel: "httpd.conf",
    statusPaths: [
      { label: "Config", value: "/opt/homebrew/etc/httpd/httpd.conf" },
      { label: "Sites", value: "/opt/homebrew/etc/httpd/extra/" },
      { label: "Logs", value: "/opt/homebrew/var/log/httpd/" },
      { label: "Web Root", value: "/opt/homebrew/var/www" },
      { label: "Listen", value: "*:8080" },
    ],
    logTabs: [
      { id: "error", label: "Error Log" },
      { id: "access", label: "Access Log" },
    ],
  },
];

const NGINX_CONFIG_PATH = "/opt/homebrew/etc/nginx/nginx.conf";

export default function WebServer() {
  const { toast } = useToast();

  const [selected, setSelected] = useState<ServerType>("nginx");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [viewTab, setViewTab] = useState<ViewTab>("status");

  // Service statuses keyed by server type
  const [statuses, setStatuses] = useState<Record<ServerType, ServiceStatus | null>>({
    nginx: null,
    caddy: null,
    apache: null,
  });

  // Installed state
  const [installed, setInstalled] = useState<Record<ServerType, boolean>>({
    nginx: true,
    caddy: false,
    apache: false,
  });
  const [installing, setInstalling] = useState<ServerType | null>(null);

  // Config editor
  const [configContent, setConfigContent] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);

  // Logs
  const [logs, setLogs] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [logTab, setLogTab] = useState("error");
  const [autoTail, setAutoTail] = useState(false);
  const tailRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const currentServer = SERVERS.find((s) => s.id === selected)!;

  // --- Data fetching ---

  const checkInstalled = useCallback(async () => {
    try {
      const [nginxOk, caddyOk, apacheOk] = await Promise.all([
        invoke<boolean>("check_installed", { name: "nginx" }),
        invoke<boolean>("check_installed", { name: "caddy" }),
        invoke<boolean>("check_installed", { name: "httpd" }),
      ]);
      setInstalled({ nginx: nginxOk, caddy: caddyOk, apache: apacheOk });
    } catch {
      // leave defaults
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await checkInstalled();
      const dashboard = await invoke<DashboardData>("get_dashboard");

      const findSvc = (name: string, brew: string) =>
        dashboard.services.find(
          (s) => s.name.toLowerCase() === name || s.brew_name === brew
        ) ?? null;

      setStatuses({
        nginx: findSvc("nginx", "nginx"),
        caddy: findSvc("caddy", "caddy"),
        apache: findSvc("httpd", "httpd"),
      });
    } catch (e) {
      console.error("WebServer refresh failed:", e);
    }
    setLoading(false);
  }, [checkInstalled]);

  const fetchLogs = useCallback(
    async (tab: string) => {
      setLogsLoading(true);
      try {
        let logContent: CmdResult;
        if (selected === "nginx") {
          const logName = tab === "access" ? "nginx-access" : "nginx";
          logContent = await invoke<CmdResult>("get_logs", { name: logName });
        } else if (selected === "caddy") {
          logContent = await invoke<CmdResult>("get_logs", { name: "caddy" });
        } else {
          const logName = tab === "access" ? "httpd-access" : "httpd";
          logContent = await invoke<CmdResult>("get_logs", { name: logName });
        }
        setLogs(logContent.success ? logContent.output : logContent.error || "Failed to load logs");
      } catch (e) {
        setLogs(`Error loading logs: ${e}`);
      }
      setLogsLoading(false);
    },
    [selected]
  );

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      let result: CmdResult;
      if (selected === "nginx") {
        result = await invoke<CmdResult>("read_config_file", { path: NGINX_CONFIG_PATH });
      } else if (selected === "caddy") {
        result = await invoke<CmdResult>("get_caddyfile");
      } else {
        result = await invoke<CmdResult>("get_httpd_conf");
      }
      setConfigContent(result.success ? result.output : result.error || "Failed to load config");
      setConfigDirty(false);
    } catch (e) {
      setConfigContent(`Error: ${e}`);
    }
    setConfigLoading(false);
  }, [selected]);

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      let result: CmdResult;
      if (selected === "nginx") {
        result = await invoke<CmdResult>("write_config_file", {
          path: NGINX_CONFIG_PATH,
          content: configContent,
        });
      } else if (selected === "caddy") {
        result = await invoke<CmdResult>("save_caddyfile", { content: configContent });
      } else {
        result = await invoke<CmdResult>("save_httpd_conf", { content: configContent });
      }
      if (result.success) {
        setConfigDirty(false);
        toast("Config saved", "success");
      } else {
        toast(result.error || "Failed to save config", "error");
      }
    } catch {
      toast("Failed to save config", "error");
    }
    setConfigSaving(false);
  };

  // --- Effects ---

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reset view tab and config/logs when switching servers
  useEffect(() => {
    setViewTab("status");
    setConfigContent("");
    setConfigDirty(false);
    setLogs("");
    setAutoTail(false);
    setLogTab(currentServer.logTabs[0]?.id ?? "error");
  }, [selected, currentServer.logTabs]);

  useEffect(() => {
    if (!installed[selected]) return;
    if (viewTab === "logs") fetchLogs(logTab);
    if (viewTab === "config") loadConfig();
  }, [viewTab, logTab, fetchLogs, loadConfig, selected, installed]);

  // Auto-tail
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

  useEffect(() => {
    if (autoTail && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoTail]);

  // --- Actions ---

  const handleAction = async (action: "start" | "stop" | "restart" | "reload") => {
    setActionLoading(action);
    try {
      if (selected === "nginx") {
        if (action === "reload") {
          await invoke<CmdResult>("reload_nginx");
        } else if (action === "restart") {
          await invoke<CmdResult>("restart_service", { name: "nginx" });
        } else {
          await invoke<CmdResult>("toggle_service", { name: "nginx", action });
        }
      } else if (selected === "caddy") {
        await invoke<CmdResult>("caddy_action", { action });
      } else {
        await invoke<CmdResult>("apache_action", { action });
      }
      await refresh();
      toast(`${currentServer.name} ${action} successful`, "success");
    } catch (e) {
      toast(`${currentServer.name} ${action} failed`, "error");
      console.error(`${currentServer.name} ${action} failed:`, e);
    }
    setActionLoading("");
  };

  const handleInstall = async (server: ServerType) => {
    const cfg = SERVERS.find((s) => s.id === server)!;
    setInstalling(server);
    try {
      const result = await invoke<CmdResult>("install_package", { formula: cfg.brewName });
      if (result.success) {
        toast(`${cfg.name} installed`, "success");
        await refresh();
      } else {
        toast(result.error || `Failed to install ${cfg.name}`, "error");
      }
    } catch (e) {
      toast(`Failed to install ${cfg.name}: ${e}`, "error");
    }
    setInstalling(null);
  };

  // --- Derived ---

  const svc = statuses[selected];
  const isRunning = svc?.status === "running";
  const isInstalled = installed[selected];

  // --- Render ---

  if (loading && !statuses.nginx && !statuses.caddy && !statuses.apache) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <span className="spinner" /> Loading web server status...
      </div>
    );
  }

  const renderStatusIndicator = (serverId: ServerType) => {
    const s = statuses[serverId];
    const running = s?.status === "running";
    const inst = installed[serverId];
    return (
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          display: "inline-block",
          backgroundColor: !inst ? "var(--text-dim)" : running ? "var(--green)" : "var(--red)",
          boxShadow: running ? "0 0 6px rgba(34,197,94,0.4)" : "none",
          flexShrink: 0,
        }}
      />
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Web Servers</h1>
          <p className="page-subtitle">Manage Nginx, Caddy, and Apache web servers</p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : null} Refresh
        </button>
      </div>

      <div className="page-body">
        <div className="master-detail">
          {/* Left Panel */}
          <div className="master-list">
            <div className="master-list-header">
              <span className="master-list-title">Web Servers</span>
            </div>
            <div className="master-list-items">
              {SERVERS.map((srv) => (
                <div
                  key={srv.id}
                  className={`master-list-item ${selected === srv.id ? "active" : ""}`}
                  onClick={() => setSelected(srv.id)}
                >
                  <div className="master-list-item-info" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {renderStatusIndicator(srv.id)}
                    <div>
                      <div className="master-list-item-name">{srv.name}</div>
                      <div className="master-list-item-sub">
                        {!installed[srv.id]
                          ? "Not installed"
                          : statuses[srv.id]?.status === "running"
                            ? `Running${statuses[srv.id]?.version ? ` (${statuses[srv.id]!.version})` : ""}`
                            : "Stopped"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel */}
          <div className="master-detail-content">
            {/* Not installed state */}
            {!isInstalled ? (
              <div className="card">
                <div className="card-body" style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 14, marginBottom: 16, color: "var(--text-dim)" }}>
                    {currentServer.name} is not installed.
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleInstall(selected)}
                    disabled={installing === selected}
                  >
                    {installing === selected ? (
                      <>
                        <span className="spinner" /> Installing...
                      </>
                    ) : (
                      `Install ${currentServer.name}`
                    )}
                  </button>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
                    Installs via Homebrew ({currentServer.brewName})
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Status Card */}
                <div className="card">
                  <div className="card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          display: "inline-block",
                          backgroundColor: isRunning ? "var(--green)" : "var(--red)",
                          boxShadow: isRunning ? "0 0 8px rgba(34,197,94,0.4)" : "none",
                        }}
                      />
                      <div className="card-title">
                        {currentServer.name} {svc?.version ? `(${svc.version})` : ""}
                      </div>
                    </div>
                    <span className={`badge ${isRunning ? "badge-running" : "badge-stopped"}`}>
                      {svc?.status || "unknown"}
                    </span>
                  </div>
                  <div className="card-body">
                    {svc?.pid ? (
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
                        PID: {svc.pid}
                      </div>
                    ) : null}
                    <div className="btn-group">
                      {isRunning ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleAction("stop")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === "stop" ? <span className="spinner" /> : "Stop"}
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleAction("start")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === "start" ? <span className="spinner" /> : "Start"}
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAction("restart")}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === "restart" ? <span className="spinner" /> : "Restart"}
                      </button>
                      {selected === "nginx" && (
                        <button
                          className="btn btn-sm"
                          onClick={() => handleAction("reload")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === "reload" ? <span className="spinner" /> : "Reload Config"}
                        </button>
                      )}
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
                      {t === "status"
                        ? "Overview"
                        : t === "config"
                          ? `Edit ${currentServer.configLabel}`
                          : "Logs"}
                    </button>
                  ))}
                </div>

                {/* Status / Overview Tab */}
                {viewTab === "status" && (
                  <div className="card">
                    <div className="card-body">
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          lineHeight: 2.2,
                          color: "var(--text-dim)",
                        }}
                      >
                        {currentServer.statusPaths.map((p) => (
                          <div key={p.label}>
                            <span style={{ color: "var(--text)" }}>{p.label}:</span> {p.value}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Config Tab */}
                {viewTab === "config" && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">
                        {currentServer.configLabel}
                        {configDirty && (
                          <span style={{ color: "var(--yellow)", marginLeft: 8, fontSize: 11 }}>
                            (unsaved)
                          </span>
                        )}
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
                            onClick={async () => {
                              await saveConfig();
                              if (selected === "nginx") {
                                await handleAction("reload");
                              } else {
                                await handleAction("restart");
                              }
                            }}
                            disabled={configSaving}
                          >
                            {selected === "nginx" ? "Save & Reload" : "Save & Restart"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      <textarea
                        className="config-editor"
                        value={configContent}
                        onChange={(e) => {
                          setConfigContent(e.target.value);
                          setConfigDirty(true);
                        }}
                        style={{ minHeight: 400, borderRadius: 0, border: "none", resize: "vertical" }}
                      />
                    </div>
                  </div>
                )}

                {/* Logs Tab */}
                {viewTab === "logs" && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Logs</div>
                      <div className="btn-group">
                        {currentServer.logTabs.map((lt) => (
                          <button
                            key={lt.id}
                            className={`btn btn-sm ${logTab === lt.id ? "btn-primary" : ""}`}
                            onClick={() => setLogTab(lt.id)}
                          >
                            {lt.label}
                          </button>
                        ))}
                        <label className="checkbox-label" style={{ fontSize: 11 }}>
                          <input
                            type="checkbox"
                            checked={autoTail}
                            onChange={() => setAutoTail(!autoTail)}
                          />
                          Auto-tail
                        </label>
                        <button
                          className="btn btn-sm"
                          onClick={() => fetchLogs(logTab)}
                          disabled={logsLoading}
                        >
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
                        ) : (
                          logs || (
                            <span style={{ color: "var(--text-dim)" }}>No log entries</span>
                          )
                        )}
                        <div ref={logEndRef} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
