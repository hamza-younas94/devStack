import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../ToastContext";

interface QueueInfo {
  name: string;
  queue_type: string;
  status: string;
  messages: string;
  consumers: string;
}

type Tab = "redis" | "rabbitmq";

export default function Queues() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("redis");
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [redisInstalled, setRedisInstalled] = useState<boolean | null>(null);
  const [rabbitmqInstalled, setRabbitmqInstalled] = useState<boolean | null>(null);
  const [installing, setInstalling] = useState(false);
  const [peekQueue, setPeekQueue] = useState("");
  const [peekItems, setPeekItems] = useState<string[]>([]);

  const checkRedisInstalled = useCallback(async () => {
    try {
      const installed = await invoke<boolean>("check_installed", { name: "redis" });
      setRedisInstalled(installed);
      return installed;
    } catch {
      setRedisInstalled(false);
      return false;
    }
  }, []);

  const checkRabbitmqInstalled = useCallback(async () => {
    try {
      const installed = await invoke<boolean>("check_installed", { name: "rabbitmq" });
      setRabbitmqInstalled(installed);
      return installed;
    } catch {
      setRabbitmqInstalled(false);
      return false;
    }
  }, []);

  const loadRedisQueues = useCallback(async () => {
    setLoading(true);
    setQueues([]);
    setPeekQueue("");
    setPeekItems([]);
    try {
      const installed = await checkRedisInstalled();
      if (installed) {
        const data = await invoke<QueueInfo[]>("get_redis_queues");
        setQueues(data);
      }
    } catch {
      toast("Failed to load Redis queues", "error");
    }
    setLoading(false);
  }, [checkRedisInstalled]);

  const loadRabbitmqQueues = useCallback(async () => {
    setLoading(true);
    setQueues([]);
    setPeekQueue("");
    setPeekItems([]);
    try {
      const installed = await checkRabbitmqInstalled();
      if (installed) {
        const data = await invoke<QueueInfo[]>("get_rabbitmq_queues");
        setQueues(data);
      }
    } catch {
      toast("Failed to load RabbitMQ queues", "error");
    }
    setLoading(false);
  }, [checkRabbitmqInstalled]);

  const refresh = useCallback(() => {
    if (activeTab === "redis") {
      loadRedisQueues();
    } else {
      loadRabbitmqQueues();
    }
  }, [activeTab, loadRedisQueues, loadRabbitmqQueues]);

  useEffect(() => {
    refresh();
  }, [activeTab]);

  const installPackage = async (formula: string) => {
    setInstalling(true);
    try {
      await invoke("install_package", { formula });
      toast(`${formula} installed successfully`, "success");
      refresh();
    } catch {
      toast(`Failed to install ${formula}`, "error");
    }
    setInstalling(false);
  };

  const handlePeek = async (queue: string) => {
    if (peekQueue === queue) {
      setPeekQueue("");
      setPeekItems([]);
      return;
    }
    setActionLoading(`peek-${queue}`);
    try {
      const result = await invoke<string[]>("redis_queue_action", {
        queue,
        action: "peek",
      });
      setPeekQueue(queue);
      setPeekItems(result);
      toast(`Showing first ${result.length} item(s) from ${queue}`, "info");
    } catch {
      toast(`Failed to peek queue ${queue}`, "error");
    }
    setActionLoading("");
  };

  const handleFlush = async (queue: string) => {
    setActionLoading(`flush-${queue}`);
    try {
      await invoke("redis_queue_action", {
        queue,
        action: "flush",
      });
      toast(`Queue ${queue} flushed`, "success");
      if (peekQueue === queue) {
        setPeekQueue("");
        setPeekItems([]);
      }
      await loadRedisQueues();
    } catch {
      toast(`Failed to flush queue ${queue}`, "error");
    }
    setActionLoading("");
  };

  const renderRedisTab = () => {
    if (redisInstalled === null && loading) {
      return (
        <div className="card">
          <div className="card-body">
            <div style={{ textAlign: "center", padding: 24 }}>
              <span className="spinner" /> Checking Redis status...
            </div>
          </div>
        </div>
      );
    }

    if (redisInstalled === false) {
      return (
        <div className="card">
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Redis is not installed</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Install Redis to manage queues from this interface.
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => installPackage("redis")}
                disabled={installing}
              >
                {installing ? <span className="spinner" /> : null} Install Redis
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Redis Queues</span>
          <button className="btn btn-xs" onClick={loadRedisQueues} disabled={loading}>
            {loading ? <span className="spinner" /> : null} Refresh
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <span className="spinner" /> Loading queues...
            </div>
          ) : queues.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
              No queues detected. Redis queues will appear here when your app creates them.
            </div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Queue Name</th>
                    <th style={{ width: 100 }}>Messages</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queues.map((q) => (
                    <>
                      <tr key={q.name}>
                        <td style={{ fontWeight: 500 }}>{q.name}</td>
                        <td>
                          <span className="badge">{q.messages}</span>
                        </td>
                        <td>
                          <span className={`badge ${q.status === "active" ? "badge-running" : "badge-stopped"}`}>
                            {q.status}
                          </span>
                        </td>
                        <td>
                          <div className="btn-group">
                            {actionLoading === `peek-${q.name}` ? (
                              <span className="spinner" />
                            ) : (
                              <button
                                className={`btn btn-xs ${peekQueue === q.name ? "btn-primary" : "btn-success"}`}
                                onClick={() => handlePeek(q.name)}
                                disabled={!!actionLoading}
                              >
                                {peekQueue === q.name ? "Hide" : "Peek"}
                              </button>
                            )}
                            {actionLoading === `flush-${q.name}` ? (
                              <span className="spinner" />
                            ) : (
                              <button
                                className="btn btn-xs btn-danger"
                                onClick={() => handleFlush(q.name)}
                                disabled={!!actionLoading}
                              >
                                Flush
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {peekQueue === q.name && (
                        <tr key={`${q.name}-peek`}>
                          <td colSpan={4} style={{ padding: 0 }}>
                            <div
                              style={{
                                background: "var(--bg-tertiary, rgba(0,0,0,0.1))",
                                padding: "12px 16px",
                                fontFamily: "monospace",
                                fontSize: 12,
                                lineHeight: 1.6,
                                maxHeight: 240,
                                overflowY: "auto",
                              }}
                            >
                              {peekItems.length === 0 ? (
                                <span style={{ color: "var(--text-dim)" }}>Queue is empty</span>
                              ) : (
                                peekItems.map((item, i) => (
                                  <div key={i} style={{ marginBottom: 4 }}>
                                    <span style={{ color: "var(--text-dim)", marginRight: 8 }}>{i + 1}.</span>
                                    {item}
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderRabbitmqTab = () => {
    if (rabbitmqInstalled === null && loading) {
      return (
        <div className="card">
          <div className="card-body">
            <div style={{ textAlign: "center", padding: 24 }}>
              <span className="spinner" /> Checking RabbitMQ status...
            </div>
          </div>
        </div>
      );
    }

    if (rabbitmqInstalled === false) {
      return (
        <div className="card">
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>RabbitMQ is not installed</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Install RabbitMQ to manage message queues from this interface.
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => installPackage("rabbitmq")}
                disabled={installing}
              >
                {installing ? <span className="spinner" /> : null} Install RabbitMQ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">RabbitMQ Queues</span>
          <button className="btn btn-xs" onClick={loadRabbitmqQueues} disabled={loading}>
            {loading ? <span className="spinner" /> : null} Refresh
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <span className="spinner" /> Loading queues...
            </div>
          ) : queues.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
              No queues found. RabbitMQ queues will appear here when your app creates them.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Queue Name</th>
                  <th style={{ width: 100 }}>Messages</th>
                  <th style={{ width: 100 }}>Consumers</th>
                  <th style={{ width: 100 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.name}>
                    <td style={{ fontWeight: 500 }}>{q.name}</td>
                    <td>
                      <span className="badge">{q.messages}</span>
                    </td>
                    <td>{q.consumers}</td>
                    <td>
                      <span className={`badge ${q.status === "running" ? "badge-running" : "badge-stopped"}`}>
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Queues</h1>
          <p className="page-subtitle">Manage Redis and RabbitMQ message queues</p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? <span className="spinner" /> : null} Refresh
        </button>
      </div>

      <div className="page-body">
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button
            className={`tab ${activeTab === "redis" ? "active" : ""}`}
            onClick={() => setActiveTab("redis")}
          >
            Redis Queues
          </button>
          <button
            className={`tab ${activeTab === "rabbitmq" ? "active" : ""}`}
            onClick={() => setActiveTab("rabbitmq")}
          >
            RabbitMQ
          </button>
        </div>

        {activeTab === "redis" && renderRedisTab()}
        {activeTab === "rabbitmq" && renderRabbitmqTab()}
      </div>
    </div>
  );
}
