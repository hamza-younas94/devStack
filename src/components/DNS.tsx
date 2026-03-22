import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";
import { CmdResult } from "../types";

interface DnsEntry {
  domain: string;
  ip: string;
  source: string;
}

interface HostEntry {
  ip: string;
  hostname: string;
  comment: string;
  enabled: boolean;
}

type DnsTab = "entries" | "hosts";

export default function DNS() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DnsEntry[]>([]);
  const [hostEntries, setHostEntries] = useState<HostEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dnsmasqInstalled, setDnsmasqInstalled] = useState(true);
  const [installing, setInstalling] = useState("");
  const [activeTab, setActiveTab] = useState<DnsTab>("entries");
  const [showAdd, setShowAdd] = useState(false);
  const [ip, setIp] = useState("127.0.0.1");
  const [domain, setDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [hostsModified, setHostsModified] = useState(false);

  const refreshEntries = async () => {
    try {
      const data = await invoke<DnsEntry[]>("get_dns_entries");
      setEntries(data);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshHosts = async () => {
    try {
      const data = await invoke<HostEntry[]>("get_hosts_entries");
      setHostEntries(data);
      setHostsModified(false);
    } catch (err) {
      console.error("Failed to load hosts entries:", err);
      setMessage(String(err));
    }
  };

  const checkDnsmasq = async () => {
    try {
      const installed = await invoke<boolean>("check_installed", { name: "dnsmasq" });
      setDnsmasqInstalled(installed);
    } catch { setDnsmasqInstalled(false); }
  };

  const installDnsmasq = async () => {
    setInstalling("dnsmasq");
    toast("Installing dnsmasq...", "info");
    try {
      const r = await invoke<CmdResult>("install_package", { formula: "dnsmasq" });
      if (r.success) {
        toast("dnsmasq installed", "success");
        await checkDnsmasq();
      } else {
        toast(r.error || "Failed to install dnsmasq", "error");
      }
    } catch (e) { toast(`Install failed: ${e}`, "error"); }
    setInstalling("");
  };

  const setupDns = async () => {
    setInstalling("dns");
    toast("Setting up DNS resolver...", "info");
    try {
      const r = await invoke<CmdResult>("run_onboarding_step", { step: "dns" });
      if (r.success) {
        toast("DNS resolver configured", "success");
        await refresh();
      } else {
        toast(r.error || "DNS setup failed", "error");
      }
    } catch (e) { toast(`DNS setup failed: ${e}`, "error"); }
    setInstalling("");
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([refreshEntries(), refreshHosts(), checkDnsmasq()]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  // --- DNS Entries tab: add/remove ---

  const handleAdd = async () => {
    if (!domain.trim() || !ip.trim()) return;
    setAdding(true);
    setMessage("");
    try {
      const result = await invoke<CmdResult>("add_host_entry", {
        ip: ip.trim(),
        domain: domain.trim(),
      });
      if (result.success) {
        setShowAdd(false);
        setDomain("");
        setIp("127.0.0.1");
        setMessage("");
        await refresh();
      } else {
        setMessage(result.error || "Failed to add entry");
      }
    } catch (err) {
      setMessage(String(err));
    }
    setAdding(false);
  };

  const handleRemove = async (entryDomain: string) => {
    if (!confirm(`Remove hosts entry for "${entryDomain}"?`)) return;
    setLoading(true);
    try {
      const result = await invoke<CmdResult>("remove_host_entry", { domain: entryDomain });
      if (!result.success) {
        setMessage(result.error || "Failed to remove entry");
      }
      await refresh();
    } catch (err) {
      setMessage(String(err));
    }
    setLoading(false);
  };

  const openAddModal = () => {
    setDomain("");
    setIp("127.0.0.1");
    setMessage("");
    setShowAdd(true);
  };

  // --- Hosts File Editor ---

  const updateHostEntry = (index: number, field: keyof HostEntry, value: string | boolean) => {
    setHostEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHostsModified(true);
  };

  const addHostRow = () => {
    setHostEntries((prev) => [
      ...prev,
      { ip: "127.0.0.1", hostname: "", comment: "", enabled: true },
    ]);
    setHostsModified(true);
  };

  const deleteHostRow = (index: number) => {
    setHostEntries((prev) => prev.filter((_, i) => i !== index));
    setHostsModified(true);
  };

  const saveHostEntries = async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await invoke<CmdResult>("save_hosts_entries", { entries: hostEntries });
      if (result.success) {
        toast("Hosts file saved", "success");
        setHostsModified(false);
        await refreshEntries();
      } else {
        toast(result.error || "Failed to save hosts file", "error");
      }
    } catch (err) {
      setMessage(String(err));
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">DNS</h1>
        <div className="btn-group">
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" /> : null} Refresh
          </button>
          {activeTab === "entries" && (
            <button className="btn btn-primary" onClick={openAddModal}>
              + Add Entry
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {message && (
          <div className="warning-banner" style={{ cursor: "pointer" }} onClick={() => setMessage("")}>
            {message}
          </div>
        )}

        {!dnsmasqInstalled ? (
          <div className="card" style={{ borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.06)" }}>
            <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>dnsmasq not installed</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  dnsmasq is required for automatic wildcard domain resolution (*.test → 127.0.0.1)
                </div>
              </div>
              <button className="btn btn-primary" onClick={installDnsmasq} disabled={!!installing}>
                {installing === "dnsmasq" ? <span className="spinner" /> : null} Install dnsmasq
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ borderColor: "rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.04)" }}>
            <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 6px rgba(34,197,94,0.4)", display: "inline-block" }} />
                  <span style={{ fontWeight: 600 }}>dnsmasq Active</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  All <code>*.test</code> domains resolve to <code>127.0.0.1</code> automatically.
                </div>
              </div>
              <button className="btn btn-sm" onClick={setupDns} disabled={!!installing}>
                {installing === "dns" ? <span className="spinner" /> : null} Reconfigure DNS
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="tabs">
              <button
                className={`tab ${activeTab === "entries" ? "active" : ""}`}
                onClick={() => setActiveTab("entries")}
              >
                DNS Entries
              </button>
              <button
                className={`tab ${activeTab === "hosts" ? "active" : ""}`}
                onClick={() => setActiveTab("hosts")}
              >
                Hosts File Editor
              </button>
            </div>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {/* ===== DNS Entries Tab ===== */}
            {activeTab === "entries" && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>IP Address</th>
                    <th>Source</th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">No DNS entries found</div>
                      </td>
                    </tr>
                  )}
                  {loading && entries.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">
                          <span className="spinner" /> Loading...
                        </div>
                      </td>
                    </tr>
                  )}
                  {entries.map((entry) => (
                    <tr key={`${entry.domain}-${entry.source}`}>
                      <td style={{ fontWeight: 600 }}>{entry.domain}</td>
                      <td>
                        <code>{entry.ip}</code>
                      </td>
                      <td>
                        <span className="badge">{entry.source}</span>
                      </td>
                      <td>
                        {entry.source === "hosts" && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRemove(entry.domain)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* ===== Hosts File Editor Tab ===== */}
            {activeTab === "hosts" && (
              <div>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Manage <code>/etc/hosts</code> entries. Disabled entries are commented out.
                  </span>
                  <div className="btn-group">
                    <button className="btn btn-sm" onClick={addHostRow}>
                      + Add Row
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={saveHostEntries}
                      disabled={saving || !hostsModified}
                    >
                      {saving ? <span className="spinner" /> : null} Save
                    </button>
                  </div>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 70, textAlign: "center" }}>Enabled</th>
                      <th style={{ width: "22%" }}>IP Address</th>
                      <th>Hostname</th>
                      <th style={{ width: "22%" }}>Comment</th>
                      <th style={{ width: 70, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hostEntries.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5}>
                          <div className="empty-state">No hosts entries found</div>
                        </td>
                      </tr>
                    )}
                    {loading && hostEntries.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <div className="empty-state">
                            <span className="spinner" /> Loading...
                          </div>
                        </td>
                      </tr>
                    )}
                    {hostEntries.map((entry, idx) => (
                      <tr key={idx} style={{ opacity: entry.enabled ? 1 : 0.5 }}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={(e) => updateHostEntry(idx, "enabled", e.target.checked)}
                            style={{ width: 16, height: 16, cursor: "pointer" }}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            value={entry.ip}
                            onChange={(e) => updateHostEntry(idx, "ip", e.target.value)}
                            placeholder="127.0.0.1"
                            style={{ fontSize: 13, fontFamily: "var(--font-mono)", padding: "4px 8px" }}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            value={entry.hostname}
                            onChange={(e) => updateHostEntry(idx, "hostname", e.target.value)}
                            placeholder="myapp.test"
                            style={{ fontSize: 13, fontFamily: "var(--font-mono)", padding: "4px 8px" }}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            value={entry.comment}
                            onChange={(e) => updateHostEntry(idx, "comment", e.target.value)}
                            placeholder="optional comment"
                            style={{ fontSize: 13, padding: "4px 8px" }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => deleteHostRow(idx)}
                            title="Remove entry"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Add DNS Entry</div>

            {message && <div className="warning-banner">{message}</div>}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">IP Address</label>
                <input
                  className="form-input"
                  placeholder="127.0.0.1"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Domain</label>
                <input
                  className="form-input"
                  placeholder="myapp.test"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div className="form-hint" style={{ marginBottom: 16 }}>
              This will add a line to <code>/etc/hosts</code>. Requires admin privileges.
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={adding || !domain.trim() || !ip.trim()}
              >
                {adding ? <span className="spinner" /> : null} Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
