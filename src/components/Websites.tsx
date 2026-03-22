import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

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

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

interface RedirectRule {
  from: string;
  to: string;
  code: number;
  enabled: boolean;
}

interface Requirements {
  nginx: boolean;
  php_fpm: boolean;
  mysql: boolean;
  postgres: boolean;
  redis: boolean;
  node: boolean;
  python: boolean;
  go_lang: boolean;
  dns: boolean;
  ssl_ca: boolean;
}

type Tab = "general" | "runtime" | "database" | "cors" | "logs" | "redirects" | "advanced";

type WebProtocol = "both" | "https" | "http";
type SslMethod = "devstack" | "custom";
type RewriteRule = "none" | "wordpress" | "laravel" | "symfony" | "drupal" | "magento" | "codeigniter";

const typeColors: Record<string, string> = {
  php: "badge-php",
  node: "badge-node",
  python: "badge-python",
  go: "badge-go",
  static: "badge-static",
  reverse_proxy: "badge-go",
};

const typeLabels: Record<string, string> = {
  php: "PHP",
  node: "Node.js",
  python: "Python",
  go: "Go",
  static: "Static",
  reverse_proxy: "Reverse Proxy",
};

const defaultForm = {
  name: "",
  site_type: "php",
  domain: "",
  root: "",
  php: "8.3",
  port: "",
  ssl: true,
  web_protocol: "both" as WebProtocol,
  ssl_method: "devstack" as SslMethod,
  rewrite_rule: "none" as RewriteRule,
  db_type: "",
  db_name: "",
  cors_enabled: false,
  cors_origin: "*",
  node_version: "",
  python_version: "",
  custom_nginx: "",
  template: "none",
};

const templates: { id: string; label: string; type: string; rewrite?: string }[] = [
  { id: "none", label: "Empty Project", type: "" },
  { id: "laravel", label: "Laravel", type: "php", rewrite: "laravel" },
  { id: "wordpress", label: "WordPress", type: "php", rewrite: "wordpress" },
  { id: "symfony", label: "Symfony", type: "php", rewrite: "symfony" },
  { id: "nextjs", label: "Next.js", type: "node" },
  { id: "express", label: "Express.js", type: "node" },
  { id: "django", label: "Django", type: "python" },
  { id: "static", label: "Static HTML", type: "static" },
];

const tabs: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "runtime", label: "Runtime" },
  { id: "database", label: "Database" },
  { id: "cors", label: "CORS" },
  { id: "logs", label: "Logs" },
  { id: "redirects", label: "Redirects" },
  { id: "advanced", label: "Advanced" },
];

export default function Websites() {
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [reqs, setReqs] = useState<Requirements | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [showCreate, setShowCreate] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ ...defaultForm });
  const [logs, setLogs] = useState("");
  const [logType, setLogType] = useState<"error" | "access">("error");
  const [redirects, setRedirects] = useState<RedirectRule[]>([]);
  const [redirectLoading, setRedirectLoading] = useState(false);

  const site = sites.find((s) => s.name === selected) || null;

  const refresh = async () => {
    const [s, r] = await Promise.all([
      invoke<Site[]>("get_sites"),
      invoke<Requirements>("check_requirements"),
    ]);
    setSites(s);
    setReqs(r);
    if (!selected && s.length > 0) setSelected(s[0].name);
    if (selected && !s.find((x) => x.name === selected) && s.length > 0)
      setSelected(s[0].name);
  };

  useEffect(() => {
    refresh();
  }, []);

  const getSiteStatus = (
    s: Site
  ): { ready: boolean; missing: string[] } => {
    if (!reqs) return { ready: false, missing: [] };
    const m: string[] = [];
    if (!reqs.nginx) m.push("Nginx");
    if (!reqs.dns) m.push("DNS");
    if (s.ssl === "true" && !reqs.ssl_ca) m.push("SSL CA");
    if (s.site_type === "php" && !reqs.php_fpm) m.push("PHP-FPM");
    if (s.site_type === "node" && !reqs.node) m.push("Node.js");
    if (s.site_type === "python" && !reqs.python) m.push("Python");
    if (s.site_type === "go" && !reqs.go_lang) m.push("Go");
    if (s.db_type === "mysql" && !reqs.mysql) m.push("MySQL");
    if (s.db_type === "postgres" && !reqs.postgres) m.push("PostgreSQL");
    return { ready: m.length === 0, missing: m };
  };

  // ── Edit mode ──────────────────────────────────

  const startEdit = () => {
    if (!site) return;
    setForm({
      name: site.name,
      site_type: site.site_type,
      domain: site.domain,
      root: site.root,
      php: site.php,
      port: site.port,
      ssl: site.ssl === "true",
      web_protocol: "both",
      ssl_method: "devstack",
      rewrite_rule: "none",
      db_type: site.db_type || "",
      db_name: site.database || "",
      cors_enabled: site.cors_enabled !== "false",
      cors_origin: site.cors_origin || "*",
      node_version: site.node_version || "",
      python_version: site.python_version || "",
      custom_nginx: site.custom_nginx || "",
      template: "none",
    });
    setEditMode(true);
    setMessage("");
  };

  const cancelEdit = () => {
    setEditMode(false);
    setMessage("");
  };

  const handleSave = async () => {
    if (!site) return;
    setLoading(true);
    try {
      const result = await invoke<CmdResult>("edit_site", {
        name: site.name,
        domain: form.domain,
        siteType: form.site_type,
        php: form.php,
        port: form.port,
        ssl: form.ssl ? "true" : "false",
        dbType: form.db_type,
        dbName: form.db_name,
        corsEnabled: form.cors_enabled ? "true" : "false",
        corsOrigin: form.cors_origin,
        nodeVersion: form.node_version,
        pythonVersion: form.python_version,
        customNginx: form.custom_nginx,
      });
      if (result.success) {
        setEditMode(false);
        setMessage("");
        await refresh();
      } else {
        setMessage(result.error || "Failed to save");
      }
    } catch (err) {
      setMessage(String(err));
    }
    setLoading(false);
  };

  // ── Create ─────────────────────────────────────

  const openCreateModal = () => {
    setForm({ ...defaultForm });
    setMessage("");
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const domain = form.domain || `${form.name}.test`;
      const root = form.root || `~/.devstack/sites/${form.name}`;
      const result = await invoke<CmdResult>("create_site", {
        name: form.name,
        siteType: form.site_type,
        domain,
        root,
        php: form.php,
        port: form.port,
        ssl: form.ssl,
        dbType: form.db_type,
        dbName: form.db_name,
        corsEnabled: form.cors_enabled,
        corsOrigin: form.cors_origin,
        nodeVersion: form.node_version,
        pythonVersion: form.python_version,
        customNginx: form.custom_nginx,
      });
      if (result.success) {
        // Scaffold from template if selected
        if (form.template && form.template !== "none") {
          try {
            await invoke("create_from_template", { name: form.name, template: form.template, domain });
          } catch { /* template scaffold is best-effort */ }
        }
        setShowCreate(false);
        setForm({ ...defaultForm });
        setMessage("");
        await refresh();
        setSelected(form.name);
      } else {
        setMessage(result.error || "Failed to create site");
      }
    } catch (err) {
      setMessage(String(err));
    }
    setLoading(false);
  };

  // ── Delete ─────────────────────────────────────

  const handleDelete = async () => {
    if (
      !site ||
      !confirm(
        `Delete site "${site.name}"? This removes nginx config, SSL cert, and hosts entry.`
      )
    )
      return;
    setLoading(true);
    await invoke<CmdResult>("delete_site", { name: site.name });
    setSelected(null);
    setEditMode(false);
    await refresh();
    setLoading(false);
  };

  // ── Utility actions ────────────────────────────

  const handleReload = async () => {
    setLoading(true);
    await invoke<CmdResult>("reload_nginx");
    setLoading(false);
  };

  const openBrowser = () => {
    if (!site) return;
    const url = `${site.ssl === "true" ? "https" : "http"}://${site.domain}`;
    invoke("open_in_browser", { url });
  };

  const openEditor = () => {
    if (!site) return;
    invoke("open_in_editor", { path: site.root });
  };

  const fetchLogs = async (type?: "error" | "access") => {
    if (!site) return;
    const t = type || logType;
    setLogType(t);
    try {
      const result = await invoke<CmdResult>("get_site_logs", { domain: site.domain, logType: t });
      setLogs(result.success ? result.output : result.error || "No logs found");
    } catch {
      // Fallback to generic logs
      const logName = t === "access" ? `${site.name}-access` : site.name;
      const result = await invoke<CmdResult>("get_logs", { name: logName });
      setLogs(result.success ? result.output : result.error || "No logs found");
    }
  };

  useEffect(() => {
    if (tab === "logs" && site) fetchLogs();
  }, [tab, selected]);

  // ── Redirects ──────────────────────────────────

  const fetchRedirects = async () => {
    if (!site) return;
    setRedirectLoading(true);
    try {
      const rules = await invoke<RedirectRule[]>("get_site_redirects", { domain: site.domain });
      setRedirects(rules);
    } catch {
      setRedirects([]);
    } finally {
      setRedirectLoading(false);
    }
  };

  const saveRedirects = async () => {
    if (!site) return;
    setRedirectLoading(true);
    try {
      const result = await invoke<CmdResult>("save_site_redirects", { domain: site.domain, rules: redirects });
      if (result.success) {
        toast("Redirect rules saved", "success");
      } else {
        toast(result.error || "Failed to save redirects", "error");
      }
    } catch (e: any) {
      toast(e.toString(), "error");
    } finally {
      setRedirectLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "redirects" && site) fetchRedirects();
  }, [tab, selected]);

  const addRedirectRule = () => {
    setRedirects([...redirects, { from: "", to: "", code: 301, enabled: true }]);
  };

  const updateRedirect = (index: number, field: keyof RedirectRule, value: string | number | boolean) => {
    const updated = redirects.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    setRedirects(updated);
  };

  const removeRedirect = (index: number) => {
    setRedirects(redirects.filter((_, i) => i !== index));
  };

  const renderRedirectsTab = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="card-title">Redirect Rules</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={addRedirectRule}>+ Add Rule</button>
          <button className="btn btn-sm btn-primary" onClick={saveRedirects} disabled={redirectLoading}>
            {redirectLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {redirects.length === 0 ? (
        <div className="text-dim" style={{ padding: "24px 0", textAlign: "center" }}>
          No redirect rules configured. Click "+ Add Rule" to create one.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "8px 8px 8px 0" }}>From Path</th>
              <th style={{ padding: 8 }}>To URL</th>
              <th style={{ padding: 8, width: 90 }}>Code</th>
              <th style={{ padding: 8, width: 70, textAlign: "center" }}>Enabled</th>
              <th style={{ padding: 8, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {redirects.map((rule, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 8px 6px 0" }}>
                  <input
                    className="form-input"
                    style={{ width: "100%", fontSize: 12 }}
                    placeholder="/old-path"
                    value={rule.from}
                    onChange={(e) => updateRedirect(i, "from", e.target.value)}
                  />
                </td>
                <td style={{ padding: 6 }}>
                  <input
                    className="form-input"
                    style={{ width: "100%", fontSize: 12 }}
                    placeholder="https://example.com/new-path"
                    value={rule.to}
                    onChange={(e) => updateRedirect(i, "to", e.target.value)}
                  />
                </td>
                <td style={{ padding: 6 }}>
                  <select
                    className="form-select"
                    style={{ width: "100%", fontSize: 12 }}
                    value={rule.code}
                    onChange={(e) => updateRedirect(i, "code", parseInt(e.target.value))}
                  >
                    <option value={301}>301</option>
                    <option value={302}>302</option>
                  </select>
                </td>
                <td style={{ padding: 6, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => updateRedirect(i, "enabled", e.target.checked)}
                  />
                </td>
                <td style={{ padding: 6, textAlign: "center" }}>
                  <button
                    className="btn btn-sm"
                    style={{ color: "var(--danger)", fontSize: 11 }}
                    onClick={() => removeRedirect(i)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="text-dim" style={{ fontSize: 12, marginTop: 12 }}>
        Reload nginx after saving to apply changes.
      </div>
    </div>
  );

  // ── Requirements bar items ─────────────────────

  const reqItems = reqs
    ? [
        { label: "Nginx", ok: reqs.nginx },
        { label: "DNS", ok: reqs.dns },
        { label: "SSL", ok: reqs.ssl_ca },
        { label: "PHP", ok: reqs.php_fpm },
        { label: "MySQL", ok: reqs.mysql },
        { label: "PgSQL", ok: reqs.postgres },
        { label: "Node", ok: reqs.node },
        { label: "Python", ok: reqs.python },
        { label: "Go", ok: reqs.go_lang },
      ]
    : [];

  // ── Auto-fill domain when name changes in create ──

  const updateFormName = (name: string) => {
    const cleaned = name.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setForm((f) => ({
      ...f,
      name: cleaned,
      domain: `${cleaned}.test`,
      root: `~/.devstack/sites/${cleaned}`,
      db_name: f.db_type ? `${cleaned}_db` : "",
    }));
  };

  // ── Render ─────────────────────────────────────

  return (
    <div className="master-detail">
      {/* ── Left Panel: Site List ───────────────── */}
      <div className="master-list">
        <div className="master-list-header">
          <span className="master-list-title">Websites</span>
          <button className="btn btn-sm btn-primary" onClick={openCreateModal}>
            +
          </button>
        </div>

        {/* Requirements dot bar */}
        <div className="req-bar">
          {reqItems.map((r) => (
            <span
              key={r.label}
              className={`req-dot ${r.ok ? "ok" : "missing"}`}
              title={r.label}
            />
          ))}
        </div>

        {/* Site items */}
        <div className="master-list-items">
          {sites.map((s) => {
            const { ready } = getSiteStatus(s);
            return (
              <div
                key={s.name}
                className={`master-list-item ${selected === s.name ? "active" : ""}`}
                onClick={() => {
                  setSelected(s.name);
                  setEditMode(false);
                  setTab("general");
                }}
              >
                <span
                  className={`status-dot ${ready ? "running" : "stopped"}`}
                />
                <div className="master-list-item-info">
                  <div className="master-list-item-name">{s.name}</div>
                  <div className="master-list-item-sub">{s.domain}</div>
                </div>
                <span
                  className={`badge ${typeColors[s.site_type] || ""}`}
                  style={{ fontSize: 10 }}
                >
                  {typeLabels[s.site_type] || s.site_type}
                </span>
              </div>
            );
          })}
          {sites.length === 0 && (
            <div className="master-detail-empty" style={{ padding: 40 }}>
              <div style={{ fontSize: 36, opacity: 0.2 }}>+</div>
              <div>No websites yet</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Detail View ───────────── */}
      <div className="master-detail-content">
        {!site ? (
          <div className="master-detail-empty">
            <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.3 }}>
              +
            </div>
            <div>Select a website or create a new one</div>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="detail-header">
              <div>
                <div className="detail-title">{site.name}</div>
                <div className="detail-subtitle">
                  {site.ssl === "true" ? "https" : "http"}://{site.domain}
                </div>
              </div>
              <div className="btn-group">
                <button className="btn btn-sm" onClick={openBrowser}>
                  Open
                </button>
                <button className="btn btn-sm" onClick={openEditor}>
                  Code
                </button>
                <button
                  className="btn btn-sm"
                  onClick={handleReload}
                  disabled={loading}
                >
                  Reload
                </button>
                {!editMode ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={startEdit}
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button className="btn btn-sm" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleSave}
                      disabled={loading}
                    >
                      {loading ? <span className="spinner" /> : "Save"}
                    </button>
                  </>
                )}
                <button className="btn btn-sm btn-danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>

            {/* Status warning */}
            {(() => {
              const { ready, missing } = getSiteStatus(site);
              return !ready ? (
                <div className="warning-banner">
                  Not ready — missing: {missing.join(", ")}. Start them from
                  Services page.
                </div>
              ) : (
                <div className="info-banner" style={{ color: "var(--green)", background: "var(--green-bg)" }}>
                  Ready
                </div>
              );
            })()}

            {message && <div className="warning-banner">{message}</div>}

            {/* Tabs */}
            <div className="tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: General ───────────────────── */}
            {tab === "general" && (
              <div className="detail-grid">
                <DetailField
                  label="Website Type"
                  value={
                    editMode ? (
                      <select
                        className="form-select"
                        value={form.site_type}
                        onChange={(e) =>
                          setForm({ ...form, site_type: e.target.value })
                        }
                      >
                        <option value="php">PHP</option>
                        <option value="node">Node.js</option>
                        <option value="python">Python</option>
                        <option value="go">Go</option>
                        <option value="static">Static</option>
                        <option value="reverse_proxy">Reverse Proxy</option>
                      </select>
                    ) : (
                      <span className={`badge ${typeColors[site.site_type]}`}>
                        {typeLabels[site.site_type] || site.site_type}
                      </span>
                    )
                  }
                />
                <DetailField
                  label="Domain"
                  value={
                    editMode ? (
                      <input
                        className="form-input"
                        value={form.domain}
                        onChange={(e) =>
                          setForm({ ...form, domain: e.target.value })
                        }
                      />
                    ) : (
                      site.domain
                    )
                  }
                />
                <DetailField
                  label="Root Directory"
                  value={
                    editMode ? (
                      <input
                        className="form-input"
                        value={form.root}
                        onChange={(e) =>
                          setForm({ ...form, root: e.target.value })
                        }
                      />
                    ) : (
                      <span className="font-mono" style={{ fontSize: 12 }}>
                        {site.root}
                      </span>
                    )
                  }
                />
                <DetailField
                  label="SSL / HTTPS"
                  value={
                    editMode ? (
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.ssl}
                          onChange={(e) =>
                            setForm({ ...form, ssl: e.target.checked })
                          }
                        />
                        {form.ssl ? "Enabled" : "Disabled"}
                      </label>
                    ) : site.ssl === "true" ? (
                      <span className="text-green">HTTPS Enabled</span>
                    ) : (
                      "HTTP only"
                    )
                  }
                />
                {site.site_type !== "php" &&
                  site.site_type !== "static" && (
                    <DetailField
                      label="App Port"
                      value={
                        editMode ? (
                          <input
                            className="form-input"
                            value={form.port}
                            onChange={(e) =>
                              setForm({ ...form, port: e.target.value })
                            }
                            placeholder="3000"
                          />
                        ) : (
                          site.port || "---"
                        )
                      }
                    />
                  )}
                <DetailField label="Created" value={site.created || "---"} />
              </div>
            )}

            {/* ── Tab: Runtime ───────────────────── */}
            {tab === "runtime" && (
              <div className="detail-grid">
                {(site.site_type === "php" || editMode) && (
                  <DetailField
                    label="PHP Version"
                    value={
                      editMode ? (
                        <select
                          className="form-select"
                          value={form.php}
                          onChange={(e) =>
                            setForm({ ...form, php: e.target.value })
                          }
                        >
                          <option value="8.5">8.5</option>
                          <option value="8.4">8.4</option>
                          <option value="8.3">8.3</option>
                          <option value="8.2">8.2</option>
                          <option value="8.1">8.1</option>
                        </select>
                      ) : (
                        site.php
                      )
                    }
                  />
                )}
                <DetailField
                  label="Node.js Version"
                  value={
                    editMode ? (
                      <input
                        className="form-input"
                        value={form.node_version}
                        onChange={(e) =>
                          setForm({ ...form, node_version: e.target.value })
                        }
                        placeholder="e.g. 20, 18, 22"
                      />
                    ) : (
                      site.node_version || "System default"
                    )
                  }
                />
                <DetailField
                  label="Python Version"
                  value={
                    editMode ? (
                      <input
                        className="form-input"
                        value={form.python_version}
                        onChange={(e) =>
                          setForm({ ...form, python_version: e.target.value })
                        }
                        placeholder="e.g. 3.12, 3.11"
                      />
                    ) : (
                      site.python_version || "System default"
                    )
                  }
                />
                {reqs && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      background: "var(--bg)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div className="card-title" style={{ marginBottom: 8 }}>
                      Runtime Status
                    </div>
                    <div
                      style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
                    >
                      <span>
                        <span
                          className={`req-dot ${reqs.php_fpm ? "ok" : "missing"}`}
                        />{" "}
                        PHP-FPM {reqs.php_fpm ? "running" : "stopped"}
                      </span>
                      <span>
                        <span
                          className={`req-dot ${reqs.node ? "ok" : "missing"}`}
                        />{" "}
                        Node.js {reqs.node ? "available" : "not found"}
                      </span>
                      <span>
                        <span
                          className={`req-dot ${reqs.python ? "ok" : "missing"}`}
                        />{" "}
                        Python {reqs.python ? "available" : "not found"}
                      </span>
                      <span>
                        <span
                          className={`req-dot ${reqs.go_lang ? "ok" : "missing"}`}
                        />{" "}
                        Go {reqs.go_lang ? "available" : "not found"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Database ──────────────────── */}
            {tab === "database" && (
              <div className="detail-grid">
                <DetailField
                  label="Database Engine"
                  value={
                    editMode ? (
                      <select
                        className="form-select"
                        value={form.db_type}
                        onChange={(e) =>
                          setForm({ ...form, db_type: e.target.value })
                        }
                      >
                        <option value="">None</option>
                        <option value="mysql">MySQL</option>
                        <option value="postgres">PostgreSQL</option>
                      </select>
                    ) : site.db_type ? (
                      <span className="badge">{site.db_type}</span>
                    ) : (
                      "None"
                    )
                  }
                />
                {(site.database || (editMode && form.db_type)) && (
                  <DetailField
                    label="Database Name"
                    value={
                      editMode ? (
                        <input
                          className="form-input"
                          value={form.db_name}
                          onChange={(e) =>
                            setForm({ ...form, db_name: e.target.value })
                          }
                          placeholder={`${site.name}_db`}
                        />
                      ) : (
                        site.database || "---"
                      )
                    }
                  />
                )}
                {reqs && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      background: "var(--bg)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div className="card-title" style={{ marginBottom: 8 }}>
                      Database Status
                    </div>
                    <div
                      style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
                    >
                      <span>
                        <span
                          className={`req-dot ${reqs.mysql ? "ok" : "missing"}`}
                        />{" "}
                        MySQL {reqs.mysql ? "running" : "stopped"}
                      </span>
                      <span>
                        <span
                          className={`req-dot ${reqs.postgres ? "ok" : "missing"}`}
                        />{" "}
                        PostgreSQL {reqs.postgres ? "running" : "stopped"}
                      </span>
                      <span>
                        <span
                          className={`req-dot ${reqs.redis ? "ok" : "missing"}`}
                        />{" "}
                        Redis {reqs.redis ? "running" : "stopped"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: CORS ──────────────────────── */}
            {tab === "cors" && (
              <div className="detail-grid">
                <DetailField
                  label="CORS Enabled"
                  value={
                    editMode ? (
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.cors_enabled}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              cors_enabled: e.target.checked,
                            })
                          }
                        />
                        {form.cors_enabled ? "Enabled" : "Disabled"}
                      </label>
                    ) : site.cors_enabled !== "false" ? (
                      <span className="text-green">Enabled</span>
                    ) : (
                      "Disabled"
                    )
                  }
                />
                {(site.cors_enabled !== "false" ||
                  (editMode && form.cors_enabled)) && (
                  <DetailField
                    label="Allowed Origin"
                    value={
                      editMode ? (
                        <input
                          className="form-input"
                          value={form.cors_origin}
                          onChange={(e) =>
                            setForm({ ...form, cors_origin: e.target.value })
                          }
                          placeholder="*"
                        />
                      ) : (
                        site.cors_origin || "*"
                      )
                    }
                  />
                )}
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--text-dim)",
                  }}
                >
                  CORS headers are added to the nginx config. Methods: GET,
                  POST, PUT, DELETE, OPTIONS. Headers: Authorization,
                  Content-Type, Accept, X-Requested-With.
                </div>
              </div>
            )}

            {/* ── Tab: Logs ──────────────────────── */}
            {tab === "logs" && (
              <div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <button
                    className={`btn btn-sm ${logType === "error" ? "btn-primary" : ""}`}
                    onClick={() => fetchLogs("error")}
                  >
                    Error Log
                  </button>
                  <button
                    className={`btn btn-sm ${logType === "access" ? "btn-primary" : ""}`}
                    onClick={() => fetchLogs("access")}
                  >
                    Access Log
                  </button>
                  <button className="btn btn-sm" onClick={() => fetchLogs()}>
                    Refresh
                  </button>
                </div>
                <pre className="log-viewer">{logs || "No logs available"}</pre>
              </div>
            )}

            {/* ── Tab: Redirects ────────────────── */}
            {tab === "redirects" && renderRedirectsTab()}

            {/* ── Tab: Advanced ──────────────────── */}
            {tab === "advanced" && (
              <div className="detail-grid">
                <DetailField
                  label="Custom Nginx Directives"
                  value={
                    editMode ? (
                      <textarea
                        className="form-textarea"
                        style={{ minHeight: 120 }}
                        value={form.custom_nginx}
                        onChange={(e) =>
                          setForm({ ...form, custom_nginx: e.target.value })
                        }
                        placeholder={
                          "# Extra nginx directives for this site\n# e.g. client_max_body_size 100M;"
                        }
                      />
                    ) : site.custom_nginx ? (
                      <pre
                        className="font-mono"
                        style={{
                          fontSize: 12,
                          margin: 0,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {site.custom_nginx}
                      </pre>
                    ) : (
                      <span className="text-dim">None</span>
                    )
                  }
                />
                <div className="mt-16">
                  <div className="card-title">Nginx Config File</div>
                  <code className="font-mono text-dim" style={{ fontSize: 12 }}>
                    ~/.devstack/nginx/{site.name}.conf
                  </code>
                </div>
                <div className="mt-12">
                  <div className="card-title">SSL Certificate</div>
                  <code className="font-mono text-dim" style={{ fontSize: 12 }}>
                    ~/.devstack/certs/{site.domain}.pem
                  </code>
                </div>
                <div className="mt-12">
                  <div className="card-title">Site Root</div>
                  <code className="font-mono text-dim" style={{ fontSize: 12 }}>
                    {site.root}
                  </code>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create Site Modal ──────────────────── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="modal-title">Create Website</div>

            {message && <div className="warning-banner">{message}</div>}

            {/* Name */}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                placeholder="myapp"
                value={form.name}
                onChange={(e) => updateFormName(e.target.value)}
                autoFocus
              />
              <div className="form-hint">
                Domain: {form.name || "name"}.test | Root: ~/.devstack/sites/
                {form.name || "name"}
              </div>
            </div>

            {/* Domain */}
            <div className="form-group">
              <label className="form-label">Domain</label>
              <input
                className="form-input"
                placeholder={`${form.name || "myapp"}.test`}
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </div>

            {/* Web Protocol + SSL Method */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Web Protocol</label>
                <select
                  className="form-select"
                  value={form.web_protocol}
                  onChange={(e) => {
                    const v = e.target.value as WebProtocol;
                    setForm({
                      ...form,
                      web_protocol: v,
                      ssl: v !== "http",
                    });
                  }}
                >
                  <option value="both">HTTP & HTTPS</option>
                  <option value="https">HTTPS Only</option>
                  <option value="http">HTTP Only</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">SSL Method</label>
                <select
                  className="form-select"
                  value={form.ssl_method}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ssl_method: e.target.value as SslMethod,
                    })
                  }
                  disabled={form.web_protocol === "http"}
                >
                  <option value="devstack">DevStack CA</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            {/* Website Type + PHP Version */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Website Type</label>
                <select
                  className="form-select"
                  value={form.site_type}
                  onChange={(e) =>
                    setForm({ ...form, site_type: e.target.value })
                  }
                >
                  <option value="php">PHP</option>
                  <option value="node">Node.js</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="static">Static</option>
                  <option value="reverse_proxy">Reverse Proxy</option>
                </select>
              </div>
              {form.site_type === "php" && (
                <div className="form-group">
                  <label className="form-label">PHP Version</label>
                  <select
                    className="form-select"
                    value={form.php}
                    onChange={(e) =>
                      setForm({ ...form, php: e.target.value })
                    }
                  >
                    <option value="8.5">8.5</option>
                    <option value="8.4">8.4</option>
                    <option value="8.3">8.3</option>
                    <option value="8.2">8.2</option>
                    <option value="8.1">8.1</option>
                  </select>
                </div>
              )}
              {["node", "python", "go", "reverse_proxy"].includes(
                form.site_type
              ) && (
                <div className="form-group">
                  <label className="form-label">App Port</label>
                  <input
                    className="form-input"
                    placeholder={
                      form.site_type === "node"
                        ? "3000"
                        : form.site_type === "python"
                          ? "8000"
                          : "8080"
                    }
                    value={form.port}
                    onChange={(e) =>
                      setForm({ ...form, port: e.target.value })
                    }
                  />
                </div>
              )}
            </div>

            {/* Rewrite Rule + Database */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Rewrite Rule</label>
                <select
                  className="form-select"
                  value={form.rewrite_rule}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rewrite_rule: e.target.value as RewriteRule,
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="wordpress">WordPress</option>
                  <option value="laravel">Laravel</option>
                  <option value="symfony">Symfony</option>
                  <option value="drupal">Drupal</option>
                  <option value="magento">Magento</option>
                  <option value="codeigniter">CodeIgniter</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Database</label>
                <select
                  className="form-select"
                  value={form.db_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      db_type: e.target.value,
                      db_name: e.target.value
                        ? `${form.name}_db`
                        : "",
                    })
                  }
                >
                  <option value="">None</option>
                  <option value="mysql">MySQL</option>
                  <option value="postgres">PostgreSQL</option>
                </select>
              </div>
            </div>

            {/* CORS toggle */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.cors_enabled}
                  onChange={(e) =>
                    setForm({ ...form, cors_enabled: e.target.checked })
                  }
                />
                Enable CORS
              </label>
            </div>

            {/* Root Directory */}
            <div className="form-group">
              <label className="form-label">Root Directory</label>
              <input
                className="form-input"
                placeholder={`~/.devstack/sites/${form.name || "myapp"}`}
                value={form.root}
                onChange={(e) => setForm({ ...form, root: e.target.value })}
              />
              <div className="form-hint">
                Auto-filled based on site name. Change if needed.
              </div>
            </div>

            {/* Template */}
            <div className="form-group">
              <label className="form-label">Project Template</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    className={`btn btn-xs${form.template === t.id ? " btn-primary" : ""}`}
                    style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={() => {
                      const updates: Record<string, unknown> = { template: t.id };
                      if (t.type) updates.site_type = t.type;
                      if (t.rewrite) updates.rewrite_rule = t.rewrite;
                      if (t.type === "node") updates.port = "3000";
                      if (t.type === "python") updates.port = "8000";
                      setForm({ ...form, ...updates } as typeof form);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="form-hint">
                {form.template !== "none"
                  ? `Will scaffold a ${templates.find(t => t.id === form.template)?.label} project after creating the site.`
                  : "Optional — select a framework to auto-scaffold the project files."}
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={loading || !form.name.trim()}
              >
                {loading ? <span className="spinner" /> : null} Create Website
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper Component ────────────────────────────

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="detail-field">
      <div className="detail-field-label">{label}</div>
      <div className="detail-field-value">{value}</div>
    </div>
  );
}
