import { useState, useEffect, useCallback } from "react";
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

interface VersionInfo {
  formula: string;
  version: string;
  installed: boolean;
  active: boolean;
  running: boolean;
}

interface DashboardData {
  runtimes: ServiceStatus[];
}

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

interface LanguageEntry {
  key: string;
  label: string;
  icon: string;
  brewPackage: string;
}

const LANGUAGES: LanguageEntry[] = [
  { key: "php", label: "PHP", icon: "🐘", brewPackage: "php" },
  { key: "node", label: "Node.js", icon: "⬢", brewPackage: "node" },
  { key: "python", label: "Python", icon: "🐍", brewPackage: "python" },
  { key: "go", label: "Go", icon: "🔵", brewPackage: "go" },
  { key: "java", label: "Java", icon: "☕", brewPackage: "openjdk" },
  { key: "ruby", label: "Ruby", icon: "💎", brewPackage: "ruby" },
  { key: "rust", label: "Rust", icon: "🦀", brewPackage: "rust" },
  { key: "dotnet", label: ".NET", icon: "🔷", brewPackage: "dotnet" },
  { key: "bun", label: "Bun", icon: "🍞", brewPackage: "bun" },
  { key: "deno", label: "Deno", icon: "🦕", brewPackage: "deno" },
];

export default function Languages() {
  const { toast } = useToast();
  const [selected, setSelected] = useState("php");
  const [loading, setLoading] = useState(true);

  // Per-language data
  const [installedVersions, setInstalledVersions] = useState<Record<string, VersionInfo[]>>({});
  const [availableVersions, setAvailableVersions] = useState<Record<string, string[]>>({});
  const [phpVersions, setPhpVersions] = useState<ServiceStatus[]>([]);
  const [runtimes, setRuntimes] = useState<ServiceStatus[]>([]);

  // Action states
  const [actionLoading, setActionLoading] = useState<string>("");
  const [installLoading, setInstallLoading] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [confirmUninstall, setConfirmUninstall] = useState<string>("");
  const [configPaths, setConfigPaths] = useState<[string, string][]>([]);
  const [selectedConfig, setSelectedConfig] = useState("");
  const [configContent, setConfigContent] = useState("");
  const [configDirty, setConfigDirty] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const selectedLang = LANGUAGES.find((l) => l.key === selected)!;

  const loadInstalledVersions = useCallback(async (lang: LanguageEntry) => {
    try {
      const versions = await invoke<VersionInfo[]>("get_installed_versions", {
        package: lang.brewPackage,
      });
      setInstalledVersions((prev) => ({ ...prev, [lang.key]: versions }));
    } catch (e) {
      console.error(`Failed to load installed versions for ${lang.label}:`, e);
    }
  }, []);

  const loadAvailableVersions = useCallback(async (lang: LanguageEntry) => {
    try {
      const versions = await invoke<string[]>("get_available_versions", {
        package: lang.brewPackage,
      });
      setAvailableVersions((prev) => ({ ...prev, [lang.key]: versions }));
    } catch (e) {
      console.error(`Failed to load available versions for ${lang.label}:`, e);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, php] = await Promise.all([
        invoke<DashboardData>("get_dashboard"),
        invoke<ServiceStatus[]>("get_php_versions"),
      ]);
      setRuntimes(dashboard.runtimes);
      setPhpVersions(php);

      // Load installed and available versions for all languages in parallel
      await Promise.all(
        LANGUAGES.flatMap((lang) => [
          loadInstalledVersions(lang),
          loadAvailableVersions(lang),
        ])
      );
    } catch (e) {
      console.error("Languages refresh failed:", e);
      setError(String(e));
    }
    setLoading(false);
  }, [loadInstalledVersions, loadAvailableVersions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshSelected = useCallback(async () => {
    const lang = LANGUAGES.find((l) => l.key === selected);
    if (!lang) return;
    await Promise.all([loadInstalledVersions(lang), loadAvailableVersions(lang)]);
    if (lang.key === "php") {
      try {
        const php = await invoke<ServiceStatus[]>("get_php_versions");
        setPhpVersions(php);
      } catch (e) {
        console.error("Failed to refresh PHP versions:", e);
      }
    }
  }, [selected, loadInstalledVersions, loadAvailableVersions]);

  const handleSwitch = async (lang: LanguageEntry, formula: string) => {
    setActionLoading(`switch-${formula}`);
    setError("");
    try {
      if (lang.key === "php") {
        const ver = formula.replace("php@", "").replace("php", "");
        const result = await invoke<CmdResult>("switch_php", { version: ver });
        if (!result.success) {
          setError(result.error || "Failed to switch PHP version");
        }
      } else {
        // For non-PHP, stop current active, start the target
        const installed = installedVersions[lang.key] || [];
        const currentActive = installed.find((v) => v.active && v.running);
        if (currentActive && currentActive.formula !== formula) {
          await invoke<CmdResult>("stop_package", { formula: currentActive.formula });
        }
        const result = await invoke<CmdResult>("start_package", { formula });
        if (!result.success) {
          setError(result.error || `Failed to switch to ${formula}`);
        }
      }
      await refreshSelected();
    } catch (e) {
      setError(String(e));
    }
    setActionLoading("");
  };

  const handleStart = async (formula: string) => {
    setActionLoading(`start-${formula}`);
    setError("");
    try {
      const result = await invoke<CmdResult>("start_package", { formula });
      if (!result.success) {
        setError(result.error || `Failed to start ${formula}`);
      }
      await refreshSelected();
    } catch (e) {
      setError(String(e));
    }
    setActionLoading("");
  };

  const handleStop = async (formula: string) => {
    setActionLoading(`stop-${formula}`);
    setError("");
    try {
      const result = await invoke<CmdResult>("stop_package", { formula });
      if (!result.success) {
        setError(result.error || `Failed to stop ${formula}`);
      }
      await refreshSelected();
    } catch (e) {
      setError(String(e));
    }
    setActionLoading("");
  };

  const handleInstall = async (formula: string) => {
    setInstallLoading(formula);
    setError("");
    try {
      const result = await invoke<CmdResult>("install_package", { formula });
      if (!result.success) {
        setError(result.error || `Failed to install ${formula}`);
      }
      await refreshSelected();
    } catch (e) {
      setError(String(e));
    }
    setInstallLoading("");
  };

  const handleUninstall = async (formula: string) => {
    if (confirmUninstall !== formula) {
      setConfirmUninstall(formula);
      return;
    }
    setConfirmUninstall("");
    setActionLoading(`uninstall-${formula}`);
    setError("");
    try {
      const result = await invoke<CmdResult>("uninstall_package", { formula });
      if (!result.success) {
        setError(result.error || `Failed to uninstall ${formula}`);
      }
      await refreshSelected();
    } catch (e) {
      setError(String(e));
    }
    setActionLoading("");
  };

  const getSubtitle = (lang: LanguageEntry): string => {
    const versions = installedVersions[lang.key] || [];
    if (lang.key === "php" && phpVersions.length > 0) {
      const active = phpVersions.find((p) => p.status === "active");
      if (active) return `v${active.version} (${phpVersions.length} installed)`;
      return `${phpVersions.length} versions`;
    }
    if (versions.length > 0) {
      const active = versions.find((v) => v.active);
      if (active) return `v${active.version} (${versions.length} installed)`;
      return `${versions.length} installed`;
    }
    const rt = runtimes.find((r) => r.name.toLowerCase().includes(lang.key));
    if (rt?.version) return `v${rt.version}`;
    return "Not installed";
  };

  const isInstalled = (lang: LanguageEntry): boolean => {
    if (lang.key === "php") return phpVersions.length > 0;
    const versions = installedVersions[lang.key] || [];
    if (versions.length > 0) return true;
    const rt = runtimes.find((r) => r.name.toLowerCase().includes(lang.key));
    return !!rt?.version;
  };

  const getInstalledPath = (lang: LanguageEntry): string => {
    return `/opt/homebrew/opt/${lang.brewPackage}`;
  };

  // Filter available versions to only show those not already installed
  const getUninstalledAvailable = (lang: LanguageEntry): string[] => {
    const available = availableVersions[lang.key] || [];
    const installed = installedVersions[lang.key] || [];
    const installedFormulae = new Set(installed.map((v) => v.formula));
    return available.filter((formula) => !installedFormulae.has(formula));
  };

  if (loading && Object.keys(installedVersions).length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 10,
        }}
      >
        <span className="spinner" /> Loading languages...
      </div>
    );
  }

  const renderInstalledVersions = (lang: LanguageEntry) => {
    const versions = installedVersions[lang.key] || [];
    const activePhp = phpVersions.find((p) => p.status === "active");

    // For PHP, merge phpVersions data with installedVersions
    const displayVersions: VersionInfo[] =
      lang.key === "php" && phpVersions.length > 0 && versions.length === 0
        ? phpVersions.map((p) => ({
            formula: p.brew_name || p.name,
            version: p.version,
            installed: true,
            active: p.status === "active",
            running: !!p.pid && p.pid !== "" && p.pid !== "0",
          }))
        : versions;

    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">Installed Versions</div>
          {lang.key === "php" && activePhp && (
            <span className="badge badge-running">Active: PHP {activePhp.version}</span>
          )}
          {lang.key !== "php" && displayVersions.some((v) => v.active) && (
            <span className="badge badge-running">
              Active: {displayVersions.find((v) => v.active)?.version}
            </span>
          )}
        </div>
        <div className="card-body">
          {displayVersions.length === 0 ? (
            <div className="info-banner">
              No {lang.label} versions installed. Use the panel below to install one.
            </div>
          ) : (
            <div className="svc-grid">
              {displayVersions.map((ver) => {
                const isSwitching = actionLoading === `switch-${ver.formula}`;
                const isStarting = actionLoading === `start-${ver.formula}`;
                const isStopping = actionLoading === `stop-${ver.formula}`;
                const isUninstalling = actionLoading === `uninstall-${ver.formula}`;
                const isConfirming = confirmUninstall === ver.formula;
                const busy = !!actionLoading;

                return (
                  <div key={ver.formula} className="svc-card">
                    <div className="svc-card-name">{ver.formula}</div>
                    <div className="svc-card-version">{ver.version}</div>
                    <div className="svc-card-status">
                      {ver.active && <span className="badge badge-running">Active</span>}
                      {ver.running && <span className="badge badge-running">Running</span>}
                      {!ver.active && !ver.running && (
                        <span className="badge badge-stopped">Stopped</span>
                      )}
                    </div>
                    <div className="btn-group" style={{ marginTop: 8 }}>
                      {ver.running ? (
                        <button
                          className="btn btn-xs btn-danger"
                          onClick={() => handleStop(ver.formula)}
                          disabled={busy}
                        >
                          {isStopping ? <span className="spinner" /> : "Stop"}
                        </button>
                      ) : (
                        <button
                          className="btn btn-xs btn-success"
                          onClick={() => handleStart(ver.formula)}
                          disabled={busy}
                        >
                          {isStarting ? <span className="spinner" /> : "Start"}
                        </button>
                      )}
                      {!ver.active && (
                        <button
                          className="btn btn-xs btn-primary"
                          onClick={() => handleSwitch(lang, ver.formula)}
                          disabled={busy}
                        >
                          {isSwitching ? <span className="spinner" /> : "Switch"}
                        </button>
                      )}
                      <button
                        className={`btn btn-xs ${isConfirming ? "btn-danger" : "btn-sm"}`}
                        onClick={() => handleUninstall(ver.formula)}
                        disabled={busy && !isConfirming}
                      >
                        {isUninstalling ? (
                          <span className="spinner" />
                        ) : isConfirming ? (
                          "Confirm Uninstall"
                        ) : (
                          "Uninstall"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAvailableVersions = (lang: LanguageEntry) => {
    const uninstalled = getUninstalledAvailable(lang);

    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">Install New Version</div>
        </div>
        <div className="card-body">
          {uninstalled.length === 0 ? (
            <div className="info-banner">
              All available {lang.label} versions are already installed, or none are available via
              Homebrew.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Formula</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {uninstalled.map((formula) => {
                  const isInstalling = installLoading === formula;
                  return (
                    <tr key={formula}>
                      <td>{formula}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-xs btn-primary"
                          onClick={() => handleInstall(formula)}
                          disabled={!!installLoading}
                        >
                          {isInstalling ? <span className="spinner" /> : "Install"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const loadConfigPaths = async (lang: LanguageEntry) => {
    try {
      const paths = await invoke<[string, string][]>("get_config_paths", { service: lang.brewPackage });
      setConfigPaths(paths);
      if (paths.length > 0) {
        setSelectedConfig(paths[0][1]);
        loadConfigContent(paths[0][1]);
      }
    } catch { setConfigPaths([]); toast("Failed to load config paths", "error"); }
  };

  const loadConfigContent = async (path: string) => {
    setConfigLoading(true);
    try {
      const result = await invoke<CmdResult>("read_config_file", { path });
      setConfigContent(result.success ? result.output : result.error || "");
      setConfigDirty(false);
    } catch { setConfigContent(""); toast("Failed to load config file", "error"); }
    setConfigLoading(false);
  };

  const saveConfig = async () => {
    if (!selectedConfig) return;
    setConfigSaving(true);
    try {
      await invoke<CmdResult>("write_config_file", { path: selectedConfig, content: configContent });
      setConfigDirty(false);
    } catch { toast("Failed to save config", "error"); }
    setConfigSaving(false);
  };

  const renderConfiguration = (lang: LanguageEntry) => {
    const versions = installedVersions[lang.key] || [];
    const activeVersion = versions.find((v) => v.active);
    const activePhp =
      lang.key === "php" ? phpVersions.find((p) => p.status === "active") : undefined;

    const activeName = activePhp
      ? `PHP ${activePhp.version}`
      : activeVersion
        ? activeVersion.version
        : "None";
    const activeFormula = activePhp
      ? activePhp.brew_name || activePhp.name
      : activeVersion
        ? activeVersion.formula
        : "—";

    return (
      <>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Configuration</div>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-field">
                <div className="detail-field-label">Active Version</div>
                <div className="detail-field-value">{activeName}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Package Name</div>
                <div className="detail-field-value">{activeFormula}</div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Install Path</div>
                <div className="detail-field-value">
                  <code>{getInstalledPath(lang)}</code>
                </div>
              </div>
              <div className="detail-field">
                <div className="detail-field-label">Total Installed</div>
                <div className="detail-field-value">
                  {lang.key === "php"
                    ? phpVersions.length || versions.length
                    : versions.length}{" "}
                  version(s)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Config File Editor */}
        {(lang.key === "php" || lang.key === "mysql" || lang.key === "redis") && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                Edit Config File
                {configDirty && <span style={{ color: "var(--yellow)", marginLeft: 8, fontSize: 11 }}>(unsaved)</span>}
              </div>
              <div className="btn-group">
                {configPaths.length === 0 ? (
                  <button className="btn btn-sm" onClick={() => loadConfigPaths(lang)}>Load Config Files</button>
                ) : (
                  <>
                    <select
                      className="form-select"
                      style={{ width: "auto", fontSize: 11, padding: "3px 8px" }}
                      value={selectedConfig}
                      onChange={(e) => { setSelectedConfig(e.target.value); loadConfigContent(e.target.value); }}
                    >
                      {configPaths.map(([label, path]) => (
                        <option key={path} value={path}>{label}</option>
                      ))}
                    </select>
                    <button className="btn btn-sm btn-primary" onClick={saveConfig} disabled={configSaving || !configDirty}>
                      {configSaving ? <span className="spinner" /> : "Save"}
                    </button>
                  </>
                )}
              </div>
            </div>
            {configPaths.length > 0 && (
              <div className="card-body" style={{ padding: 0 }}>
                {configLoading ? (
                  <div style={{ padding: 20, textAlign: "center" }}><span className="spinner" /> Loading...</div>
                ) : (
                  <textarea
                    className="config-editor"
                    value={configContent}
                    onChange={(e) => { setConfigContent(e.target.value); setConfigDirty(true); }}
                    style={{ borderRadius: 0, border: "none", minHeight: 300 }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="master-detail">
      <div className="master-list">
        <div className="master-list-header">
          <div className="master-list-title">Languages</div>
          <button className="btn btn-sm" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" /> : "Refresh"}
          </button>
        </div>
        <div className="master-list-items">
          {LANGUAGES.map((lang) => (
            <div
              key={lang.key}
              className={`master-list-item${selected === lang.key ? " active" : ""}`}
              onClick={() => {
                setSelected(lang.key);
                setConfirmUninstall("");
                setError("");
              }}
            >
              <div className="master-list-item-info">
                <div className="master-list-item-name">
                  <span style={{ marginRight: 8 }}>{lang.icon}</span>
                  {lang.label}
                </div>
                <div className="master-list-item-sub">
                  <span
                    className={`status-dot ${isInstalled(lang) ? "running" : "stopped"}`}
                  />
                  {getSubtitle(lang)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="master-detail-content">
        {error && (
          <div className="warning-banner" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}
        {renderInstalledVersions(selectedLang)}
        {renderAvailableVersions(selectedLang)}
        {renderConfiguration(selectedLang)}
      </div>
    </div>
  );
}
