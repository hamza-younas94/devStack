import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

interface PackageInfo {
  name: string;
  version: string;
  status: string;
  pid: string;
  category: string;
}

export default function Search() {
  const { toast } = useToast();
  const [meilisearch, setMeilisearch] = useState<PackageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const pkgs = await invoke<PackageInfo[]>("get_packages");
      const ms = pkgs.find((p) => p.name === "meilisearch");
      setMeilisearch(ms ?? null);
    } catch {
      toast("Failed to refresh Meilisearch status", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (action: string) => {
    setActionLoading(action);
    try {
      await invoke<CmdResult>("toggle_service", { name: "meilisearch", action });
      await refresh();
      toast(`Meilisearch ${action === "start" ? "started" : "stopped"} successfully`, "success");
    } catch {
      toast(`Failed to ${action} Meilisearch`, "error");
    }
    setActionLoading("");
  };

  const install = async () => {
    setActionLoading("install");
    try {
      await invoke<CmdResult>("install_package", { formula: "meilisearch" });
      await refresh();
      toast("Meilisearch installed successfully", "success");
    } catch {
      toast("Failed to install Meilisearch", "error");
    }
    setActionLoading("");
  };

  const isRunning = meilisearch?.status === "Running";
  const isInstalled = meilisearch && meilisearch.status !== "Not Installed";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Search</h1>
          <p className="page-subtitle">Full-text search engine management</p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : null} Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Meilisearch */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Meilisearch</div>
            <span className={`badge ${isRunning ? "badge-running" : isInstalled ? "badge-stopped" : ""}`}>
              {meilisearch?.status || "Not Installed"}
            </span>
          </div>
          <div className="card-body">
            {!isInstalled ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Meilisearch not installed</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Lightning-fast, typo-tolerant search engine. A great alternative to Algolia.
                  </div>
                </div>
                <button className="btn btn-primary" onClick={install} disabled={!!actionLoading}>
                  {actionLoading === "install" ? <span className="spinner" /> : null} Install
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
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Meilisearch</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                      {meilisearch?.version || "—"} · http://localhost:7700
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
                          onClick={() => invoke("open_in_browser", { url: "http://localhost:7700" })}
                        >
                          Open Dashboard
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
              <div><span style={{ color: "var(--text)" }}>Host:</span> http://localhost:7700</div>
              <div><span style={{ color: "var(--text)" }}>Master Key:</span> (none - development mode)</div>
              <div><span style={{ color: "var(--text)" }}>Data Dir:</span> /opt/homebrew/var/meilisearch</div>
              <div><span style={{ color: "var(--text)" }}>Max Index Size:</span> 100 GiB</div>
            </div>
          </div>
        </div>

        {/* Integration */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Integration</div>
          </div>
          <div className="card-body">
            <div className="log-viewer" style={{ maxHeight: 180 }}>
{`# Laravel Scout
SCOUT_DRIVER=meilisearch
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_KEY=

# JavaScript SDK
import { MeiliSearch } from 'meilisearch'
const client = new MeiliSearch({ host: 'http://localhost:7700' })

# PHP SDK
$client = new \\MeiliSearch\\Client('http://localhost:7700');`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
