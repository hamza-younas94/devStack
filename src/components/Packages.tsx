import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface PackageInfo {
  name: string;
  version: string;
  status: string;
  pid: number;
  category: string;
}

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

interface OutdatedPkg {
  name: string;
  current: string;
  latest: string;
}

const CATEGORY_ORDER = [
  "Web Server",
  "Databases",
  "Languages",
  "Common Services",
  "Dev Tools",
  "AI",
  "Search",
  "Object Storage",
];

const TOGGLEABLE_SERVICES = new Set([
  "nginx", "mysql", "mariadb", "postgresql", "mongodb",
  "redis", "memcached", "dnsmasq", "ollama", "meilisearch", "minio", "php",
]);

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "running": return "badge badge-running";
    case "stopped": return "badge badge-stopped";
    case "installed": return "badge badge-installed";
    default: return "badge";
  }
}

function computeSummary(packages: PackageInfo[]) {
  let running = 0;
  let installed = 0;
  for (const pkg of packages) {
    const s = pkg.status.toLowerCase();
    if (s === "running") running++;
    if (s !== "not installed") installed++;
  }
  return { running, installed, total: packages.length };
}

export default function Packages() {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [outdated, setOutdated] = useState<OutdatedPkg[]>([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [upgradingPkg, setUpgradingPkg] = useState("");
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const pkgs = await invoke<PackageInfo[]>("get_packages");
      setPackages(pkgs);
    } catch (e) {
      console.error("Failed to fetch packages:", e);
      toast("Failed to fetch packages", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (pkg: PackageInfo) => {
    const action = pkg.status.toLowerCase() === "running" ? "stop" : "start";
    setActionLoading(pkg.name);
    try {
      await invoke<CmdResult>("toggle_service", { name: pkg.name, action });
      await refresh();
      toast(`${pkg.name} ${action === "start" ? "started" : "stopped"} successfully`, "success");
    } catch (e) {
      console.error(`Toggle ${pkg.name} error:`, e);
      toast(`Failed to ${action} ${pkg.name}`, "error");
    }
    setActionLoading("");
  };

  const restart = async (pkg: PackageInfo) => {
    setActionLoading(pkg.name);
    try {
      await invoke<CmdResult>("restart_service", { name: pkg.name });
      await refresh();
      toast(`${pkg.name} restarted successfully`, "success");
    } catch (e) {
      console.error(`Restart ${pkg.name} error:`, e);
      toast(`Failed to restart ${pkg.name}`, "error");
    }
    setActionLoading("");
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const result = await invoke<OutdatedPkg[]>("check_outdated_packages");
      setOutdated(result);
      toast(result.length > 0 ? `${result.length} update${result.length !== 1 ? "s" : ""} available` : "All packages are up to date", "success");
    } catch {
      toast("Failed to check for updates", "error");
    }
    setCheckingUpdates(false);
  };

  const upgradePackage = async (name: string) => {
    setUpgradingPkg(name);
    try {
      await invoke<CmdResult>("upgrade_package", { name });
      await checkForUpdates();
      await refresh();
      toast(`${name} upgraded successfully`, "success");
    } catch {
      toast(`Failed to upgrade ${name}`, "error");
    }
    setUpgradingPkg("");
  };

  const upgradeAll = async () => {
    setUpgradingPkg("__all__");
    for (const pkg of outdated) {
      try {
        await invoke<CmdResult>("upgrade_package", { name: pkg.name });
      } catch {
        toast(`Failed to upgrade ${pkg.name}`, "error");
      }
    }
    await checkForUpdates();
    await refresh();
    toast("All packages upgraded", "success");
    setUpgradingPkg("");
  };

  const canToggle = (pkg: PackageInfo) => TOGGLEABLE_SERVICES.has(pkg.name.toLowerCase());

  const grouped = CATEGORY_ORDER
    .map((cat) => ({ category: cat, items: packages.filter((p) => p.category === cat) }))
    .filter((g) => g.items.length > 0);

  const knownCategories = new Set(CATEGORY_ORDER);
  const uncategorized = packages.filter((p) => !knownCategories.has(p.category));
  if (uncategorized.length > 0) grouped.push({ category: "Other", items: uncategorized });

  const summary = computeSummary(packages);

  if (loading && packages.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <span className="spinner" /> Loading packages...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Packages</h1>
          <p className="page-subtitle">
            {summary.running} running, {summary.installed} installed, {summary.total} total
          </p>
        </div>
        <div className="btn-group">
          <button className="btn" onClick={checkForUpdates} disabled={checkingUpdates}>
            {checkingUpdates ? <span className="spinner" /> : null} Check for Updates
          </button>
          <button className="btn btn-primary" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" /> : null} Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Outdated Packages */}
        {outdated.length > 0 && (
          <div className="card" style={{ borderColor: "rgba(234,179,8,0.3)" }}>
            <div className="card-header">
              <div className="card-title" style={{ color: "var(--yellow)" }}>
                {outdated.length} Update{outdated.length !== 1 ? "s" : ""} Available
              </div>
              <button
                className="btn btn-sm btn-primary"
                onClick={upgradeAll}
                disabled={upgradingPkg === "__all__"}
              >
                {upgradingPkg === "__all__" ? <span className="spinner" /> : null} Upgrade All
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {outdated.map((pkg) => (
                <div className="pkg-row" key={pkg.name}>
                  <div className="pkg-name">{pkg.name}</div>
                  <div className="pkg-version">
                    <span style={{ color: "var(--text-muted)" }}>{pkg.current}</span>
                    <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>&rarr;</span>
                    <span style={{ color: "var(--green)", fontWeight: 600 }}>{pkg.latest}</span>
                  </div>
                  <div className="pkg-status">
                    <span className="badge" style={{ background: "var(--yellow-bg)", color: "var(--yellow)" }}>
                      Update
                    </span>
                  </div>
                  <div className="pkg-pid" />
                  <div className="pkg-actions">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => upgradePackage(pkg.name)}
                      disabled={!!upgradingPkg}
                    >
                      {upgradingPkg === pkg.name ? <span className="spinner" /> : "Upgrade"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {outdated.length === 0 && checkingUpdates === false && packages.length > 0 && (
          <div className="info-banner" style={{ display: "none" }} />
        )}

        {grouped.map((group) => (
          <div className="card" key={group.category}>
            <div className="card-header">
              <div className="card-title card-section-title">{group.category}</div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {group.items.map((pkg) => {
                const isToggleable = canToggle(pkg);
                const isRunning = pkg.status.toLowerCase() === "running";
                const isNotInstalled = pkg.status.toLowerCase() === "not installed";
                const isLoading = actionLoading === pkg.name;

                return (
                  <div className="pkg-row" key={pkg.name}>
                    <div className="pkg-name">{pkg.name}</div>
                    <div className="pkg-version">{pkg.version || "\u2014"}</div>
                    <div className="pkg-status">
                      <span className={statusBadgeClass(pkg.status)}>{pkg.status}</span>
                    </div>
                    <div className="pkg-pid">{pkg.pid > 0 ? String(pkg.pid) : ""}</div>
                    <div className="pkg-actions">
                      {isToggleable && !isNotInstalled && (
                        <>
                          {isLoading ? (
                            <span className="spinner" />
                          ) : (
                            <div className="btn-group">
                              <button
                                className={`btn btn-sm ${isRunning ? "btn-danger" : "btn-success"}`}
                                onClick={() => toggle(pkg)}
                              >
                                {isRunning ? "Stop" : "Start"}
                              </button>
                              {isRunning && (
                                <button className="btn btn-sm" onClick={() => restart(pkg)}>
                                  Restart
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
