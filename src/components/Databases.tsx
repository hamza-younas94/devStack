import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

interface VersionInfo {
  formula: string;
  version: string;
  installed: boolean;
  active: boolean;
  running: boolean;
}

type DbEngine = "mysql" | "mariadb" | "postgres" | "mongodb" | "redis" | "memcached";
type DetailTab = "versions" | "databases" | "configuration" | "tools";

interface EngineConfig {
  id: DbEngine;
  name: string;
  brewSearch: string;
  port: number;
  supportsDbList: boolean;
  systemDbs: string[];
  connectionInfo: string;
  configFileName: string;
}

interface GuiTool {
  name: string;
  url: string;
  description: string;
  engines: DbEngine[];
}

const guiTools: GuiTool[] = [
  {
    name: "phpMyAdmin",
    url: "http://localhost:8080",
    description: "Web-based MySQL/MariaDB administration",
    engines: ["mysql", "mariadb"],
  },
  {
    name: "Adminer",
    url: "http://localhost:8081",
    description: "Lightweight database management (all SQL engines)",
    engines: ["mysql", "mariadb", "postgres"],
  },
  {
    name: "pgAdmin",
    url: "http://localhost:5050",
    description: "PostgreSQL administration and development platform",
    engines: ["postgres"],
  },
  {
    name: "Redis Commander",
    url: "http://localhost:8082",
    description: "Web-based Redis management tool",
    engines: ["redis"],
  },
];

const engines: EngineConfig[] = [
  {
    id: "mysql",
    name: "MySQL",
    brewSearch: "mysql",
    port: 3306,
    supportsDbList: true,
    systemDbs: ["information_schema", "mysql", "performance_schema", "sys"],
    connectionInfo: "mysql -u root -h 127.0.0.1 -P 3306",
    configFileName: "my.cnf",
  },
  {
    id: "mariadb",
    name: "MariaDB",
    brewSearch: "mariadb",
    port: 3306,
    supportsDbList: true,
    systemDbs: ["information_schema", "mysql", "performance_schema", "sys"],
    connectionInfo: "mariadb -u root -h 127.0.0.1 -P 3306",
    configFileName: "my.cnf",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    brewSearch: "postgresql",
    port: 5432,
    supportsDbList: true,
    systemDbs: ["postgres", "template0", "template1"],
    connectionInfo: "psql -h 127.0.0.1 -p 5432 -U postgres",
    configFileName: "postgresql.conf",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    brewSearch: "mongodb-community",
    port: 27017,
    supportsDbList: true,
    systemDbs: ["admin", "config", "local"],
    connectionInfo: "mongosh --host 127.0.0.1 --port 27017",
    configFileName: "mongod.conf",
  },
  {
    id: "redis",
    name: "Redis",
    brewSearch: "redis",
    port: 6379,
    supportsDbList: false,
    systemDbs: [],
    connectionInfo: "redis-cli -h 127.0.0.1 -p 6379",
    configFileName: "redis.conf",
  },
  {
    id: "memcached",
    name: "Memcached",
    brewSearch: "memcached",
    port: 11211,
    supportsDbList: false,
    systemDbs: [],
    connectionInfo: "telnet 127.0.0.1 11211",
    configFileName: "memcached.conf",
  },
];

function backendDbType(engine: EngineConfig): string {
  if (engine.id === "mariadb") return "mysql";
  return engine.id;
}

export default function Databases() {
  const [selected, setSelected] = useState<DbEngine>("mysql");
  const [activeTab, setActiveTab] = useState<DetailTab>("versions");
  const [installedVersions, setInstalledVersions] = useState<VersionInfo[]>([]);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [installingFormula, setInstallingFormula] = useState("");
  const [uninstallingFormula, setUninstallingFormula] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [error, setError] = useState("");
  const [showUninstallConfirm, setShowUninstallConfirm] = useState("");

  // Config editor state
  const [configPath, setConfigPath] = useState("");
  const [configContent, setConfigContent] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);

  // Import/Export state
  const [importPath, setImportPath] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [importExportLoading, setImportExportLoading] = useState("");
  const [importExportDb, setImportExportDb] = useState("");

  const engine = engines.find((e) => e.id === selected)!;
  const installedFormulae = new Set(installedVersions.map((v) => v.formula));

  const fetchInstalledVersions = useCallback(async (eng: EngineConfig) => {
    setLoadingVersions(true);
    try {
      const versions = await invoke<VersionInfo[]>("get_installed_versions", {
        package: eng.brewSearch,
      });
      setInstalledVersions(versions);
    } catch (err) {
      setInstalledVersions([]);
      setError(String(err));
    }
    setLoadingVersions(false);
  }, []);

  const fetchAvailableVersions = useCallback(async (eng: EngineConfig) => {
    setLoadingAvailable(true);
    try {
      const versions = await invoke<string[]>("get_available_versions", {
        package: eng.brewSearch,
      });
      setAvailableVersions(versions);
    } catch (err) {
      setAvailableVersions([]);
    }
    setLoadingAvailable(false);
  }, []);

  const listDbs = useCallback(async (eng: EngineConfig) => {
    if (!eng.supportsDbList) return;
    setLoadingDbs(true);
    setError("");
    try {
      const result = await invoke<CmdResult>("list_databases", {
        dbType: backendDbType(eng),
      });
      if (result.success) {
        const lines = result.output
          .split("\n")
          .map((l) => l.replace(/\|/g, "").trim())
          .filter(
            (l) =>
              l &&
              !l.startsWith("+") &&
              !l.startsWith("Database") &&
              !l.startsWith("---") &&
              !l.startsWith("Name")
          );
        setDatabases(lines.filter(Boolean));
      } else {
        setError(result.error || "Failed to list databases. Is the service running?");
        setDatabases([]);
      }
    } catch (err) {
      setError(String(err));
      setDatabases([]);
    }
    setLoadingDbs(false);
  }, []);

  const loadConfigFile = useCallback(async (eng: EngineConfig) => {
    setConfigLoading(true);
    setConfigContent("");
    setConfigPath("");
    setConfigDirty(false);
    setError("");
    try {
      const paths = await invoke<[string, string][]>("get_config_paths", {
        service: backendDbType(eng),
      });
      const match = paths.find(([name]) => name === eng.configFileName);
      const path = match ? match[1] : (paths[0]?.[1] || "");
      if (path) {
        setConfigPath(path);
        const result = await invoke<CmdResult>("read_config_file", { path });
        if (result.success) {
          setConfigContent(result.output);
        } else {
          setError(result.error || "Failed to read config file");
        }
      } else {
        setError("No config file path found for " + eng.name);
      }
    } catch (err) {
      setError(String(err));
    }
    setConfigLoading(false);
  }, []);

  const saveConfigFile = async () => {
    if (!configPath) return;
    setConfigSaving(true);
    setError("");
    try {
      const result = await invoke<CmdResult>("write_config_file", {
        path: configPath,
        content: configContent,
      });
      if (result.success) {
        setConfigDirty(false);
      } else {
        setError(result.error || "Failed to save config file");
      }
    } catch (err) {
      setError(String(err));
    }
    setConfigSaving(false);
  };

  const handleImportDb = async (dbName: string) => {
    if (!importPath.trim()) {
      setError("Please enter a file path for import");
      return;
    }
    setImportExportLoading(`import-${dbName}`);
    setError("");
    try {
      const result = await invoke<CmdResult>("import_database", {
        dbType: backendDbType(engine),
        name: dbName,
        filePath: importPath.trim(),
      });
      if (result.success) {
        setImportPath("");
        setImportExportDb("");
      } else {
        setError(result.error || "Failed to import database");
      }
    } catch (err) {
      setError(String(err));
    }
    setImportExportLoading("");
  };

  const handleExportDb = async (dbName: string) => {
    if (!exportPath.trim()) {
      setError("Please enter a file path for export");
      return;
    }
    setImportExportLoading(`export-${dbName}`);
    setError("");
    try {
      const result = await invoke<CmdResult>("export_database", {
        dbType: backendDbType(engine),
        name: dbName,
        filePath: exportPath.trim(),
      });
      if (result.success) {
        setExportPath("");
        setImportExportDb("");
      } else {
        setError(result.error || "Failed to export database");
      }
    } catch (err) {
      setError(String(err));
    }
    setImportExportLoading("");
  };

  const openGuiTool = async (url: string) => {
    try {
      await invoke("open_in_browser", { url });
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    setDatabases([]);
    setInstalledVersions([]);
    setAvailableVersions([]);
    setError("");
    setShowCreate(false);
    setNewDbName("");
    setShowUninstallConfirm("");
    setConfigContent("");
    setConfigPath("");
    setConfigDirty(false);
    setImportExportDb("");
    setImportPath("");
    setExportPath("");

    fetchInstalledVersions(engine);
    fetchAvailableVersions(engine);
    if (engine.supportsDbList) {
      listDbs(engine);
    }
    if (activeTab === "configuration") {
      loadConfigFile(engine);
    }
  }, [selected]);

  useEffect(() => {
    if (activeTab === "configuration" && !configContent && !configLoading) {
      loadConfigFile(engine);
    }
  }, [activeTab]);

  const handleStartVersion = async (formula: string) => {
    setActionLoading(`start-${formula}`);
    setError("");
    try {
      const result = await invoke<CmdResult>("start_package", { formula });
      if (!result.success) {
        setError(result.error || `Failed to start ${formula}`);
      }
      await fetchInstalledVersions(engine);
    } catch (err) {
      setError(String(err));
    }
    setActionLoading("");
  };

  const handleStopVersion = async (formula: string) => {
    setActionLoading(`stop-${formula}`);
    setError("");
    try {
      const result = await invoke<CmdResult>("stop_package", { formula });
      if (!result.success) {
        setError(result.error || `Failed to stop ${formula}`);
      }
      await fetchInstalledVersions(engine);
    } catch (err) {
      setError(String(err));
    }
    setActionLoading("");
  };

  const handleRestartVersion = async (formula: string) => {
    setActionLoading(`restart-${formula}`);
    setError("");
    try {
      const result = await invoke<CmdResult>("restart_service", { name: formula });
      if (!result.success) {
        setError(result.error || `Failed to restart ${formula}`);
      }
      await fetchInstalledVersions(engine);
    } catch (err) {
      setError(String(err));
    }
    setActionLoading("");
  };

  const handleInstall = async (formula: string) => {
    setInstallingFormula(formula);
    setError("");
    try {
      const result = await invoke<CmdResult>("install_package", { formula });
      if (!result.success) {
        setError(result.error || `Failed to install ${formula}`);
      }
      await fetchInstalledVersions(engine);
      await fetchAvailableVersions(engine);
    } catch (err) {
      setError(String(err));
    }
    setInstallingFormula("");
  };

  const handleUninstall = async (formula: string) => {
    setUninstallingFormula(formula);
    setShowUninstallConfirm("");
    setError("");
    try {
      const result = await invoke<CmdResult>("uninstall_package", { formula });
      if (!result.success) {
        setError(result.error || `Failed to uninstall ${formula}`);
      }
      await fetchInstalledVersions(engine);
      await fetchAvailableVersions(engine);
    } catch (err) {
      setError(String(err));
    }
    setUninstallingFormula("");
  };

  const createDb = async () => {
    if (!newDbName.trim()) return;
    setLoadingDbs(true);
    try {
      const result = await invoke<CmdResult>("create_database", {
        dbType: backendDbType(engine),
        name: newDbName.trim(),
      });
      if (result.success) {
        setNewDbName("");
        setShowCreate(false);
        setError("");
        await listDbs(engine);
      } else {
        setError(result.error || "Failed to create database");
      }
    } catch (err) {
      setError(String(err));
    }
    setLoadingDbs(false);
  };

  const dropDb = async (name: string) => {
    if (!confirm(`Drop database "${name}"? This cannot be undone.`)) return;
    setLoadingDbs(true);
    try {
      const result = await invoke<CmdResult>("drop_database", {
        dbType: backendDbType(engine),
        name,
      });
      if (!result.success) {
        setError(result.error || "Failed to drop database");
      }
      await listDbs(engine);
    } catch (err) {
      setError(String(err));
    }
    setLoadingDbs(false);
  };

  const isSystemDb = (name: string): boolean => engine.systemDbs.includes(name);

  const relevantTools = guiTools.filter((t) => t.engines.includes(engine.id));

  const renderVersionsTab = () => (
    <>
      {/* Installed Versions */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Installed Versions</span>
          <button
            className="btn btn-sm"
            onClick={() => fetchInstalledVersions(engine)}
            disabled={loadingVersions}
          >
            {loadingVersions ? <span className="spinner" /> : null}
            Refresh
          </button>
        </div>
        <div className="card-body">
          {loadingVersions && installedVersions.length === 0 ? (
            <div className="empty-state">
              <span className="spinner" /> Loading...
            </div>
          ) : installedVersions.length === 0 ? (
            <div className="empty-state">No versions installed</div>
          ) : (
            <div className="svc-grid">
              {installedVersions.map((v) => (
                <div className="svc-card" key={v.formula}>
                  <div className="svc-card-name">{v.formula}</div>
                  <div className="svc-card-version">{v.version}</div>
                  <div className="svc-card-status">
                    <span className={`badge ${v.running ? "badge-running" : "badge-stopped"}`}>
                      {v.running ? "Running" : "Stopped"}
                    </span>
                  </div>
                  <div className="btn-group" style={{ marginTop: 8 }}>
                    {actionLoading === `start-${v.formula}` ||
                    actionLoading === `stop-${v.formula}` ||
                    actionLoading === `restart-${v.formula}` ? (
                      <span className="spinner" />
                    ) : (
                      <>
                        {v.running ? (
                          <button
                            className="btn btn-xs btn-danger"
                            onClick={() => handleStopVersion(v.formula)}
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            className="btn btn-xs btn-success"
                            onClick={() => handleStartVersion(v.formula)}
                          >
                            Start
                          </button>
                        )}
                        <button
                          className="btn btn-xs"
                          onClick={() => handleRestartVersion(v.formula)}
                        >
                          Restart
                        </button>
                      </>
                    )}
                    {uninstallingFormula === v.formula ? (
                      <span className="spinner" />
                    ) : showUninstallConfirm === v.formula ? (
                      <>
                        <button
                          className="btn btn-xs btn-danger"
                          onClick={() => handleUninstall(v.formula)}
                        >
                          Confirm
                        </button>
                        <button
                          className="btn btn-xs"
                          onClick={() => setShowUninstallConfirm("")}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-xs btn-danger"
                        onClick={() => setShowUninstallConfirm(v.formula)}
                        style={{ marginLeft: 4 }}
                      >
                        Uninstall
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Install New Version */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Install New Version</span>
          <button
            className="btn btn-sm"
            onClick={() => fetchAvailableVersions(engine)}
            disabled={loadingAvailable}
          >
            {loadingAvailable ? <span className="spinner" /> : null}
            Refresh
          </button>
        </div>
        <div className="card-body">
          {loadingAvailable && availableVersions.length === 0 ? (
            <div className="empty-state">
              <span className="spinner" /> Loading available versions...
            </div>
          ) : availableVersions.length === 0 ? (
            <div className="empty-state">No versions available</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Formula</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {availableVersions.map((formula) => {
                  const isInstalled = installedFormulae.has(formula);
                  const isInstalling = installingFormula === formula;
                  return (
                    <tr key={formula}>
                      <td style={{ fontWeight: 500 }}>{formula}</td>
                      <td>
                        {isInstalled && (
                          <span className="badge badge-installed">
                            &#10003; Installed
                          </span>
                        )}
                      </td>
                      <td>
                        {isInstalling ? (
                          <span className="spinner" />
                        ) : isInstalled ? null : (
                          <button
                            className="btn btn-xs btn-primary"
                            onClick={() => handleInstall(formula)}
                            disabled={!!installingFormula}
                          >
                            Install
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );

  const renderDatabasesTab = () => (
    <>
      {engine.supportsDbList ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-header">
            <span className="card-title">Database Management</span>
            <div className="btn-group">
              <button
                className="btn btn-sm"
                onClick={() => listDbs(engine)}
                disabled={loadingDbs}
              >
                {loadingDbs ? <span className="spinner" /> : null}
                Refresh
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setShowCreate(true);
                  setNewDbName("");
                }}
              >
                + New
              </button>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Database</th>
                <th style={{ width: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {databases.length === 0 && !loadingDbs && (
                <tr>
                  <td colSpan={2}>
                    <div className="empty-state">
                      No databases found. Is the service running?
                    </div>
                  </td>
                </tr>
              )}
              {databases.map((db) => (
                <tr key={db}>
                  <td style={{ fontWeight: 600 }}>
                    {db}
                    {isSystemDb(db) && (
                      <span className="badge" style={{ marginLeft: 8, fontSize: 10 }}>
                        system
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="btn-group">
                      {!isSystemDb(db) && (
                        <button
                          className="btn btn-xs btn-danger"
                          onClick={() => dropDb(db)}
                          disabled={loadingDbs}
                        >
                          Drop
                        </button>
                      )}
                      {importExportDb === db ? (
                        <>
                          {/* Import row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              className="form-input"
                              style={{ fontSize: 11, padding: "2px 6px", width: 140 }}
                              placeholder="/path/to/file.sql"
                              value={importPath}
                              onChange={(e) => setImportPath(e.target.value)}
                            />
                            {importExportLoading === `import-${db}` ? (
                              <span className="spinner" />
                            ) : (
                              <button
                                className="btn btn-xs btn-primary"
                                onClick={() => handleImportDb(db)}
                                disabled={!importPath.trim()}
                              >
                                Import
                              </button>
                            )}
                          </div>
                          {/* Export row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              className="form-input"
                              style={{ fontSize: 11, padding: "2px 6px", width: 140 }}
                              placeholder="/path/to/export.sql"
                              value={exportPath}
                              onChange={(e) => setExportPath(e.target.value)}
                            />
                            {importExportLoading === `export-${db}` ? (
                              <span className="spinner" />
                            ) : (
                              <button
                                className="btn btn-xs btn-success"
                                onClick={() => handleExportDb(db)}
                                disabled={!exportPath.trim()}
                              >
                                Export
                              </button>
                            )}
                          </div>
                          <button
                            className="btn btn-xs"
                            onClick={() => {
                              setImportExportDb("");
                              setImportPath("");
                              setExportPath("");
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-xs"
                          onClick={() => {
                            setImportExportDb(db);
                            setImportPath("");
                            setExportPath("");
                          }}
                        >
                          Import/Export
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              {engine.name} does not support database listing from this interface.
            </div>
          </div>
        </div>
      )}

      {/* Connection Info */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Connection Info</span>
        </div>
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Host</label>
            <span style={{ fontSize: 13 }}>127.0.0.1</span>
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Port</label>
            <span style={{ fontSize: 13 }}>{engine.port}</span>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">CLI</label>
            <code
              style={{
                display: "block",
                padding: "8px 12px",
                borderRadius: 6,
                background: "var(--bg-tertiary, rgba(0,0,0,0.1))",
                fontSize: 12,
              }}
            >
              {engine.connectionInfo}
            </code>
          </div>
        </div>
      </div>
    </>
  );

  const renderConfigurationTab = () => (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Configuration — {engine.configFileName}</span>
        <div className="btn-group">
          <button
            className="btn btn-sm"
            onClick={() => loadConfigFile(engine)}
            disabled={configLoading}
          >
            {configLoading ? <span className="spinner" /> : null}
            Reload
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={saveConfigFile}
            disabled={configSaving || !configDirty || !configPath}
          >
            {configSaving ? <span className="spinner" /> : null}
            Save
          </button>
        </div>
      </div>
      <div className="card-body">
        {configLoading ? (
          <div className="empty-state">
            <span className="spinner" /> Loading configuration...
          </div>
        ) : !configPath ? (
          <div className="empty-state">
            No configuration file found for {engine.name}.
          </div>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">File Path</label>
              <code
                style={{
                  display: "block",
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "var(--bg-tertiary, rgba(0,0,0,0.1))",
                  fontSize: 11,
                  wordBreak: "break-all",
                }}
              >
                {configPath}
              </code>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Contents
                {configDirty && (
                  <span style={{ color: "var(--color-warning, #f59e0b)", marginLeft: 8, fontSize: 11 }}>
                    (unsaved changes)
                  </span>
                )}
              </label>
              <textarea
                className="form-input"
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  lineHeight: 1.5,
                  minHeight: 360,
                  resize: "vertical",
                  whiteSpace: "pre",
                  overflowWrap: "normal",
                  overflowX: "auto",
                }}
                value={configContent}
                onChange={(e) => {
                  setConfigContent(e.target.value);
                  setConfigDirty(true);
                }}
                spellCheck={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderToolsTab = () => (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title">GUI Tools for {engine.name}</span>
        </div>
        <div className="card-body">
          {relevantTools.length === 0 ? (
            <div className="empty-state">
              No GUI tools available for {engine.name}.
            </div>
          ) : (
            <div className="svc-grid">
              {relevantTools.map((tool) => (
                <div className="svc-card" key={tool.name}>
                  <div className="svc-card-name">{tool.name}</div>
                  <div className="svc-card-version" style={{ fontSize: 11, opacity: 0.7 }}>
                    {tool.description}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>{tool.url}</div>
                  <button
                    className="btn btn-xs btn-primary"
                    style={{ marginTop: 8 }}
                    onClick={() => openGuiTool(tool.url)}
                  >
                    Open in Browser
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Tools overview */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Database Tools</span>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>Tool</th>
                <th>URL</th>
                <th>Engines</th>
                <th style={{ width: 100 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {guiTools.map((tool) => (
                <tr key={tool.name}>
                  <td style={{ fontWeight: 500 }}>{tool.name}</td>
                  <td style={{ fontSize: 12 }}>{tool.url}</td>
                  <td style={{ fontSize: 12 }}>
                    {tool.engines
                      .map((eid) => engines.find((e) => e.id === eid)?.name || eid)
                      .join(", ")}
                  </td>
                  <td>
                    <button
                      className="btn btn-xs btn-primary"
                      onClick={() => openGuiTool(tool.url)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="master-detail">
        {/* Left Panel */}
        <div className="master-list">
          <div className="master-list-header">
            <span className="master-list-title">Engines</span>
          </div>
          <div className="master-list-items">
            {engines.map((eng) => (
              <div
                key={eng.id}
                className={`master-list-item ${selected === eng.id ? "active" : ""}`}
                onClick={() => setSelected(eng.id)}
              >
                <div className="master-list-item-info">
                  <div className="master-list-item-name">{eng.name}</div>
                  <div className="master-list-item-sub">Port {eng.port}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="master-detail-content">
          {error && <div className="warning-banner">{error}</div>}

          {/* Tab Bar */}
          <div className="btn-group" style={{ marginBottom: 12 }}>
            {(
              [
                { id: "versions", label: "Versions" },
                { id: "databases", label: "Databases" },
                { id: "configuration", label: "Configuration" },
                { id: "tools", label: "Tools" },
              ] as { id: DetailTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                className={`btn btn-sm ${activeTab === tab.id ? "btn-primary" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "versions" && renderVersionsTab()}
          {activeTab === "databases" && renderDatabasesTab()}
          {activeTab === "configuration" && renderConfigurationTab()}
          {activeTab === "tools" && renderToolsTab()}
        </div>
      </div>

      {/* Create Database Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Create Database</div>

            <div className="form-group">
              <label className="form-label">Engine</label>
              <span className="badge">{engine.name}</span>
            </div>

            <div className="form-group">
              <label className="form-label">Database Name</label>
              <input
                className="form-input"
                placeholder="my_database"
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && createDb()}
              />
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={createDb}
                disabled={loadingDbs || !newDbName.trim()}
              >
                {loadingDbs ? <span className="spinner" /> : null}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
