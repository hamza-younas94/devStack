import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  state: string;
}

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

export default function Docker() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"containers" | "images">("containers");
  const [dockerInstalled, setDockerInstalled] = useState(true);

  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [pullImage, setPullImage] = useState("");
  const [pulling, setPulling] = useState(false);
  const [logsContainerId, setLogsContainerId] = useState("");
  const [logs, setLogs] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [installing, setInstalling] = useState(false);

  const checkDocker = useCallback(async () => {
    try {
      const installed = await invoke<boolean>("check_installed", { name: "docker" });
      setDockerInstalled(installed);
      return installed;
    } catch {
      setDockerInstalled(false);
      return false;
    }
  }, []);

  const fetchContainers = useCallback(async () => {
    setLoadingContainers(true);
    try {
      const list = await invoke<DockerContainer[]>("get_docker_containers");
      setContainers(list);
    } catch (err) {
      toast(String(err), "error");
      setContainers([]);
    }
    setLoadingContainers(false);
  }, [toast]);

  const fetchImages = useCallback(async () => {
    setLoadingImages(true);
    try {
      const list = await invoke<DockerImage[]>("get_docker_images");
      setImages(list);
    } catch (err) {
      toast(String(err), "error");
      setImages([]);
    }
    setLoadingImages(false);
  }, [toast]);

  useEffect(() => {
    checkDocker().then((installed) => {
      if (installed) {
        fetchContainers();
        fetchImages();
      }
    });
  }, [checkDocker, fetchContainers, fetchImages]);

  const handleContainerAction = async (containerId: string, action: "start" | "stop" | "restart") => {
    const key = `${containerId}-${action}`;
    setActionLoading(key);
    try {
      await invoke<CmdResult>("docker_action", { containerId, action });
      toast(`Container ${action}ed successfully`, "success");
      await fetchContainers();
    } catch (err) {
      toast(String(err), "error");
    }
    setActionLoading("");
  };

  const handleRemoveContainer = async (containerId: string) => {
    const key = `${containerId}-remove`;
    setActionLoading(key);
    try {
      await invoke<CmdResult>("docker_remove_container", { containerId, force: false });
      toast("Container removed", "success");
      await fetchContainers();
    } catch (err) {
      toast(String(err), "error");
    }
    setActionLoading("");
  };

  const handleViewLogs = async (containerId: string) => {
    if (logsContainerId === containerId) {
      setLogsContainerId("");
      setLogs("");
      return;
    }
    setLogsContainerId(containerId);
    setLogsLoading(true);
    try {
      const result = await invoke<string>("get_docker_logs", { containerId });
      setLogs(result);
    } catch (err) {
      setLogs(String(err));
    }
    setLogsLoading(false);
  };

  const handleRemoveImage = async (imageId: string) => {
    const key = `${imageId}-remove`;
    setActionLoading(key);
    try {
      await invoke<CmdResult>("docker_remove_image", { imageId });
      toast("Image removed", "success");
      await fetchImages();
    } catch (err) {
      toast(String(err), "error");
    }
    setActionLoading("");
  };

  const handlePullImage = async () => {
    const image = pullImage.trim();
    if (!image) return;
    setPulling(true);
    try {
      await invoke<CmdResult>("docker_pull_image", { image });
      toast(`Pulled ${image} successfully`, "success");
      setPullImage("");
      await fetchImages();
    } catch (err) {
      toast(String(err), "error");
    }
    setPulling(false);
  };

  const handleInstallDocker = async () => {
    setInstalling(true);
    toast("Installing Docker...", "info");
    try {
      const r = await invoke<CmdResult>("install_package", { formula: "docker" });
      if (r.success) {
        toast("Docker installed", "success");
        setDockerInstalled(true);
        fetchContainers();
        fetchImages();
      } else {
        toast(r.error || "Install failed", "error");
      }
    } catch (err) {
      toast(String(err), "error");
    }
    setInstalling(false);
  };

  if (!dockerInstalled) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Docker</h1>
          <p className="page-subtitle">Container management</p>
        </div>
        <div className="page-body">
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: "3rem" }}>
              <p style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Docker is not installed</p>
              <button className="btn btn-primary" onClick={handleInstallDocker} disabled={installing}>
                {installing ? <span className="spinner" /> : null}
                {installing ? "Installing..." : "Install Docker"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Docker</h1>
        <p className="page-subtitle">Manage containers and images</p>
      </div>
      <div className="page-body">
        <div className="tabs">
          <button
            className={`tab ${tab === "containers" ? "active" : ""}`}
            onClick={() => setTab("containers")}
          >
            Containers
          </button>
          <button
            className={`tab ${tab === "images" ? "active" : ""}`}
            onClick={() => setTab("images")}
          >
            Images
          </button>
        </div>

        {tab === "containers" && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Containers</h3>
              <button className="btn btn-xs btn-primary" onClick={fetchContainers} disabled={loadingContainers}>
                {loadingContainers ? <span className="spinner" /> : null}
                Refresh
              </button>
            </div>
            <div className="card-body">
              {loadingContainers && containers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <span className="spinner" />
                </div>
              ) : containers.length === 0 ? (
                <p>No containers found.</p>
              ) : (
                <>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th>Name</th>
                        <th>Image</th>
                        <th>Status</th>
                        <th>Ports</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {containers.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <span
                              className="badge"
                              style={{
                                display: "inline-block",
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: c.state === "running" ? "#22c55e" : "#6b7280",
                              }}
                            />
                          </td>
                          <td>{c.name}</td>
                          <td>{c.image}</td>
                          <td>{c.status}</td>
                          <td>{c.ports || "—"}</td>
                          <td>
                            {c.state === "running" ? (
                              <button
                                className="btn btn-xs btn-danger"
                                onClick={() => handleContainerAction(c.id, "stop")}
                                disabled={actionLoading === `${c.id}-stop`}
                              >
                                {actionLoading === `${c.id}-stop` ? <span className="spinner" /> : null}
                                Stop
                              </button>
                            ) : (
                              <button
                                className="btn btn-xs btn-success"
                                onClick={() => handleContainerAction(c.id, "start")}
                                disabled={actionLoading === `${c.id}-start`}
                              >
                                {actionLoading === `${c.id}-start` ? <span className="spinner" /> : null}
                                Start
                              </button>
                            )}
                            <button
                              className="btn btn-xs btn-primary"
                              style={{ marginLeft: 4 }}
                              onClick={() => handleContainerAction(c.id, "restart")}
                              disabled={actionLoading === `${c.id}-restart`}
                            >
                              {actionLoading === `${c.id}-restart` ? <span className="spinner" /> : null}
                              Restart
                            </button>
                            <button
                              className="btn btn-xs"
                              style={{ marginLeft: 4 }}
                              onClick={() => handleViewLogs(c.id)}
                            >
                              {logsContainerId === c.id ? "Hide Logs" : "Logs"}
                            </button>
                            <button
                              className="btn btn-xs btn-danger"
                              style={{ marginLeft: 4 }}
                              onClick={() => handleRemoveContainer(c.id)}
                              disabled={actionLoading === `${c.id}-remove`}
                            >
                              {actionLoading === `${c.id}-remove` ? <span className="spinner" /> : null}
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {logsContainerId && (
                    <div style={{ marginTop: "1rem" }}>
                      <h4>
                        Logs — {containers.find((c) => c.id === logsContainerId)?.name || logsContainerId}
                      </h4>
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

        {tab === "images" && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Images</h3>
              <button className="btn btn-xs btn-primary" onClick={fetchImages} disabled={loadingImages}>
                {loadingImages ? <span className="spinner" /> : null}
                Refresh
              </button>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
                <input
                  type="text"
                  placeholder="Image name (e.g. nginx:latest)"
                  value={pullImage}
                  onChange={(e) => setPullImage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePullImage()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handlePullImage} disabled={pulling || !pullImage.trim()}>
                  {pulling ? <span className="spinner" /> : null}
                  {pulling ? "Pulling..." : "Pull Image"}
                </button>
              </div>

              {loadingImages && images.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <span className="spinner" />
                </div>
              ) : images.length === 0 ? (
                <p>No images found.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Repository</th>
                      <th>Tag</th>
                      <th>Size</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {images.map((img) => (
                      <tr key={img.id}>
                        <td>{img.repository}</td>
                        <td>{img.tag}</td>
                        <td>{img.size}</td>
                        <td>{img.created}</td>
                        <td>
                          <button
                            className="btn btn-xs btn-danger"
                            onClick={() => handleRemoveImage(img.id)}
                            disabled={actionLoading === `${img.id}-remove`}
                          >
                            {actionLoading === `${img.id}-remove` ? <span className="spinner" /> : null}
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
