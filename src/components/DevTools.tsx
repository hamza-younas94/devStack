import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";
import { CmdResult } from "../types";

interface DevTool {
  name: string;
  display_name: string;
  installed: boolean;
  version: string;
  category: string;
}

interface PhpExtension {
  name: string;
  enabled: boolean;
  version: string;
}

type Tab = "tools" | "php-extensions";

export default function DevTools() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("tools");
  const [tools, setTools] = useState<DevTool[]>([]);
  const [extensions, setExtensions] = useState<PhpExtension[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [extFilter, setExtFilter] = useState("");

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<DevTool[]>("get_dev_tools");
      setTools(result);
    } catch (e) {
      toast(String(e), "error");
    }
    setLoading(false);
  }, []);

  const fetchExtensions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<PhpExtension[]>("get_php_extensions");
      setExtensions(result);
    } catch (e) {
      toast(String(e), "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "tools") fetchTools();
    else if (activeTab === "php-extensions") fetchExtensions();
  }, [activeTab]);

  const handleInstallTool = async (name: string) => {
    setActionLoading(`install-${name}`);
    try {
      const result = await invoke<CmdResult>("install_dev_tool", { name });
      if (result.success) {
        toast(`${name} installed`, "success");
        await fetchTools();
      } else {
        toast(result.error || `Failed to install ${name}`, "error");
      }
    } catch (e) {
      toast(String(e), "error");
    }
    setActionLoading("");
  };

  const handleToggleExtension = async (ext: PhpExtension) => {
    setActionLoading(`ext-${ext.name}`);
    try {
      const result = await invoke<CmdResult>("toggle_php_extension", {
        name: ext.name,
        enable: !ext.enabled,
      });
      if (result.success) {
        toast(`${ext.name} ${ext.enabled ? "disabled" : "enabled"}. Restart PHP-FPM to apply.`, "success");
        await fetchExtensions();
      } else {
        toast(result.error || `Failed to toggle ${ext.name}`, "error");
      }
    } catch (e) {
      toast(String(e), "error");
    }
    setActionLoading("");
  };

  // Group tools by category
  const categories = tools.reduce<Record<string, DevTool[]>>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {});

  const filteredExtensions = extensions.filter(
    (ext) => !extFilter || ext.name.toLowerCase().includes(extFilter.toLowerCase())
  );

  return (
    <>
      {/* Tab Bar */}
      <div className="btn-group" style={{ marginBottom: 16 }}>
        {(
          [
            { id: "tools", label: "Package Managers & Tools" },
            { id: "php-extensions", label: "PHP Extensions" },
          ] as { id: Tab; label: string }[]
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

      {/* Tools Tab */}
      {activeTab === "tools" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-sm" onClick={fetchTools} disabled={loading}>
              {loading ? <span className="spinner" /> : null} Refresh
            </button>
          </div>

          {Object.entries(categories).map(([category, catTools]) => (
            <div className="card" key={category}>
              <div className="card-header">
                <span className="card-title">{category}</span>
              </div>
              <div className="card-body">
                <div className="svc-grid">
                  {catTools.map((tool) => (
                    <div className="svc-card" key={tool.name}>
                      <div className="svc-card-name">{tool.display_name}</div>
                      <div className="svc-card-version">
                        {tool.installed ? tool.version || "installed" : "Not installed"}
                      </div>
                      <div className="svc-card-status">
                        <span
                          className={`badge ${tool.installed ? "badge-running" : "badge-stopped"}`}
                        >
                          {tool.installed ? "Installed" : "Missing"}
                        </span>
                      </div>
                      {!tool.installed && (
                        <button
                          className="btn btn-xs btn-primary"
                          style={{ marginTop: 8 }}
                          onClick={() => handleInstallTool(tool.name)}
                          disabled={actionLoading === `install-${tool.name}`}
                        >
                          {actionLoading === `install-${tool.name}` ? (
                            <span className="spinner" />
                          ) : (
                            "Install"
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {tools.length === 0 && !loading && (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">No tools detected</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* PHP Extensions Tab */}
      {activeTab === "php-extensions" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <input
              className="form-input"
              style={{ width: 250, fontSize: 12 }}
              placeholder="Filter extensions..."
              value={extFilter}
              onChange={(e) => setExtFilter(e.target.value)}
            />
            <button className="btn btn-sm" onClick={fetchExtensions} disabled={loading}>
              {loading ? <span className="spinner" /> : null} Refresh
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Extension</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExtensions.map((ext) => (
                  <tr key={ext.name}>
                    <td style={{ fontWeight: 500, fontFamily: "monospace", fontSize: 12 }}>
                      {ext.name}
                    </td>
                    <td>
                      <span
                        className={`badge ${ext.enabled ? "badge-running" : "badge-stopped"}`}
                      >
                        {ext.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      {actionLoading === `ext-${ext.name}` ? (
                        <span className="spinner" />
                      ) : (
                        <button
                          className={`btn btn-xs ${ext.enabled ? "btn-danger" : "btn-success"}`}
                          onClick={() => handleToggleExtension(ext)}
                        >
                          {ext.enabled ? "Disable" : "Enable"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredExtensions.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      <div className="empty-state">
                        {loading ? "Loading..." : "No extensions found"}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
