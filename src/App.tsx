import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Dashboard from "./components/Dashboard";
import Websites from "./components/Websites";
import DNS from "./components/DNS";
import SSL from "./components/SSL";
import Databases from "./components/Databases";
import Languages from "./components/Languages";
import Mail from "./components/Mail";
import WebServer from "./components/WebServer";
import Tunnel from "./components/Tunnel";
import AI from "./components/AI";
import Search from "./components/Search";
import ObjectStorage from "./components/ObjectStorage";
import Backup from "./components/Backup";
import Packages from "./components/Packages";
import Settings from "./components/Settings";
import Troubleshoot from "./components/Troubleshoot";
import Docker from "./components/Docker";
import Queues from "./components/Queues";
import CronJobs from "./components/CronJobs";
import CloudRun from "./components/CloudRun";
import DevTools from "./components/DevTools";

type Page =
  | "dashboard" | "websites" | "dns" | "ssl" | "databases"
  | "languages" | "mail" | "webserver" | "tunnel" | "ai"
  | "search" | "objectstorage" | "backup" | "packages"
  | "settings" | "troubleshoot" | "docker" | "queues" | "cronjobs"
  | "cloudrun" | "devtools";

interface NavItem {
  id: Page;
  icon: string;
  label: string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

const nav: NavGroup[] = [
  {
    section: "Overview",
    items: [
      { id: "dashboard", icon: "⊞", label: "Dashboard" },
    ],
  },
  {
    section: "Services",
    items: [
      { id: "websites", icon: "◎", label: "Websites" },
      { id: "dns", icon: "⊕", label: "DNS" },
      { id: "ssl", icon: "⛨", label: "SSL Certificates" },
      { id: "databases", icon: "⊡", label: "Databases" },
      { id: "languages", icon: "▸", label: "Languages" },
      { id: "mail", icon: "✉", label: "Mail" },
      { id: "webserver", icon: "⚙", label: "Web Servers" },
    ],
  },
  {
    section: "Advanced",
    items: [
      { id: "tunnel", icon: "⇋", label: "Tunnel" },
      { id: "cloudrun", icon: "☁", label: "Cloud Run" },
      { id: "docker", icon: "⬡", label: "Docker" },
      { id: "queues", icon: "⇶", label: "Queues" },
      { id: "cronjobs", icon: "⏱", label: "Cron Jobs" },
      { id: "ai", icon: "◈", label: "AI" },
      { id: "search", icon: "⊙", label: "Search" },
      { id: "objectstorage", icon: "▣", label: "Object Storage" },
      { id: "backup", icon: "⊟", label: "Backup" },
    ],
  },
  {
    section: "System",
    items: [
      { id: "devtools", icon: "⚒", label: "Dev Tools" },
      { id: "packages", icon: "⊞", label: "Packages" },
      { id: "settings", icon: "⚙", label: "Settings" },
      { id: "troubleshoot", icon: "⊘", label: "Troubleshoot" },
    ],
  },
];

const pageComponents: Record<Page, React.FC> = {
  dashboard: Dashboard,
  websites: Websites,
  dns: DNS,
  ssl: SSL,
  databases: Databases,
  languages: Languages,
  mail: Mail,
  webserver: WebServer,
  tunnel: Tunnel,
  ai: AI,
  search: Search,
  objectstorage: ObjectStorage,
  backup: Backup,
  packages: Packages,
  settings: Settings,
  troubleshoot: Troubleshoot,
  docker: Docker,
  queues: Queues,
  cronjobs: CronJobs,
  cloudrun: CloudRun,
  devtools: DevTools,
};

/* ── Onboarding Wizard ──────────────────────────────────── */

interface OnboardingStep {
  name: string;
  installed: boolean;
}

function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningStep, setRunningStep] = useState("");
  const [log, setLog] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke<[string, boolean][]>("check_onboarding_status");
        setSteps(result.map(([name, installed]) => ({ name, installed })));
      } catch { /* */ }
      setLoading(false);
    })();
  }, []);

  const runStep = async (stepId: string, label: string) => {
    setRunningStep(label);
    setLog((prev) => prev + `\n> Running: ${label}...\n`);
    try {
      const result = await invoke<CmdResult>("run_onboarding_step", { step: stepId });
      setLog((prev) => prev + (result.success ? result.output : result.error) + "\n");
      // Refresh status
      const updated = await invoke<[string, boolean][]>("check_onboarding_status");
      setSteps(updated.map(([name, installed]) => ({ name, installed })));
    } catch (e) {
      setLog((prev) => prev + `Error: ${e}\n`);
    }
    setRunningStep("");
  };

  const allDone = steps.every((s) => s.installed);

  if (loading) {
    return (
      <div className="onboarding-overlay">
        <div className="onboarding-card">
          <span className="spinner" /> Checking system...
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, letterSpacing: -1 }}>
          Welcome to <span style={{ color: "var(--accent)" }}>DevStack</span>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 20 }}>
          Let's set up your local development environment
        </div>

        <div style={{ marginBottom: 16 }}>
          {steps.map((s) => (
            <div key={s.name} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid var(--border)",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: s.installed ? "var(--green)" : "var(--red)",
                boxShadow: s.installed ? "0 0 6px rgba(34,197,94,0.4)" : "none",
                flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: 13 }}>{s.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: s.installed ? "var(--green)" : "var(--text-muted)",
              }}>
                {s.installed ? "Ready" : "Missing"}
              </span>
            </div>
          ))}
        </div>

        {!allDone && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Quick Setup
            </div>
            <div className="btn-group">
              <button className="btn btn-sm" onClick={() => runStep("dirs", "Create directories")} disabled={!!runningStep}>
                Create Dirs
              </button>
              <button className="btn btn-sm" onClick={() => runStep("essentials", "Install essentials")} disabled={!!runningStep}>
                Install Essentials
              </button>
              <button className="btn btn-sm" onClick={() => runStep("mkcert", "Setup SSL CA")} disabled={!!runningStep}>
                Setup SSL CA
              </button>
              <button className="btn btn-sm" onClick={() => runStep("dns", "Setup DNS")} disabled={!!runningStep}>
                Setup DNS
              </button>
              <button className="btn btn-sm" onClick={() => runStep("start", "Start services")} disabled={!!runningStep}>
                Start Services
              </button>
            </div>
            {runningStep && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--accent)", marginTop: 4 }}>
                <span className="spinner" /> {runningStep}...
              </div>
            )}
          </div>
        )}

        {log && (
          <div className="log-viewer" style={{ maxHeight: 150, marginBottom: 12, fontSize: 10 }}>
            {log}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onComplete}>Skip</button>
          {allDone && (
            <button className="btn btn-primary" onClick={onComplete}>
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main App ───────────────────────────────────────────── */

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [runningCount, setRunningCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const ActivePage = pageComponents[page];

  useEffect(() => {
    // Check if first run
    (async () => {
      try {
        const result = await invoke<[string, boolean][]>("check_onboarding_status");
        const missing = result.filter(([, ok]) => !ok);
        if (missing.length > 3) setShowOnboarding(true);
      } catch { /* */ }
    })();
  }, []);

  useEffect(() => {
    let busy = false;
    const fetchStatus = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        // Lightweight: just count running brew services instead of full get_dashboard
        const r = await invoke<CmdResult>("run_shell", { cmd: "brew services list 2>/dev/null | grep started | wc -l" });
        const running = parseInt(r.output.trim()) || 0;
        const r2 = await invoke<CmdResult>("run_shell", { cmd: "brew services list 2>/dev/null | tail -n +2 | wc -l" });
        const total = parseInt(r2.output.trim()) || 0;
        setRunningCount(running);
        setTotalCount(total);
      } catch {
        // ignore
      }
      busy = false;
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const allRunning = runningCount > 0 && runningCount === totalCount;

  return (
    <>
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <aside className="sidebar">
        <div className="sidebar-logo">
          DevStack <span>v2.0</span>
        </div>
        <div className="sidebar-nav">
          {nav.map((group) => (
            <div key={group.section}>
              <div className="sidebar-section">{group.section}</div>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={`sidebar-item ${page === item.id ? "active" : ""}`}
                  onClick={() => setPage(item.id)}
                >
                  <span className="icon">{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div
            className="sidebar-footer-dot"
            style={{
              background: allRunning ? "var(--green)" : "var(--yellow)",
              boxShadow: allRunning
                ? "0 0 6px rgba(34, 197, 94, 0.4)"
                : "0 0 6px rgba(234, 179, 8, 0.4)",
            }}
          />
          <span>
            {runningCount}/{totalCount} services running
          </span>
        </div>
      </aside>
      <main className="main">
        <ActivePage />
      </main>
    </>
  );
}
