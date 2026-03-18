import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

/* ── Interfaces ──────────────────────────────────────────────── */

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

interface Site {
  name: string;
  domain: string;
  root: string;
  php: string;
  ssl: string;
  site_type: string;
  port: string;
  database: string;
  db_type: string;
  cors_enabled: string;
  cors_origin: string;
  node_version: string;
  python_version: string;
  custom_nginx: string;
  created: string;
}

interface SystemStats {
  cpu_usage: string;
  memory_used: string;
  memory_total: string;
  disk_used: string;
  disk_total: string;
  ip_address: string;
}

/* ── Helpers ─────────────────────────────────────────────────── */

function parseNum(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function gaugePercent(used: string, total: string): number {
  const u = parseNum(used);
  const t = parseNum(total);
  if (t === 0) return 0;
  return Math.min(100, Math.round((u / t) * 100));
}

/* ── Circular Gauge ──────────────────────────────────────────── */

function CircularGauge({
  percent,
  size = 100,
  strokeWidth = 7,
  color = "var(--teal)",
  label,
  sublabel,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text
          x="50%"
          y="46%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="var(--text)"
          fontSize={size * 0.22}
          fontWeight="700"
        >
          {percent}%
        </text>
        {label && (
          <text
            x="50%"
            y="66%"
            dominantBaseline="central"
            textAnchor="middle"
            fill="var(--text-dim)"
            fontSize={size * 0.11}
          >
            {label}
          </text>
        )}
      </svg>
      {sublabel && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{sublabel}</div>
      )}
    </div>
  );
}

/* ── Icon Components ─────────────────────────────────────────── */

function IconBrowser() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

/* ── Dashboard Component ─────────────────────────────────────── */

export default function Dashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const uptimeRef = useRef(0);
  const [uptime, setUptime] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s, st] = await Promise.all([
        invoke<DashboardData>("get_dashboard"),
        invoke<Site[]>("get_sites"),
        invoke<SystemStats>("get_system_stats"),
      ]);
      setData(d);
      setSites(s);
      setStats(st);
    } catch (e) {
      console.error("Dashboard refresh failed:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    let alive = true;

    // Stats polling — 30s, skip if tab hidden or previous call still in-flight
    let statsBusy = false;
    const statsInterval = setInterval(async () => {
      if (document.hidden || statsBusy || !alive) return;
      statsBusy = true;
      try {
        const st = await invoke<SystemStats>("get_system_stats");
        if (alive) setStats(st);
      } catch { /* ignore */ }
      statsBusy = false;
    }, 30000);

    // Dashboard data — 60s, skip if tab hidden
    let dashBusy = false;
    const dashInterval = setInterval(async () => {
      if (document.hidden || dashBusy || !alive) return;
      dashBusy = true;
      try {
        const [d, s] = await Promise.all([
          invoke<DashboardData>("get_dashboard"),
          invoke<Site[]>("get_sites"),
        ]);
        if (alive) { setData(d); setSites(s); }
      } catch { /* ignore */ }
      dashBusy = false;
    }, 60000);

    // Uptime counter — every second
    const uptimeInterval = setInterval(() => {
      uptimeRef.current += 1;
      setUptime(uptimeRef.current);
    }, 1000);

    return () => {
      alive = false;
      clearInterval(statsInterval);
      clearInterval(dashInterval);
      clearInterval(uptimeInterval);
    };
  }, [refresh]);

  const startAll = async () => {
    setActionLoading("start");
    try {
      await invoke("start_services");
      await refresh();
      toast("All services started", "success");
    } catch (e) {
      toast(`Failed to start services: ${e}`, "error");
    }
    setActionLoading("");
  };

  const stopAll = async () => {
    setActionLoading("stop");
    try {
      await invoke("stop_services");
      await refresh();
      toast("All services stopped", "success");
    } catch (e) {
      toast(`Failed to stop services: ${e}`, "error");
    }
    setActionLoading("");
  };

  const toggleService = async (svc: ServiceStatus) => {
    const action = svc.status === "running" ? "stop" : "start";
    setActionLoading(`svc-${svc.name}`);
    try {
      await invoke("toggle_service", { name: svc.brew_name || svc.name, action });
      await refresh();
      toast(`${svc.display_name || svc.name} ${action === "start" ? "started" : "stopped"}`, "success");
    } catch (e) {
      toast(`Failed to ${action} ${svc.display_name || svc.name}: ${e}`, "error");
    }
    setActionLoading("");
  };

  const openSite = (site: Site) => {
    const protocol = site.ssl === "true" ? "https" : "http";
    invoke("open_in_browser", { url: `${protocol}://${site.domain}` }).catch(() => toast("Failed to open browser", "error"));
  };

  const openEditor = (site: Site) => {
    invoke("open_in_editor", { path: site.root }).catch(() => toast("Failed to open editor", "error"));
  };

  const openTerminal = (site: Site) => {
    invoke("open_in_terminal", { path: site.root });
  };

  /* ── Loading state ──────────────────────────────────────── */

  if (loading && !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <span className="spinner" /> Loading dashboard...
      </div>
    );
  }

  /* ── Derived data ───────────────────────────────────────── */

  const allServices = [...(data?.services ?? []), ...(data?.runtimes ?? [])];
  const runningCount = allServices.filter((s) => s.status === "running").length;
  const stoppedCount = allServices.filter((s) => s.status === "stopped").length;
  const cpuPercent = Math.round(parseNum(stats?.cpu_usage ?? "0"));
  const memPercent = gaugePercent(stats?.memory_used ?? "0", stats?.memory_total ?? "1");
  const diskPercent = gaugePercent(stats?.disk_used ?? "0", stats?.disk_total ?? "1");

  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const cpuColor =
    cpuPercent > 80 ? "var(--red)" : cpuPercent > 50 ? "var(--orange)" : "var(--teal)";
  const memColor =
    memPercent > 85 ? "var(--red)" : memPercent > 60 ? "var(--orange)" : "var(--teal)";
  const diskColor =
    diskPercent > 90 ? "var(--red)" : diskPercent > 70 ? "var(--yellow)" : "var(--teal)";

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {runningCount} services running · Session {formatUptime(uptime)}
          </p>
        </div>
        <div className="btn-group">
          <button className="btn btn-success" onClick={startAll} disabled={!!actionLoading}>
            {actionLoading === "start" && <span className="spinner" />} Start All
          </button>
          <button className="btn btn-danger" onClick={stopAll} disabled={!!actionLoading}>
            {actionLoading === "stop" && <span className="spinner" />} Stop All
          </button>
          <button className="btn" onClick={refresh} disabled={!!actionLoading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* ══════════ SYSTEM MONITOR — TOP ══════════ */}
        <div className="dash-stats-row">
          {/* CPU */}
          <div className="dash-stat-card">
            <div className="dash-stat-card-header">
              <span className="dash-stat-icon">⚡</span>
              <span className="dash-stat-label">CPU</span>
              <span className="dash-stat-live">LIVE</span>
            </div>
            <div className="dash-stat-gauge">
              <CircularGauge
                percent={cpuPercent}
                size={90}
                strokeWidth={7}
                color={cpuColor}
              />
            </div>
            <div className="dash-stat-detail">{cpuPercent}% usage</div>
          </div>

          {/* Memory */}
          <div className="dash-stat-card">
            <div className="dash-stat-card-header">
              <span className="dash-stat-icon">🧠</span>
              <span className="dash-stat-label">Memory</span>
              <span className="dash-stat-live">LIVE</span>
            </div>
            <div className="dash-stat-gauge">
              <CircularGauge
                percent={memPercent}
                size={90}
                strokeWidth={7}
                color={memColor}
              />
            </div>
            <div className="dash-stat-detail">
              {stats ? `${stats.memory_used} / ${stats.memory_total} GB` : "—"}
            </div>
          </div>

          {/* Storage */}
          <div className="dash-stat-card">
            <div className="dash-stat-card-header">
              <span className="dash-stat-icon">💾</span>
              <span className="dash-stat-label">Storage</span>
            </div>
            <div className="dash-stat-gauge">
              <CircularGauge
                percent={diskPercent}
                size={90}
                strokeWidth={7}
                color={diskColor}
              />
            </div>
            <div className="dash-stat-detail">
              {stats ? `${stats.disk_used} / ${stats.disk_total}` : "—"}
            </div>
          </div>

          {/* Network */}
          <div className="dash-stat-card">
            <div className="dash-stat-card-header">
              <span className="dash-stat-icon">🌐</span>
              <span className="dash-stat-label">Network</span>
            </div>
            <div className="dash-stat-gauge" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 90 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
                {stats?.ip_address ?? "—"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>IPv4 Address</div>
            </div>
            <div className="dash-stat-detail" style={{ color: "var(--teal)" }}>Connected</div>
          </div>
        </div>

        {/* ══════════ QUICK STATS BAR ══════════ */}
        <div className="dash-quick-stats">
          <div className="dash-quick-stat">
            <div className="dash-quick-stat-value" style={{ color: "var(--teal)" }}>{runningCount}</div>
            <div className="dash-quick-stat-label">Running</div>
          </div>
          <div className="dash-quick-stat">
            <div className="dash-quick-stat-value" style={{ color: "var(--red)" }}>{stoppedCount}</div>
            <div className="dash-quick-stat-label">Stopped</div>
          </div>
          <div className="dash-quick-stat">
            <div className="dash-quick-stat-value" style={{ color: "var(--accent)" }}>{sites.length}</div>
            <div className="dash-quick-stat-label">Websites</div>
          </div>
          <div className="dash-quick-stat">
            <div className="dash-quick-stat-value" style={{ color: data?.dns_ok ? "var(--green)" : "var(--yellow)" }}>
              {data?.dns_ok ? "Active" : "Off"}
            </div>
            <div className="dash-quick-stat-label">DNS (*.test)</div>
          </div>
          <div className="dash-quick-stat">
            <div className="dash-quick-stat-value" style={{ color: data?.ca_ok ? "var(--green)" : "var(--yellow)" }}>
              {data?.ca_ok ? "Active" : "Off"}
            </div>
            <div className="dash-quick-stat-label">SSL CA</div>
          </div>
          <div className="dash-quick-stat">
            <div className="dash-quick-stat-value" style={{ color: "var(--purple)" }}>{allServices.length}</div>
            <div className="dash-quick-stat-label">Total Pkgs</div>
          </div>
        </div>

        {/* ══════════ SERVICE STATUS CARDS ══════════ */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Services & Runtimes</div>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {runningCount}/{allServices.length} active
            </span>
          </div>
          <div className="card-body">
            <div className="svc-grid">
              {allServices.map((svc) => {
                const running = svc.status === "running";
                const available = svc.status === "available";
                const stopped = svc.status === "stopped";
                const notInstalled = svc.status === "not installed";
                const isUp = running || available;

                return (
                  <div
                    key={svc.name}
                    className={`svc-card${stopped ? " stopped" : ""}${notInstalled ? " not-installed" : ""}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          display: "inline-block",
                          backgroundColor: isUp
                            ? "var(--teal)"
                            : notInstalled
                              ? "var(--text-muted)"
                              : "var(--red)",
                          boxShadow: isUp ? "0 0 6px rgba(20,184,166,0.4)" : "none",
                          flexShrink: 0,
                        }}
                      />
                      <div className="svc-card-name">{svc.display_name || svc.name}</div>
                    </div>
                    <div className="svc-card-version">{svc.version || "—"}</div>
                    <div
                      className="svc-card-status"
                      style={{
                        color: isUp
                          ? "var(--teal)"
                          : stopped
                            ? "var(--red)"
                            : "var(--text-muted)",
                      }}
                    >
                      {isUp ? "Running" : stopped ? "Stopped" : "Not Installed"}
                    </div>
                    {running && svc.pid && (
                      <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1, fontFamily: "monospace" }}>
                        PID {svc.pid}
                      </div>
                    )}
                    {!notInstalled && (
                      <button
                        className={`btn btn-xs ${running ? "btn-danger" : "btn-success"}`}
                        style={{ marginTop: 6, width: "100%", fontSize: 10, padding: "3px 0" }}
                        disabled={actionLoading === `svc-${svc.name}`}
                        onClick={() => toggleService(svc)}
                      >
                        {actionLoading === `svc-${svc.name}` ? (
                          <span className="spinner" />
                        ) : running ? "Stop" : "Start"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════════ WEBSITES TABLE ══════════ */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Websites</div>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {sites.length} site{sites.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {sites.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                No sites configured yet. Go to Websites to create one.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th>Name</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>SSL</th>
                    <th style={{ width: 100, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.name}>
                      <td>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            display: "inline-block",
                            backgroundColor: "var(--teal)",
                            boxShadow: "0 0 6px rgba(20,184,166,0.3)",
                          }}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{site.name}</td>
                      <td style={{ color: "var(--text-dim)" }}>{site.domain}</td>
                      <td>
                        <span className={`badge badge-${site.site_type}`}>
                          {site.site_type === "php" ? "PHP" : site.site_type === "node" ? "Node.js" : site.site_type === "python" ? "Python" : site.site_type === "go" ? "Go" : site.site_type === "static" ? "Static" : site.site_type}
                        </span>
                      </td>
                      <td>
                        {site.ssl === "true" ? (
                          <span style={{ color: "var(--teal)", fontSize: 12, fontWeight: 600 }}>HTTPS</span>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>HTTP</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="btn-group" style={{ gap: 2, justifyContent: "center" }}>
                          <button className="btn btn-xs" onClick={() => openSite(site)} title="Open in browser" style={{ padding: "3px 6px" }}>
                            <IconBrowser />
                          </button>
                          <button className="btn btn-xs" onClick={() => openTerminal(site)} title="Open terminal" style={{ padding: "3px 6px" }}>
                            <IconTerminal />
                          </button>
                          <button className="btn btn-xs" onClick={() => openEditor(site)} title="Open in editor" style={{ padding: "3px 6px" }}>
                            <IconCode />
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

        {/* ══════════ ENVIRONMENT INFO ══════════ */}
        <div className="dash-env-bar">
          <div className="dash-env-item">
            <span style={{ color: "var(--text-dim)" }}>Platform</span>
            <span>macOS</span>
          </div>
          <div className="dash-env-item">
            <span style={{ color: "var(--text-dim)" }}>Engine</span>
            <span>Homebrew</span>
          </div>
          <div className="dash-env-item">
            <span style={{ color: "var(--text-dim)" }}>Web Server</span>
            <span>{data?.services.find(s => s.name === "nginx")?.version || "—"}</span>
          </div>
          <div className="dash-env-item">
            <span style={{ color: "var(--text-dim)" }}>PHP</span>
            <span>{data?.services.find(s => s.name === "php")?.version || "—"}</span>
          </div>
          <div className="dash-env-item">
            <span style={{ color: "var(--text-dim)" }}>Session</span>
            <span>{formatUptime(uptime)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
