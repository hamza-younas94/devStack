import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TroubleshootResult {
  name: string;
  status: string;
  detail: string;
}

function dotClass(status: string): string {
  switch (status.toLowerCase()) {
    case "ok":
      return "check-dot ok";
    case "warn":
      return "check-dot warn";
    case "error":
      return "check-dot error";
    default:
      return "check-dot";
  }
}

export default function Troubleshoot() {
  const [results, setResults] = useState<TroubleshootResult[]>([]);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    setExpanded(new Set());
    try {
      const checks = await invoke<TroubleshootResult[]>("run_troubleshoot");
      setResults(checks);
      setHasRun(true);
    } catch (e) {
      console.error("Troubleshoot failed:", e);
    }
    setRunning(false);
  }, []);

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const okCount = results.filter((r) => r.status === "ok").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Troubleshoot</h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={runDiagnostics}
          disabled={running}
        >
          {running ? <span className="spinner" /> : null} Run Diagnostics
        </button>
      </div>

      <div className="page-body">
        {!hasRun && !running && (
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}>
              Click "Run Diagnostics" to check your environment.
            </div>
          </div>
        )}

        {running && (
          <div className="card">
            <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 40 }}>
              <span className="spinner" /> Running diagnostics...
            </div>
          </div>
        )}

        {hasRun && !running && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 13 }}>
              <span style={{ color: "var(--green)" }}>{okCount} passed</span>
              {warnCount > 0 && (
                <span style={{ color: "var(--yellow, orange)" }}>{warnCount} warnings</span>
              )}
              {errorCount > 0 && (
                <span style={{ color: "var(--red, #e74c3c)" }}>{errorCount} errors</span>
              )}
            </div>

            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {results.map((check) => (
                  <div className="check-item" key={check.name}>
                    <div
                      className="check-item-header"
                      onClick={() => toggleExpand(check.name)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className={dotClass(check.status)} />
                      <div className="check-item-name">{check.name}</div>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)" }}>
                        {expanded.has(check.name) ? "▾" : "▸"}
                      </span>
                    </div>
                    {expanded.has(check.name) && (
                      <div className="check-item-detail">{check.detail}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
