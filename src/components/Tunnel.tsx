import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

interface Site {
  name: string;
  domain: string;
  port: string;
  ssl: string;
}

export default function Tunnel() {
  const { toast } = useToast();
  const [provider, setProvider] = useState("cloudflared");
  const [port, setPort] = useState("443");
  const [protocol, setProtocol] = useState("https");
  const [subdomain, setSubdomain] = useState("");
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [tunnelActive, setTunnelActive] = useState(false);
  const [activeProvider, setActiveProvider] = useState("");
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [cfInstalled, setCfInstalled] = useState(false);
  const [ngInstalled, setNgInstalled] = useState(false);
  const [installing, setInstalling] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, status] = await Promise.all([
        invoke<Site[]>("get_sites"),
        invoke<CmdResult>("get_tunnel_status"),
      ]);
      setSites(s);
      setTunnelActive(status.success);
      if (status.success && status.output !== "none") {
        const parts = status.output.split("|");
        setActiveProvider(parts[0] || "");
        setTunnelUrl(parts[1] || "");
      } else {
        setActiveProvider("");
        setTunnelUrl("");
      }
    } catch (e) {
      toast(`Failed to check tunnel status: ${e}`, "error");
    }
    // Check if providers are installed
    try {
      const [cf, ng] = await Promise.all([
        invoke<boolean>("check_installed", { name: "cloudflared" }),
        invoke<boolean>("check_installed", { name: "ngrok" }),
      ]);
      setCfInstalled(cf);
      setNgInstalled(ng);
    } catch { /* */ }
    setLoading(false);
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const installProvider = async (pkg: string) => {
    setInstalling(pkg);
    toast(`Installing ${pkg}...`, "info");
    try {
      const result = await invoke<CmdResult>("install_package", { formula: pkg });
      if (result.success) {
        toast(`${pkg} installed successfully`, "success");
        await refresh();
      } else {
        toast(result.error || `Failed to install ${pkg}`, "error");
      }
    } catch (e) {
      toast(`Install failed: ${e}`, "error");
    }
    setInstalling("");
  };

  const pollForUrl = useCallback(async (prov: string) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const status = await invoke<CmdResult>("get_tunnel_status");
        if (!status.success) {
          toast("Tunnel process stopped", "error");
          setTunnelActive(false);
          setActionLoading("");
          return;
        }
        const parts = status.output.split("|");
        const url = parts[1] || "";
        if (url.startsWith("https://")) {
          setTunnelUrl(url);
          setActiveProvider(parts[0] || prov);
          toast("Tunnel URL ready!", "success");
          setActionLoading("");
          return;
        }
      } catch { break; }
    }
    toast("Tunnel started but URL not detected yet. Try Refresh.", "info");
    setActionLoading("");
    refresh();
  }, [toast, refresh]);

  const startTunnel = async () => {
    setActionLoading("start");
    try {
      const site = sites.find((s) => s.name === selectedSite);
      const hostname = site?.domain || "";
      const result = await invoke<CmdResult>("start_tunnel", { provider, port, protocol, hostname, subdomain });
      if (result.success) {
        const parts = result.output.split("|");
        const prov = parts[0] || provider;
        setTunnelActive(true);
        setActiveProvider(prov);
        toast("Tunnel starting...", "info");
        // Poll in background — doesn't block navigation
        pollForUrl(prov);
        return; // Don't clear actionLoading here — pollForUrl will
      } else {
        toast(result.error || "Failed to start tunnel", "error");
      }
    } catch (e) {
      toast(`Failed: ${e}`, "error");
    }
    setActionLoading("");
  };

  const stopTunnel = async () => {
    setActionLoading("stop");
    try {
      await invoke<CmdResult>("stop_tunnel");
      toast("Tunnel stopped", "success");
      setTunnelActive(false);
      setTunnelUrl("");
      setActiveProvider("");
    } catch {
      toast("Failed to stop tunnel", "error");
    }
    setActionLoading("");
  };

  const handleSiteSelect = (siteName: string) => {
    setSelectedSite(siteName);
    const site = sites.find((s) => s.name === siteName);
    if (site) {
      const ssl = site.ssl === "true";
      setPort(ssl ? "443" : "80");
      setProtocol(ssl ? "https" : "http");
    }
  };

  const copyUrl = () => {
    if (tunnelUrl) {
      navigator.clipboard.writeText(tunnelUrl);
      toast("URL copied to clipboard", "success");
    }
  };

  const providerInstalled = provider === "cloudflared" ? cfInstalled : ngInstalled;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tunnel</h1>
          <p className="page-subtitle">Expose local sites to the internet</p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : null} Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Active Tunnel */}
        {tunnelActive && (
          <div className="card" style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.06)" }}>
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%", background: "var(--green)",
                  boxShadow: "0 0 8px rgba(34,197,94,0.5)", display: "inline-block",
                }} />
                <div className="card-title">Tunnel Active — {activeProvider}</div>
              </div>
              <button
                className="btn btn-sm btn-danger"
                onClick={stopTunnel}
                disabled={!!actionLoading}
              >
                {actionLoading === "stop" ? <span className="spinner" /> : null} Stop Tunnel
              </button>
            </div>
            {tunnelUrl && (
              <div className="card-body" style={{ paddingTop: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code style={{
                    flex: 1, fontSize: 13, padding: "8px 12px",
                    background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-sm)",
                    color: "var(--teal)", fontWeight: 600,
                  }}>
                    {tunnelUrl}
                  </code>
                  <button className="btn btn-sm" onClick={copyUrl}>Copy</button>
                  <button className="btn btn-sm btn-primary" onClick={() => invoke("open_in_browser", { url: tunnelUrl })}>
                    Open
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Providers */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Tunneling Provider</div>
          </div>
          <div className="card-body">
            <div className="svc-grid">
              {[
                { id: "cloudflared", name: "Cloudflare Tunnel", desc: "Free, fast tunnels via Cloudflare. No account required.", installed: cfInstalled },
                { id: "ngrok", name: "ngrok", desc: "Popular tunneling service with custom domains and dashboard.", installed: ngInstalled },
              ].map((p) => (
                <div
                  key={p.id}
                  className={`svc-card${provider === p.id ? "" : " not-installed"}`}
                  style={{ cursor: "pointer", opacity: provider === p.id ? 1 : 0.6 }}
                  onClick={() => setProvider(p.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: "50%", display: "inline-block",
                        backgroundColor: provider === p.id ? "var(--teal)" : "var(--text-muted)",
                      }}
                    />
                    <div className="svc-card-name">{p.name}</div>
                    <span className={`badge ${p.installed ? "badge-installed" : "badge-stopped"}`} style={{ fontSize: 10, marginLeft: "auto" }}>
                      {p.installed ? "Installed" : "Not Installed"}
                    </span>
                  </div>
                  <div className="svc-card-version" style={{ color: "var(--text-dim)" }}>{p.desc}</div>
                  {!p.installed && (
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ marginTop: 8 }}
                      onClick={(e) => { e.stopPropagation(); installProvider(p.id === "cloudflared" ? "cloudflare/cloudflare/cloudflared" : "ngrok/ngrok/ngrok"); }}
                      disabled={!!installing}
                    >
                      {installing === p.id ? <span className="spinner" /> : null} Install {p.name}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Create Tunnel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Create Tunnel</div>
          </div>
          <div className="card-body">
            {!providerInstalled ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--text-dim)" }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  {provider === "cloudflared" ? "Cloudflare Tunnel" : "ngrok"} is not installed
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => installProvider(provider === "cloudflared" ? "cloudflare/cloudflare/cloudflared" : "ngrok/ngrok/ngrok")}
                  disabled={!!installing}
                >
                  {installing ? <span className="spinner" /> : null} Install Now
                </button>
              </div>
            ) : (
              <>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Site (optional)</label>
                    <select
                      className="form-select"
                      value={selectedSite}
                      onChange={(e) => handleSiteSelect(e.target.value)}
                    >
                      <option value="">Custom port...</option>
                      {sites.map((s) => (
                        <option key={s.name} value={s.name}>{s.name} ({s.domain})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Protocol</label>
                    <select
                      className="form-select"
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value)}
                    >
                      <option value="https">HTTPS</option>
                      <option value="http">HTTP</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Local Port</label>
                    <input
                      className="form-input"
                      type="text"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="443"
                    />
                  </div>

                  {provider === "ngrok" && (
                    <div className="form-group">
                      <label className="form-label">Subdomain (optional)</label>
                      <input
                        className="form-input"
                        type="text"
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value)}
                        placeholder="my-project"
                      />
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-primary"
                  onClick={startTunnel}
                  disabled={!!actionLoading || tunnelActive || !port}
                  style={{ marginTop: 8 }}
                >
                  {actionLoading === "start" ? <span className="spinner" /> : null} Start Tunnel
                </button>

                {actionLoading === "start" && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-dim)" }}>
                    Starting tunnel... This may take a few seconds.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">How It Works</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.8 }}>
              <div><strong style={{ color: "var(--text)" }}>Cloudflare Tunnel:</strong> Creates a secure tunnel without exposing ports. One-click install above.</div>
              <div style={{ marginTop: 6 }}><strong style={{ color: "var(--text)" }}>ngrok:</strong> Provides a public URL for your local server with dashboard.</div>
              <div style={{ marginTop: 10 }}>The tunnel forwards traffic from a public URL to your local port, making your development site accessible to anyone with the URL.</div>
              {provider === "ngrok" && (
                <div style={{ marginTop: 6 }}><strong style={{ color: "var(--text)" }}>Dashboard:</strong> When active, ngrok dashboard is at <code>http://localhost:4040</code></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
