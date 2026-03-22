import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";
import { ServiceStatus, DashboardData, CmdResult } from "../types";

interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}

export default function AI() {
  const [ollama, setOllama] = useState<ServiceStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState(false);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<DashboardData>("get_dashboard");
      const found = data.runtimes.find((r) => r.name.toLowerCase() === "ollama");
      setOllama(found ?? null);
      const m = await invoke<OllamaModel[]>("get_ollama_models");
      setModels(m);
    } catch {
      setOllama(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (action: "start" | "stop") => {
    setActionLoading(action);
    try {
      await invoke<CmdResult>("toggle_service", { name: "ollama", action });
      await refresh();
      toast(`Ollama ${action}ed`, "success");
    } catch (e) { toast(`Failed to ${action} Ollama`, "error"); }
    setActionLoading("");
  };

  const restart = async () => {
    setActionLoading("restart");
    try {
      await invoke<CmdResult>("restart_service", { name: "ollama" });
      await refresh();
      toast("Ollama restarted", "success");
    } catch { toast("Failed to restart Ollama", "error"); }
    setActionLoading("");
  };

  const pullModel = async () => {
    if (!pullName.trim()) return;
    setPulling(true);
    try {
      await invoke<CmdResult>("pull_ollama_model", { name: pullName.trim() });
      setPullName("");
      await refresh();
      toast("Model pulled successfully", "success");
    } catch { toast("Failed to pull model", "error"); }
    setPulling(false);
  };

  const deleteModel = async (name: string) => {
    if (!confirm(`Delete model "${name}"?`)) return;
    try {
      await invoke<CmdResult>("delete_ollama_model", { name });
      await refresh();
      toast("Model deleted", "success");
    } catch { toast("Failed to delete model", "error"); }
  };

  const isRunning = ollama?.status === "running";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI</h1>
          <p className="page-subtitle">Local AI model management with Ollama</p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : null} Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Ollama Status */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Ollama</div>
            <span className={`badge ${isRunning ? "badge-running" : ollama ? "badge-stopped" : ""}`}>
              {isRunning ? "Running" : ollama ? "Stopped" : "Not Installed"}
            </span>
          </div>
          <div className="card-body">
            {ollama ? (
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
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Ollama</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                      Version {ollama.version || "unknown"} · API: http://localhost:11434
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
                        <button className="btn btn-sm" onClick={restart}>Restart</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 20 }}>
                <div className="empty-state-text">Ollama not installed</div>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    toast("Installing Ollama...", "info");
                    try {
                      const r = await invoke<CmdResult>("install_package", { formula: "ollama" });
                      if (r.success) { toast("Ollama installed", "success"); await refresh(); }
                      else toast(r.error || "Install failed", "error");
                    } catch (e) { toast(`Install failed: ${e}`, "error"); }
                  }}
                >
                  Install Ollama
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pull Model */}
        {ollama && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Pull Model</div>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="e.g. llama3, mistral, codellama, gemma2..."
                  value={pullName}
                  onChange={(e) => setPullName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && pullModel()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={pullModel} disabled={pulling || !pullName.trim()}>
                  {pulling ? <span className="spinner" /> : null} Pull
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
                Popular: llama3, mistral, codellama, gemma2, phi3, qwen2, deepseek-coder
              </div>
            </div>
          </div>
        )}

        {/* Models List */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Installed Models</div>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {models.length} model{models.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {models.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                No models installed. Pull a model above to get started.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Size</th>
                    <th>Modified</th>
                    <th style={{ width: 80, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.name}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td style={{ color: "var(--text-dim)" }}>{m.size}</td>
                      <td style={{ color: "var(--text-dim)", fontSize: 12 }}>{m.modified}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-xs btn-danger" onClick={() => deleteModel(m.name)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">About</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.8 }}>
              <div><strong style={{ color: "var(--text)" }}>API Endpoint:</strong> http://localhost:11434</div>
              <div><strong style={{ color: "var(--text)" }}>OpenAI Compatible:</strong> http://localhost:11434/v1</div>
              <div><strong style={{ color: "var(--text)" }}>Models Directory:</strong> ~/.ollama/models</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
