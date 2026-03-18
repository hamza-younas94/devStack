import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

type Theme = "auto" | "light" | "dark";

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

interface AppSettings {
  launch_at_login: boolean;
  start_on_launch: boolean;
  stop_on_quit: boolean;
  theme: string;
  domain_suffix: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [startOnLaunch, setStartOnLaunch] = useState(true);
  const [stopOnQuit, setStopOnQuit] = useState(true);
  const [theme, setTheme] = useState<Theme>("dark");
  const [domainSuffix, setDomainSuffix] = useState(".test");
  const [tlds, setTlds] = useState<string[]>([]);
  const [newTld, setNewTld] = useState("");
  const [addingTld, setAddingTld] = useState(false);
  const [tab, setTab] = useState<"general" | "network" | "advanced" | "about">("general");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await invoke<AppSettings>("load_settings");
        setLaunchAtLogin(s.launch_at_login);
        setStartOnLaunch(s.start_on_launch);
        setStopOnQuit(s.stop_on_quit);
        setTheme(s.theme as Theme);
        setDomainSuffix(s.domain_suffix);
        applyTheme(s.theme as Theme);
      } catch { /* defaults */ }
    })();
  }, []);

  const applyTheme = (t: Theme) => {
    const resolved = t === "auto"
      ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : t;
    document.documentElement.setAttribute("data-theme", resolved);
  };

  // Auto-save with debounce
  const persistSettings = useCallback((overrides?: Partial<{ launch_at_login: boolean; start_on_launch: boolean; stop_on_quit: boolean; theme: string; domain_suffix: string }>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await invoke("save_settings", {
          settings: {
            launch_at_login: overrides?.launch_at_login ?? launchAtLogin,
            start_on_launch: overrides?.start_on_launch ?? startOnLaunch,
            stop_on_quit: overrides?.stop_on_quit ?? stopOnQuit,
            theme: overrides?.theme ?? theme,
            domain_suffix: overrides?.domain_suffix ?? domainSuffix,
          },
        });
        toast("Settings saved", "success");
      } catch {
        toast("Failed to save settings", "error");
      }
    }, 500);
  }, [launchAtLogin, startOnLaunch, stopOnQuit, theme, domainSuffix, toast]);

  const toggleLaunch = () => { const v = !launchAtLogin; setLaunchAtLogin(v); persistSettings({ launch_at_login: v }); };
  const toggleStart = () => { const v = !startOnLaunch; setStartOnLaunch(v); persistSettings({ start_on_launch: v }); };
  const toggleStop = () => { const v = !stopOnQuit; setStopOnQuit(v); persistSettings({ stop_on_quit: v }); };
  const changeTheme = (t: Theme) => { setTheme(t); applyTheme(t); persistSettings({ theme: t }); };
  const changeSuffix = (v: string) => { setDomainSuffix(v); persistSettings({ domain_suffix: v }); };

  const loadTlds = useCallback(async () => {
    try {
      const t = await invoke<string[]>("get_custom_tlds");
      setTlds(t);
    } catch { /* */ }
  }, []);

  useEffect(() => { loadTlds(); }, [loadTlds]);

  const addTld = async () => {
    if (!newTld.trim()) return;
    setAddingTld(true);
    try {
      await invoke<CmdResult>("add_custom_tld", { tld: newTld.trim().replace(/^\./, "") });
      setNewTld("");
      await loadTlds();
      toast("TLD added", "success");
    } catch {
      toast("Failed to add TLD", "error");
    }
    setAddingTld(false);
  };

  const resetAll = async () => {
    if (!confirm("This will stop all services and reset DevStack configuration. Continue?")) return;
    try {
      await invoke<CmdResult>("stop_services");
      toast("All services stopped", "success");
    } catch {
      toast("Failed to stop services", "error");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure DevStack preferences</p>
        </div>
      </div>

      <div className="page-body">
        <div className="tabs">
          {(["general", "network", "advanced", "about"] as const).map((t) => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Startup</div>
              </div>
              <div className="card-body">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Launch at Login</div>
                    <div className="settings-desc">Automatically start DevStack when you log in</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={launchAtLogin} onChange={toggleLaunch} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Start all services on launch</div>
                    <div className="settings-desc">Automatically start all services when DevStack opens</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={startOnLaunch} onChange={toggleStart} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Stop all services on quit</div>
                    <div className="settings-desc">Automatically stop all services when DevStack closes</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={stopOnQuit} onChange={toggleStop} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Appearance</div>
              </div>
              <div className="card-body">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Theme</div>
                    <div className="settings-desc">Choose your preferred color scheme</div>
                  </div>
                  <div className="appearance-options">
                    {(["auto", "light", "dark"] as Theme[]).map((t) => (
                      <button key={t} className={`appearance-option ${theme === t ? "active" : ""}`} onClick={() => changeTheme(t)}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "network" && (
          <>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Domain Configuration</div>
              </div>
              <div className="card-body">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Default domain suffix</div>
                    <div className="settings-desc">All new sites will use this suffix (e.g. myapp{domainSuffix})</div>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    value={domainSuffix}
                    onChange={(e) => changeSuffix(e.target.value)}
                    style={{ width: 100, textAlign: "center" }}
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">DNS resolver (dnsmasq)</div>
                    <div className="settings-desc">Resolves *{domainSuffix} domains to 127.0.0.1</div>
                  </div>
                  <span className="badge badge-running">Active</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Custom TLDs</div>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
                  Registered TLDs that resolve to localhost via /etc/resolver/:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {tlds.length === 0 ? (
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>No custom TLDs configured</span>
                  ) : (
                    tlds.map((t) => (
                      <span key={t} className="badge badge-installed" style={{ fontSize: 12, padding: "4px 10px" }}>
                        .{t}
                      </span>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-input"
                    placeholder="e.g. local, dev, app"
                    value={newTld}
                    onChange={(e) => setNewTld(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTld()}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={addTld} disabled={addingTld || !newTld.trim()}>
                    {addingTld ? <span className="spinner" /> : null} Add TLD
                  </button>
                </div>
                <div className="form-hint" style={{ marginTop: 6 }}>
                  Requires sudo. Creates /etc/resolver/[tld] pointing to 127.0.0.1
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Ports</div>
              </div>
              <div className="card-body">
                <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 2.2, color: "var(--text-dim)" }}>
                  <div><span style={{ color: "var(--text)" }}>HTTP:</span> 80</div>
                  <div><span style={{ color: "var(--text)" }}>HTTPS:</span> 443</div>
                  <div><span style={{ color: "var(--text)" }}>MySQL:</span> 3306</div>
                  <div><span style={{ color: "var(--text)" }}>PostgreSQL:</span> 5432</div>
                  <div><span style={{ color: "var(--text)" }}>Redis:</span> 6379</div>
                  <div><span style={{ color: "var(--text)" }}>MongoDB:</span> 27017</div>
                  <div><span style={{ color: "var(--text)" }}>Memcached:</span> 11211</div>
                  <div><span style={{ color: "var(--text)" }}>DNS:</span> 53</div>
                  <div><span style={{ color: "var(--text)" }}>Mail SMTP:</span> 1025</div>
                  <div><span style={{ color: "var(--text)" }}>Mail Web UI:</span> 8025</div>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "advanced" && (
          <>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Homebrew</div>
              </div>
              <div className="card-body">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Homebrew Prefix</div>
                    <div className="settings-desc">/opt/homebrew (Apple Silicon) or /usr/local (Intel)</div>
                  </div>
                  <span className="badge badge-installed">/opt/homebrew</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">Danger Zone</div>
              </div>
              <div className="card-body">
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Stop All Services</div>
                    <div className="settings-desc">Stop all running DevStack services immediately</div>
                  </div>
                  <button className="btn btn-danger" onClick={resetAll}>Stop All</button>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "about" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">About DevStack</div>
            </div>
            <div className="card-body">
              <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 2.4, color: "var(--text-dim)" }}>
                <div><span style={{ color: "var(--text)" }}>Version:</span> 2.0.0</div>
                <div><span style={{ color: "var(--text)" }}>Platform:</span> macOS (Tauri v2)</div>
                <div><span style={{ color: "var(--text)" }}>Config:</span> ~/.devstack</div>
                <div><span style={{ color: "var(--text)" }}>Logs:</span> ~/.devstack/logs</div>
                <div><span style={{ color: "var(--text)" }}>Certs:</span> ~/.devstack/certs</div>
                <div><span style={{ color: "var(--text)" }}>Backups:</span> ~/.devstack/backups</div>
                <div><span style={{ color: "var(--text)" }}>Sites:</span> ~/.devstack/sites.json</div>
                <div><span style={{ color: "var(--text)" }}>Nginx:</span> /opt/homebrew/etc/nginx/</div>
                <div style={{ marginTop: 16, color: "var(--text-muted)" }}>
                  DevStack is a local development environment manager for macOS.
                  Built with Tauri, React, and Homebrew.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
