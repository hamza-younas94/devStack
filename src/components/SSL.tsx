import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SslCert {
  domain: string;
  cert_path: string;
  key_path: string;
  issuer: string;
  expiry: string;
}

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

type CertType = "domain" | "smime" | "code" | "document";
type MainCategory = "local" | "acme";

interface AcmeCert {
  domain: string;
  expiry: string;
  cert_path: string;
}

interface TabConfig {
  key: CertType;
  label: string;
  filenamePattern: string;
  description: string;
  fields: { key: string; label: string; placeholder: string }[];
  createLabel: string;
  col1Header: string;
}

const TABS: TabConfig[] = [
  {
    key: "domain",
    label: "Domain Certs",
    filenamePattern: "",
    description:
      "Locally-trusted TLS certificates generated with mkcert. The DevStack CA is installed in your system trust store — browsers automatically trust all certificates issued by it.",
    fields: [{ key: "domain", label: "Domain", placeholder: "myapp.test" }],
    createLabel: "New Domain Certificate",
    col1Header: "Domain",
  },
  {
    key: "smime",
    label: "S/MIME",
    filenamePattern: "smime_",
    description:
      "S/MIME certificates for email signing and encryption. Attach to your email client to digitally sign and encrypt messages.",
    fields: [
      { key: "domain", label: "Email Address", placeholder: "you@example.com" },
      { key: "org", label: "Organization", placeholder: "My Company" },
    ],
    createLabel: "New S/MIME Certificate",
    col1Header: "Email",
  },
  {
    key: "code",
    label: "Code Signing",
    filenamePattern: "codesign_",
    description:
      "Code signing certificates for signing executables, scripts, and packages. Use with codesign, signtool, or jarsigner.",
    fields: [
      { key: "domain", label: "Name / Identifier", placeholder: "John Doe" },
      { key: "org", label: "Organization", placeholder: "My Company" },
    ],
    createLabel: "New Code Signing Certificate",
    col1Header: "Name / Identifier",
  },
  {
    key: "document",
    label: "Document Signing",
    filenamePattern: "docsign_",
    description:
      "Document signing certificates for signing PDFs and other documents. Compatible with Adobe Acrobat and other PDF readers.",
    fields: [
      { key: "domain", label: "Name / Identifier", placeholder: "John Doe" },
      { key: "org", label: "Organization", placeholder: "My Company" },
    ],
    createLabel: "New Document Signing Certificate",
    col1Header: "Name / Identifier",
  },
];

export default function SSL() {
  const [allCerts, setAllCerts] = useState<SslCert[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<CertType>("domain");
  const [showCreate, setShowCreate] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  // ACME / Let's Encrypt state
  const [mainCategory, setMainCategory] = useState<MainCategory>("local");
  const [acmeInstalled, setAcmeInstalled] = useState<boolean | null>(null);
  const [acmeCerts, setAcmeCerts] = useState<AcmeCert[]>([]);
  const [acmeEmail, setAcmeEmail] = useState("");
  const [acmeDomain, setAcmeDomain] = useState("");
  const [acmeLoading, setAcmeLoading] = useState(false);
  const [acmeMessage, setAcmeMessage] = useState("");

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await invoke<SslCert[]>("get_ssl_certs");
      setAllCerts(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredCerts = allCerts.filter((cert) => {
    const filename = cert.cert_path.split("/").pop() || "";
    if (activeTab === "domain") {
      return (
        !filename.startsWith("smime_") &&
        !filename.startsWith("codesign_") &&
        !filename.startsWith("docsign_")
      );
    }
    return filename.startsWith(currentTab.filenamePattern);
  });

  const handleCreate = async () => {
    const primaryValue = (formValues["domain"] || "").trim();
    if (!primaryValue) return;

    setCreating(true);
    setMessage("");
    try {
      let result: CmdResult;
      if (activeTab === "domain") {
        result = await invoke<CmdResult>("create_ssl_cert", {
          domain: primaryValue,
        });
      } else {
        result = await invoke<CmdResult>("create_ssl_cert_advanced", {
          certType: activeTab,
          domain: primaryValue,
          org: (formValues["org"] || "").trim(),
        });
      }
      if (result.success) {
        setShowCreate(false);
        setFormValues({});
        setMessage("");
        await refresh();
      } else {
        setMessage(result.error || `Failed to create ${currentTab.label} certificate`);
      }
    } catch (err) {
      setMessage(String(err));
    }
    setCreating(false);
  };

  const handleDelete = async (certDomain: string) => {
    if (
      !confirm(
        `Delete certificate for "${certDomain}"? This will remove the cert and key files.`
      )
    )
      return;
    setLoading(true);
    try {
      const result = await invoke<CmdResult>("delete_ssl_cert", {
        domain: certDomain,
      });
      if (!result.success) {
        setMessage(result.error || "Failed to delete certificate");
      }
      await refresh();
    } catch (err) {
      setMessage(String(err));
    }
    setLoading(false);
  };

  const openCreateModal = () => {
    setFormValues({});
    setMessage("");
    setShowCreate(true);
  };

  const setField = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  // ACME helpers
  const acmeCheckInstalled = async () => {
    try {
      const result = await invoke<CmdResult>("acme_check");
      setAcmeInstalled(result.success);
    } catch {
      setAcmeInstalled(false);
    }
  };

  const acmeInstallCertbot = async () => {
    setAcmeLoading(true);
    setAcmeMessage("");
    try {
      const result = await invoke<CmdResult>("acme_install");
      if (result.success) {
        setAcmeInstalled(true);
        setAcmeMessage("Certbot installed successfully.");
      } else {
        setAcmeMessage(result.error || "Failed to install certbot.");
      }
    } catch (err) {
      setAcmeMessage(String(err));
    }
    setAcmeLoading(false);
  };

  const acmeRefreshCerts = async () => {
    setAcmeLoading(true);
    try {
      const result = await invoke<CmdResult>("acme_list_certs");
      if (result.success && result.output) {
        try {
          setAcmeCerts(JSON.parse(result.output));
        } catch {
          setAcmeCerts([]);
        }
      } else {
        setAcmeCerts([]);
      }
    } catch {
      setAcmeCerts([]);
    }
    setAcmeLoading(false);
  };

  const acmeIssueCert = async () => {
    const domain = acmeDomain.trim();
    const email = acmeEmail.trim();
    if (!domain || !email) return;
    setAcmeLoading(true);
    setAcmeMessage("");
    try {
      const result = await invoke<CmdResult>("acme_issue_cert", { domain, email });
      if (result.success) {
        setAcmeMessage(`Certificate issued for ${domain}.`);
        setAcmeDomain("");
        await acmeRefreshCerts();
      } else {
        setAcmeMessage(result.error || "Failed to issue certificate.");
      }
    } catch (err) {
      setAcmeMessage(String(err));
    }
    setAcmeLoading(false);
  };

  const acmeRenewAll = async () => {
    setAcmeLoading(true);
    setAcmeMessage("");
    try {
      const result = await invoke<CmdResult>("acme_renew");
      if (result.success) {
        setAcmeMessage("All certificates renewed successfully.");
        await acmeRefreshCerts();
      } else {
        setAcmeMessage(result.error || "Renewal failed.");
      }
    } catch (err) {
      setAcmeMessage(String(err));
    }
    setAcmeLoading(false);
  };

  const acmeRevokeCert = async (domain: string) => {
    if (!confirm(`Revoke Let's Encrypt certificate for "${domain}"?`)) return;
    setAcmeLoading(true);
    setAcmeMessage("");
    try {
      const result = await invoke<CmdResult>("acme_revoke_cert", { domain });
      if (result.success) {
        setAcmeMessage(`Certificate for ${domain} revoked.`);
        await acmeRefreshCerts();
      } else {
        setAcmeMessage(result.error || "Revocation failed.");
      }
    } catch (err) {
      setAcmeMessage(String(err));
    }
    setAcmeLoading(false);
  };

  // Check ACME status when switching to acme tab
  useEffect(() => {
    if (mainCategory === "acme") {
      acmeCheckInstalled();
      acmeRefreshCerts();
    }
  }, [mainCategory]);

  const primaryFieldFilled = (formValues["domain"] || "").trim().length > 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">SSL Certificates</h1>
        {mainCategory === "local" && (
          <div className="btn-group">
            <button className="btn" onClick={refresh} disabled={loading}>
              {loading ? <span className="spinner" /> : null} Refresh
            </button>
            <button className="btn btn-primary" onClick={openCreateModal}>
              + {currentTab.createLabel}
            </button>
          </div>
        )}
      </div>

      <div className="page-body">
        {/* Main category toggle: Local CA vs Let's Encrypt */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
          <button
            className={`btn ${mainCategory === "local" ? "btn-primary" : ""}`}
            style={{
              borderRadius: 0,
              borderTopLeftRadius: 6,
              borderBottomLeftRadius: 6,
              borderRight: "1px solid var(--border-color, #333)",
            }}
            onClick={() => { setMainCategory("local"); setMessage(""); setAcmeMessage(""); }}
          >
            Local CA (mkcert)
          </button>
          <button
            className={`btn ${mainCategory === "acme" ? "btn-primary" : ""}`}
            style={{
              borderRadius: 0,
              borderTopRightRadius: 6,
              borderBottomRightRadius: 6,
            }}
            onClick={() => { setMainCategory("acme"); setMessage(""); setAcmeMessage(""); }}
          >
            Let's Encrypt (ACME)
          </button>
        </div>

        {/* ===== Local CA (mkcert) section ===== */}
        {mainCategory === "local" && (
          <>
            {message && <div className="warning-banner">{message}</div>}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
              {TABS.map((tab, idx) => (
                <button
                  key={tab.key}
                  className={`btn ${activeTab === tab.key ? "btn-primary" : ""}`}
                  style={{
                    borderRadius: 0,
                    borderRight: idx < TABS.length - 1 ? "1px solid var(--border-color, #333)" : "none",
                    ...(idx === 0 ? { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 } : {}),
                    ...(idx === TABS.length - 1
                      ? { borderTopRightRadius: 6, borderBottomRightRadius: 6 }
                      : {}),
                  }}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setMessage("");
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="info-banner">{currentTab.description}</div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{currentTab.col1Header}</th>
                    <th>Certificate</th>
                    <th>Issuer</th>
                    <th>Expiry</th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCerts.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          No {currentTab.label.toLowerCase()} certificates found. Click "+ {currentTab.createLabel}" to create one.
                        </div>
                      </td>
                    </tr>
                  )}
                  {loading && filteredCerts.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          <span className="spinner" /> Loading...
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredCerts.map((cert) => (
                    <tr key={cert.cert_path}>
                      <td style={{ fontWeight: 600 }}>{cert.domain}</td>
                      <td>
                        <code style={{ fontSize: 12 }}>{cert.cert_path}</code>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{cert.issuer || "\u2014"}</code>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            cert.expiry && new Date(cert.expiry) > new Date()
                              ? "badge-running"
                              : "badge-stopped"
                          }`}
                        >
                          {cert.expiry || "Unknown"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(cert.domain)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== Let's Encrypt (ACME) section ===== */}
        {mainCategory === "acme" && (
          <>
            {acmeMessage && <div className="warning-banner">{acmeMessage}</div>}

            <div className="info-banner">
              Publicly-trusted TLS certificates from Let's Encrypt via Certbot. Requires a publicly accessible domain with DNS pointing to this machine.
            </div>

            {/* Certbot not installed */}
            {acmeInstalled === false && (
              <div className="card">
                <div className="card-header">Certbot Not Installed</div>
                <div className="card-body">
                  <p style={{ marginBottom: 12 }}>
                    Certbot is required to manage Let's Encrypt certificates. Click below to install it.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={acmeInstallCertbot}
                    disabled={acmeLoading}
                  >
                    {acmeLoading ? <span className="spinner" /> : null} Install Certbot
                  </button>
                </div>
              </div>
            )}

            {/* Checking status */}
            {acmeInstalled === null && (
              <div className="card">
                <div className="card-body">
                  <div className="empty-state">
                    <span className="spinner" /> Checking certbot status...
                  </div>
                </div>
              </div>
            )}

            {/* Certbot installed — show management UI */}
            {acmeInstalled === true && (
              <>
                {/* Issue new certificate form */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header">Issue New Certificate</div>
                  <div className="card-body">
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="form-label">Domain</label>
                        <input
                          className="form-input"
                          placeholder="example.com"
                          value={acmeDomain}
                          onChange={(e) => setAcmeDomain(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") acmeIssueCert(); }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="form-label">Email</label>
                        <input
                          className="form-input"
                          placeholder="admin@example.com"
                          value={acmeEmail}
                          onChange={(e) => setAcmeEmail(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") acmeIssueCert(); }}
                        />
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={acmeIssueCert}
                        disabled={acmeLoading || !acmeDomain.trim() || !acmeEmail.trim()}
                      >
                        {acmeLoading ? <span className="spinner" /> : null} Issue Certificate
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions bar */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button className="btn" onClick={acmeRefreshCerts} disabled={acmeLoading}>
                    {acmeLoading ? <span className="spinner" /> : null} Refresh
                  </button>
                  <button className="btn" onClick={acmeRenewAll} disabled={acmeLoading}>
                    {acmeLoading ? <span className="spinner" /> : null} Renew All
                  </button>
                </div>

                {/* Certificates table */}
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Domain</th>
                        <th>Certificate Path</th>
                        <th>Expiry</th>
                        <th style={{ width: 80 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acmeCerts.length === 0 && !acmeLoading && (
                        <tr>
                          <td colSpan={4}>
                            <div className="empty-state">
                              No Let's Encrypt certificates found. Use the form above to issue one.
                            </div>
                          </td>
                        </tr>
                      )}
                      {acmeLoading && acmeCerts.length === 0 && (
                        <tr>
                          <td colSpan={4}>
                            <div className="empty-state">
                              <span className="spinner" /> Loading...
                            </div>
                          </td>
                        </tr>
                      )}
                      {acmeCerts.map((cert) => (
                        <tr key={cert.domain}>
                          <td style={{ fontWeight: 600 }}>{cert.domain}</td>
                          <td>
                            <code style={{ fontSize: 12 }}>{cert.cert_path}</code>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                cert.expiry && new Date(cert.expiry) > new Date()
                                  ? "badge-running"
                                  : "badge-stopped"
                              }`}
                            >
                              {cert.expiry || "Unknown"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => acmeRevokeCert(cert.domain)}
                              disabled={acmeLoading}
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Create Certificate Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{currentTab.createLabel}</div>

            {message && <div className="warning-banner">{message}</div>}

            {currentTab.fields.map((field, idx) => (
              <div className="form-group" key={field.key}>
                <label className="form-label">{field.label}</label>
                <input
                  className="form-input"
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  autoFocus={idx === 0}
                />
              </div>
            ))}

            {activeTab === "domain" && (
              <div className="form-hint">
                A locally-trusted certificate will be generated using mkcert for this domain.
              </div>
            )}

            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={creating || !primaryFieldFilled}
              >
                {creating ? <span className="spinner" /> : null} Create Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
