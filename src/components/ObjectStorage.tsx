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

export default function ObjectStorage() {
  const { toast } = useToast();
  const [minio, setMinio] = useState<PackageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const pkgs = await invoke<PackageInfo[]>("get_packages");
      const m = pkgs.find((p) => p.name === "minio");
      setMinio(m ?? null);
    } catch {
      toast("Failed to fetch MinIO status", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (action: string) => {
    setActionLoading(action);
    try {
      await invoke<CmdResult>("toggle_service", { name: "minio", action });
      await refresh();
      toast(`MinIO ${action === "start" ? "started" : "stopped"} successfully`, "success");
    } catch {
      toast(`Failed to ${action} MinIO`, "error");
    }
    setActionLoading("");
  };

  const install = async () => {
    setActionLoading("install");
    try {
      await invoke<CmdResult>("install_package", { formula: "minio" });
      await refresh();
      toast("MinIO installed successfully", "success");
    } catch {
      toast("Failed to install MinIO", "error");
    }
    setActionLoading("");
  };

  const isRunning = minio?.status === "Running";
  const isInstalled = minio && minio.status !== "Not Installed";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Object Storage</h1>
          <p className="page-subtitle">S3-compatible local storage with MinIO</p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : null} Refresh
        </button>
      </div>

      <div className="page-body">
        {/* MinIO Status */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">MinIO</div>
            <span className={`badge ${isRunning ? "badge-running" : isInstalled ? "badge-stopped" : ""}`}>
              {minio?.status || "Not Installed"}
            </span>
          </div>
          <div className="card-body">
            {!isInstalled ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>MinIO not installed</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    High-performance, S3-compatible object storage for local development.
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
                    <div style={{ fontWeight: 600, fontSize: 15 }}>MinIO</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                      {minio?.version || "—"} · API: :9000 · Console: :9001
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
                          onClick={() => invoke("open_in_browser", { url: "http://localhost:9001" })}
                        >
                          Open Console
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
              <div><span style={{ color: "var(--text)" }}>API Endpoint:</span> http://localhost:9000</div>
              <div><span style={{ color: "var(--text)" }}>Console:</span> http://localhost:9001</div>
              <div><span style={{ color: "var(--text)" }}>Root User:</span> minioadmin</div>
              <div><span style={{ color: "var(--text)" }}>Root Password:</span> minioadmin</div>
              <div><span style={{ color: "var(--text)" }}>Data Dir:</span> /opt/homebrew/var/minio</div>
            </div>
          </div>
        </div>

        {/* Env Vars */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Application Configuration</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
              Add these environment variables to use MinIO as your S3 backend:
            </div>
            <div className="log-viewer" style={{ maxHeight: 180 }}>
{`AWS_ENDPOINT=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_BUCKET=my-bucket
AWS_REGION=us-east-1
AWS_USE_PATH_STYLE_ENDPOINT=true

# Laravel (.env)
FILESYSTEM_DISK=s3
AWS_ENDPOINT=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
