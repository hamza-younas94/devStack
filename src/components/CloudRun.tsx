import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface GcloudStatus {
  gcloud_installed: boolean;
  docker_installed: boolean;
  project: string;
  account: string;
}

interface CloudRunService {
  name: string;
  region: string;
  url: string;
  status: string;
  last_deployed: string;
  revision: string;
}

const REGIONS = [
  "us-central1",
  "us-east1",
  "us-east4",
  "us-west1",
  "us-west2",
  "europe-west1",
  "europe-west2",
  "europe-north1",
  "asia-east1",
  "asia-northeast1",
  "asia-southeast1",
  "australia-southeast1",
];

const SITE_TYPES = ["php", "node", "python", "nextjs", "laravel", "django", "static"];

export default function CloudRun() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"services" | "deploy" | "settings">("services");

  // Gcloud status
  const [gcloudStatus, setGcloudStatus] = useState<GcloudStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Services tab
  const [region, setRegion] = useState("us-central1");
  const [services, setServices] = useState<CloudRunService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [logsService, setLogsService] = useState("");
  const [logs, setLogs] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);

  // Deploy tab
  const [siteName, setSiteName] = useState("");
  const [siteType, setSiteType] = useState("node");
  const [dockerfile, setDockerfile] = useState("");
  const [dockerfileLoading, setDockerfileLoading] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);
  const [deployProject, setDeployProject] = useState("");
  const [deployRegion, setDeployRegion] = useState("us-central1");
  const [serviceName, setServiceName] = useState("");
  const [envVars, setEnvVars] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployOutput, setDeployOutput] = useState("");

  // Settings tab
  const [settingProject, setSettingProject] = useState("");
  const [settingProjectLoading, setSettingProjectLoading] = useState(false);

  const checkGcloud = useCallback(async () => {
    setStatusLoading(true);
    try {
      const status = await invoke<GcloudStatus>("gcloud_check");
      setGcloudStatus(status);
      if (status.project) {
        setDeployProject(status.project);
        setSettingProject(status.project);
      }
    } catch {
      setGcloudStatus({ gcloud_installed: false, docker_installed: false, project: "", account: "" });
    }
    setStatusLoading(false);
  }, []);

  const fetchServices = useCallback(async () => {
    setServicesLoading(true);
    try {
      const list = await invoke<CloudRunService[]>("cloudrun_list_services", { region });
      setServices(list);
    } catch (err) {
      toast(String(err), "error");
      setServices([]);
    }
    setServicesLoading(false);
  }, [region, toast]);

  const fetchProjects = useCallback(async () => {
    try {
      const list = await invoke<string[]>("gcloud_list_projects");
      setProjects(list);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    checkGcloud();
  }, [checkGcloud]);

  useEffect(() => {
    if (gcloudStatus?.gcloud_installed) {
      fetchServices();
    }
  }, [gcloudStatus?.gcloud_installed, fetchServices]);

  useEffect(() => {
    if (gcloudStatus?.gcloud_installed && (tab === "deploy" || tab === "settings")) {
      fetchProjects();
    }
  }, [gcloudStatus?.gcloud_installed, tab, fetchProjects]);

  const handleViewLogs = async (name: string) => {
    if (logsService === name) {
      setLogsService("");
      setLogs("");
      return;
    }
    setLogsService(name);
    setLogsLoading(true);
    try {
      const result = await invoke<string>("cloudrun_get_logs", { serviceName: name, region });
      setLogs(result);
    } catch (err) {
      setLogs(String(err));
    }
    setLogsLoading(false);
  };

  const handleDeleteService = async (name: string) => {
    const key = `${name}-delete`;
    setActionLoading(key);
    try {
      await invoke("cloudrun_delete_service", { serviceName: name, region });
      toast(`Service "${name}" deleted`, "success");
      await fetchServices();
    } catch (err) {
      toast(String(err), "error");
    }
    setActionLoading("");
  };

  const handleGenerateDockerfile = async () => {
    if (!siteName.trim()) {
      toast("Enter a site name", "error");
      return;
    }
    setDockerfileLoading(true);
    try {
      const result = await invoke<string>("cloudrun_generate_dockerfile", { siteType, siteName: siteName.trim() });
      setDockerfile(result);
      toast("Dockerfile generated", "success");
    } catch (err) {
      toast(String(err), "error");
    }
    setDockerfileLoading(false);
  };

  const handleBuildAndDeploy = async () => {
    if (!siteName.trim() || !deployProject || !serviceName.trim()) {
      toast("Fill in site name, project, and service name", "error");
      return;
    }
    setDeploying(true);
    setDeployOutput("");
    try {
      const result = await invoke<string>("cloudrun_build_and_deploy", {
        siteName: siteName.trim(),
        project: deployProject,
        region: deployRegion,
        serviceName: serviceName.trim(),
        envVars: envVars.trim(),
      });
      setDeployOutput(result);
      toast("Build & deploy complete", "success");
    } catch (err) {
      setDeployOutput(String(err));
      toast("Build & deploy failed", "error");
    }
    setDeploying(false);
  };

  const handleSetProject = async () => {
    if (!settingProject) return;
    setSettingProjectLoading(true);
    try {
      await invoke("gcloud_set_project", { project: settingProject });
      toast(`Project set to ${settingProject}`, "success");
      await checkGcloud();
    } catch (err) {
      toast(String(err), "error");
    }
    setSettingProjectLoading(false);
  };

  const handleSiteNameChange = (value: string) => {
    setSiteName(value);
    if (!serviceName || serviceName === siteName) {
      setServiceName(value);
    }
  };

  if (statusLoading) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Cloud Run</h1>
          <p className="page-subtitle">Google Cloud Run management</p>
        </div>
        <div className="page-body">
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: "3rem" }}>
              <span className="spinner" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gcloudStatus?.gcloud_installed) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Cloud Run</h1>
          <p className="page-subtitle">Google Cloud Run management</p>
        </div>
        <div className="page-body">
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: "3rem" }}>
              <p style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Google Cloud SDK not installed</p>
              <p style={{ marginBottom: "1.5rem", color: "var(--text-dim)", fontSize: 13 }}>
                Install the gcloud CLI to manage Cloud Run services.
              </p>
              <a
                href="https://cloud.google.com/sdk/docs/install"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Install Instructions
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cloud Run</h1>
          <p className="page-subtitle">Google Cloud Run management</p>
        </div>
      </div>

      <div className="page-body">
        {/* Project / Account info */}
        <div className="info-banner" style={{ marginBottom: "1rem", display: "flex", gap: "1.5rem", fontSize: 13 }}>
          <span><strong>Project:</strong> {gcloudStatus.project || "None"}</span>
          <span><strong>Account:</strong> {gcloudStatus.account || "None"}</span>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "services" ? "active" : ""}`} onClick={() => setTab("services")}>
            Services
          </button>
          <button className={`tab ${tab === "deploy" ? "active" : ""}`} onClick={() => setTab("deploy")}>
            Deploy
          </button>
          <button className={`tab ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
            Settings
          </button>
        </div>

        {/* ── Services Tab ── */}
        {tab === "services" && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Services</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="form-select"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  style={{ width: "auto", minWidth: 160 }}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button className="btn btn-xs btn-primary" onClick={fetchServices} disabled={servicesLoading}>
                  {servicesLoading ? <span className="spinner" /> : null}
                  Refresh
                </button>
              </div>
            </div>
            <div className="card-body">
              {servicesLoading && services.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <span className="spinner" />
                </div>
              ) : services.length === 0 ? (
                <p style={{ color: "var(--text-dim)" }}>No Cloud Run services in this region</p>
              ) : (
                <>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th>Name</th>
                        <th>URL</th>
                        <th>Revision</th>
                        <th>Last Deployed</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((svc) => (
                        <tr key={svc.name}>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: svc.status === "Ready" ? "#22c55e" : "#6b7280",
                              }}
                            />
                          </td>
                          <td>{svc.name}</td>
                          <td>
                            {svc.url ? (
                              <a
                                href={svc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--teal)", fontSize: 12 }}
                              >
                                {svc.url}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td style={{ fontSize: 12 }}>{svc.revision}</td>
                          <td style={{ fontSize: 12 }}>{svc.last_deployed}</td>
                          <td>
                            <button
                              className="btn btn-xs"
                              onClick={() => handleViewLogs(svc.name)}
                            >
                              {logsService === svc.name ? "Hide Logs" : "View Logs"}
                            </button>
                            <button
                              className="btn btn-xs btn-danger"
                              style={{ marginLeft: 4 }}
                              onClick={() => handleDeleteService(svc.name)}
                              disabled={actionLoading === `${svc.name}-delete`}
                            >
                              {actionLoading === `${svc.name}-delete` ? <span className="spinner" /> : null}
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {logsService && (
                    <div style={{ marginTop: "1rem" }}>
                      <h4>Logs — {logsService}</h4>
                      {logsLoading ? (
                        <span className="spinner" />
                      ) : (
                        <pre className="config-editor" style={{ maxHeight: 400, overflow: "auto", whiteSpace: "pre-wrap" }}>
                          {logs || "No logs available."}
                        </pre>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Deploy Tab ── */}
        {tab === "deploy" && (
          <>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Configure Deployment</h3>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Site Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={siteName}
                    onChange={(e) => handleSiteNameChange(e.target.value)}
                    placeholder="my-app"
                  />
                  <span className="form-hint">Name of the site from ~/.devstack/sites/</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Site Type</label>
                  <select
                    className="form-select"
                    value={siteType}
                    onChange={(e) => setSiteType(e.target.value)}
                  >
                    {SITE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleGenerateDockerfile}
                  disabled={dockerfileLoading || !siteName.trim()}
                >
                  {dockerfileLoading ? <span className="spinner" /> : null}
                  Generate Dockerfile
                </button>

                {dockerfile && (
                  <div className="form-group" style={{ marginTop: "1rem" }}>
                    <label className="form-label">Generated Dockerfile</label>
                    <textarea
                      className="config-editor"
                      value={dockerfile}
                      onChange={(e) => setDockerfile(e.target.value)}
                      rows={16}
                      style={{ width: "100%", resize: "vertical" }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Deploy Settings</h3>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">GCP Project</label>
                  <select
                    className="form-select"
                    value={deployProject}
                    onChange={(e) => setDeployProject(e.target.value)}
                  >
                    <option value="">Select a project...</option>
                    {projects.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Region</label>
                  <select
                    className="form-select"
                    value={deployRegion}
                    onChange={(e) => setDeployRegion(e.target.value)}
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Service Name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="my-app"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Environment Variables</label>
                  <textarea
                    className="config-editor"
                    value={envVars}
                    onChange={(e) => setEnvVars(e.target.value)}
                    rows={5}
                    placeholder={"KEY=value\nDATABASE_URL=postgres://..."}
                    style={{ width: "100%", resize: "vertical" }}
                  />
                  <span className="form-hint">One KEY=VALUE per line</span>
                </div>

                <button
                  className="btn btn-success"
                  onClick={handleBuildAndDeploy}
                  disabled={deploying || !siteName.trim() || !deployProject || !serviceName.trim()}
                >
                  {deploying ? <span className="spinner" /> : null}
                  {deploying ? "Building & Deploying..." : "Build & Deploy"}
                </button>

                {deployOutput && (
                  <div style={{ marginTop: "1rem" }}>
                    <label className="form-label">Deploy Output</label>
                    <pre className="config-editor" style={{ maxHeight: 400, overflow: "auto", whiteSpace: "pre-wrap" }}>
                      {deployOutput}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Settings Tab ── */}
        {tab === "settings" && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Settings</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Current Account</label>
                <input
                  className="form-input"
                  type="text"
                  value={gcloudStatus.account || "Not logged in"}
                  disabled
                />
              </div>

              <div className="form-group">
                <label className="form-label">GCP Project</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    className="form-select"
                    value={settingProject}
                    onChange={(e) => setSettingProject(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select a project...</option>
                    {projects.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary"
                    onClick={handleSetProject}
                    disabled={settingProjectLoading || !settingProject}
                  >
                    {settingProjectLoading ? <span className="spinner" /> : null}
                    Set Project
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Docker Status</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: gcloudStatus.docker_installed ? "#22c55e" : "#ef4444",
                    }}
                  />
                  <span>{gcloudStatus.docker_installed ? "Docker is installed" : "Docker is not installed"}</span>
                </div>
              </div>

              {!gcloudStatus.docker_installed && (
                <div className="warning-banner">
                  Docker is required for building and deploying. Install it from{" "}
                  <a href="https://docs.docker.com/get-docker/" target="_blank" rel="noopener noreferrer">
                    docker.com
                  </a>{" "}
                  or use the Docker page in DevStack.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
