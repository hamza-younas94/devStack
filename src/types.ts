export interface CmdResult {
  success: boolean;
  output: string;
  error: string;
}

export interface ServiceStatus {
  name: string;
  display_name: string;
  status: string;
  version: string;
  pid: string;
  brew_name: string;
}

export interface DashboardData {
  services: ServiceStatus[];
  runtimes: ServiceStatus[];
  site_count: number;
  dns_ok: boolean;
  ca_ok: boolean;
}

export interface Site {
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
