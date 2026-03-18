use std::process::Command;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager,
};

#[derive(Serialize, Deserialize, Clone)]
pub struct CmdResult {
    pub success: bool,
    pub output: String,
    pub error: String,
}

fn devstack_home() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    format!("{}/.devstack", home)
}

fn run_shell(cmd: &str) -> CmdResult {
    let home = std::env::var("HOME").unwrap_or_default();
    let path = format!(
        "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:{}/.cargo/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        home
    );
    match Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .env("PATH", &path)
        .env("HOMEBREW_PREFIX", "/opt/homebrew")
        .output() {
        Ok(output) => CmdResult {
            success: output.status.success(),
            output: String::from_utf8_lossy(&output.stdout).to_string(),
            error: String::from_utf8_lossy(&output.stderr).to_string(),
        },
        Err(e) => CmdResult {
            success: false,
            output: String::new(),
            error: e.to_string(),
        },
    }
}

fn run_devstack(args: &[&str]) -> CmdResult {
    let home = std::env::var("HOME").unwrap_or_default();
    let path = format!(
        "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:{}/.cargo/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        home
    );
    let cli = format!("{}/devstack", devstack_home());
    match Command::new(&cli).args(args).env("PATH", &path).output() {
        Ok(output) => CmdResult {
            success: output.status.success(),
            output: String::from_utf8_lossy(&output.stdout).to_string(),
            error: String::from_utf8_lossy(&output.stderr).to_string(),
        },
        Err(e) => CmdResult {
            success: false,
            output: String::new(),
            error: e.to_string(),
        },
    }
}

// ── Dashboard ──────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct ServiceStatus {
    pub name: String,
    pub display_name: String,
    pub status: String,
    pub version: String,
    pub pid: String,
    pub brew_name: String,
}

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_usage: String,
    pub memory_used: String,
    pub memory_total: String,
    pub disk_used: String,
    pub disk_total: String,
    pub ip_address: String,
}

#[derive(Serialize)]
pub struct DashboardData {
    pub services: Vec<ServiceStatus>,
    pub runtimes: Vec<ServiceStatus>,
    pub site_count: usize,
    pub dns_ok: bool,
    pub ca_ok: bool,
}

#[tauri::command]
fn get_system_stats() -> SystemStats {
    // Single shell call for all system stats
    let out = run_shell(r#"
        cpu=$(ps -A -o %cpu | awk '{s+=$1} END {printf "%.1f", s/4}')
        mem_total=$(sysctl -n hw.memsize 2>/dev/null)
        mem_used=$(vm_stat 2>/dev/null | awk '/Pages (active|wired|compressed)/ {gsub(/\./, "", $NF); sum+=$NF} END {printf "%.1f", sum*4096/1073741824}')
        disk=$(df -h / 2>/dev/null | tail -1 | awk '{print $3"|"$2}')
        ip=$(ipconfig getifaddr en0 2>/dev/null || echo '127.0.0.1')
        echo "${cpu}|${mem_total}|${mem_used}|${disk}|${ip}"
    "#).output;
    let parts: Vec<&str> = out.trim().splitn(6, '|').collect();
    let cpu = parts.first().unwrap_or(&"0").to_string();
    let mem_total_gb = parts.get(1).unwrap_or(&"0").parse::<f64>().unwrap_or(0.0) / 1073741824.0;
    let mem_used = parts.get(2).unwrap_or(&"0").to_string();
    let disk_used = parts.get(3).unwrap_or(&"0").to_string();
    let disk_total = parts.get(4).unwrap_or(&"0").to_string();
    let ip = parts.get(5).unwrap_or(&"127.0.0.1").to_string();

    SystemStats {
        cpu_usage: if cpu.is_empty() { "0".into() } else { cpu },
        memory_used: format!("{:.1}", mem_used.parse::<f64>().unwrap_or(0.0)),
        memory_total: format!("{:.1}", mem_total_gb),
        disk_used,
        disk_total,
        ip_address: ip,
    }
}

#[tauri::command]
fn get_dashboard() -> DashboardData {
    // Single batched shell call for ALL version/status checks (~30 individual calls → 1)
    let batch = run_shell(r#"
        echo "===BREW==="
        brew services list 2>/dev/null
        echo "===VERSIONS==="
        echo "nginx|$(nginx -v 2>&1 | cut -d/ -f2)"
        echo "php|$(php -v 2>/dev/null | head -1 | awk '{print $2}')"
        echo "mysql|$(mysql --version 2>/dev/null | awk '{print $3}')"
        echo "postgresql|$(psql --version 2>/dev/null | awk '{print $3}')"
        echo "redis|$(redis-server --version 2>/dev/null | awk '{print $3}' | cut -d= -f2)"
        echo "===RUNTIMES==="
        echo "node|$(which node >/dev/null 2>&1 && echo ok || echo no)|$(node -v 2>/dev/null)"
        echo "python|$(which python3 >/dev/null 2>&1 && echo ok || echo no)|$(python3 --version 2>/dev/null | awk '{print $2}')"
        echo "go|$(which go >/dev/null 2>&1 && echo ok || echo no)|$(go version 2>/dev/null | awk '{print $3}' | sed 's/go//')"
        echo "java|$(which java >/dev/null 2>&1 && echo ok || echo no)|$(java -version 2>&1 | head -1 | awk -F'"' '{print $2}')"
        echo "ruby|$(which ruby >/dev/null 2>&1 && echo ok || echo no)|$(ruby -v 2>/dev/null | awk '{print $2}')"
        echo "rust|$(which rustc >/dev/null 2>&1 && echo ok || echo no)|$(rustc --version 2>/dev/null | awk '{print $2}')"
        echo "ollama|$(pgrep -x ollama >/dev/null 2>&1 && echo running || (which ollama >/dev/null 2>&1 && echo stopped || echo no))|$(ollama --version 2>/dev/null | awk '{print $NF}')|$(pgrep -x ollama 2>/dev/null | head -1)"
        echo "===PIDS==="
        echo "nginx|$(pgrep -f nginx 2>/dev/null | head -1)"
        echo "php|$(pgrep -f php-fpm 2>/dev/null | head -1)"
        echo "mysql|$(pgrep -f mysqld 2>/dev/null | head -1)"
        echo "postgresql|$(pgrep -f postgres 2>/dev/null | head -1)"
        echo "redis|$(pgrep -f redis-server 2>/dev/null | head -1)"
    "#).output;

    let mut brew_section = String::new();
    let mut versions: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    let mut rt_data: Vec<(String, String, String, String)> = Vec::new(); // name, status, version, pid
    let mut pids: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    let mut section = "";

    for line in batch.lines() {
        let l = line.trim();
        if l == "===BREW===" { section = "brew"; continue; }
        if l == "===VERSIONS===" { section = "ver"; continue; }
        if l == "===RUNTIMES===" { section = "rt"; continue; }
        if l == "===PIDS===" { section = "pid"; continue; }

        match section {
            "brew" => { brew_section.push_str(l); brew_section.push('\n'); },
            "ver" => {
                let parts: Vec<&str> = l.splitn(2, '|').collect();
                if parts.len() == 2 { versions.insert(parts[0].to_string(), parts[1].to_string()); }
            },
            "rt" => {
                let parts: Vec<&str> = l.splitn(4, '|').collect();
                if parts.len() >= 3 {
                    rt_data.push((
                        parts[0].to_string(),
                        parts[1].to_string(),
                        parts[2].to_string(),
                        parts.get(3).unwrap_or(&"").to_string(),
                    ));
                }
            },
            "pid" => {
                let parts: Vec<&str> = l.splitn(2, '|').collect();
                if parts.len() == 2 && !parts[1].is_empty() {
                    pids.insert(parts[0].to_string(), parts[1].to_string());
                }
            },
            _ => {},
        }
    }

    let make_svc = |name: &str, display: &str, brew: &str| -> ServiceStatus {
        let running = brew_section.lines().any(|l| l.contains(name) && l.contains("started"));
        ServiceStatus {
            name: name.into(),
            display_name: display.into(),
            status: if running { "running".into() } else { "stopped".into() },
            version: versions.get(name).cloned().unwrap_or_default(),
            pid: if running { pids.get(name).cloned().unwrap_or_default() } else { String::new() },
            brew_name: brew.into(),
        }
    };

    let services = vec![
        make_svc("nginx", "NGINX", "nginx"),
        make_svc("php", "PHP", "php"),
        make_svc("mysql", "MySQL", "mysql"),
        make_svc("postgresql", "PostgreSQL", "postgresql@17"),
        make_svc("redis", "Redis", "redis"),
    ];

    let rt_names = [("node", "Node.js"), ("python", "Python"), ("go", "Go"), ("java", "Java"), ("ruby", "Ruby"), ("rust", "Rust")];
    let mut runtimes: Vec<ServiceStatus> = Vec::new();
    for (name, display) in &rt_names {
        if let Some((_, status, version, _)) = rt_data.iter().find(|(n, _, _, _)| n == name) {
            runtimes.push(ServiceStatus {
                name: name.to_string(),
                display_name: display.to_string(),
                status: if status == "ok" { "available".into() } else { "not installed".into() },
                version: version.clone(),
                pid: String::new(),
                brew_name: String::new(),
            });
        }
    }

    // Ollama
    if let Some((_, status, version, pid)) = rt_data.iter().find(|(n, _, _, _)| n == "ollama") {
        runtimes.push(ServiceStatus {
            name: "ollama".into(),
            display_name: "Ollama".into(),
            status: status.clone(),
            version: version.clone(),
            pid: pid.clone(),
            brew_name: "ollama".into(),
        });
    }

    let sites_json = format!("{}/sites.json", devstack_home());
    let site_count = if let Ok(data) = std::fs::read_to_string(&sites_json) {
        serde_json::from_str::<Vec<serde_json::Value>>(&data).map(|v| v.len()).unwrap_or(0)
    } else { 0 };

    DashboardData {
        services,
        runtimes,
        site_count,
        dns_ok: std::path::Path::new("/etc/resolver/test").exists(),
        ca_ok: std::path::Path::new("/opt/homebrew/bin/mkcert").exists(),
    }
}

// ── Requirements ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct Requirements {
    pub nginx: bool,
    pub php_fpm: bool,
    pub mysql: bool,
    pub postgres: bool,
    pub redis: bool,
    pub node: bool,
    pub python: bool,
    pub go_lang: bool,
    pub dns: bool,
    pub ssl_ca: bool,
}

#[tauri::command]
fn check_requirements() -> Requirements {
    let brew = run_shell("brew services list 2>/dev/null").output;
    let is_running = |name: &str| brew.lines().any(|l| l.contains(name) && l.contains("started"));
    Requirements {
        nginx: is_running("nginx") || run_shell("pgrep -qf nginx").success,
        php_fpm: is_running("php"),
        mysql: is_running("mysql"),
        postgres: is_running("postgresql"),
        redis: is_running("redis"),
        node: run_shell("which node").success,
        python: run_shell("which python3").success,
        go_lang: run_shell("which go").success,
        dns: std::path::Path::new("/etc/resolver/test").exists(),
        ssl_ca: run_shell("which mkcert").success,
    }
}

// ── Sites ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct Site {
    pub name: String, pub domain: String, pub root: String, pub php: String,
    pub ssl: String, pub site_type: String, pub port: String,
    pub database: String, pub db_type: String,
    pub cors_enabled: String, pub cors_origin: String,
    pub node_version: String, pub python_version: String, pub custom_nginx: String,
    pub created: String,
}

#[tauri::command]
fn get_sites() -> Vec<Site> {
    let sites_json = format!("{}/sites.json", devstack_home());
    let result = run_shell(&format!("cat '{}' 2>/dev/null || echo '{{}}'", sites_json));
    let json: serde_json::Value = serde_json::from_str(&result.output).unwrap_or_default();
    let mut sites = Vec::new();
    if let Some(obj) = json.as_object() {
        for (name, v) in obj {
            sites.push(Site {
                name: name.clone(),
                domain: v["domain"].as_str().unwrap_or("").into(),
                root: v["root"].as_str().unwrap_or("").into(),
                php: v["php"].as_str().unwrap_or("8.3").into(),
                ssl: v["ssl"].as_str().unwrap_or("true").into(),
                site_type: v["type"].as_str().unwrap_or("php").into(),
                port: v["port"].as_str().unwrap_or("").into(),
                database: v["database"].as_str().unwrap_or("").into(),
                db_type: v["db_type"].as_str().unwrap_or("").into(),
                cors_enabled: v["cors_enabled"].as_str().unwrap_or("true").into(),
                cors_origin: v["cors_origin"].as_str().unwrap_or("*").into(),
                node_version: v["node_version"].as_str().unwrap_or("").into(),
                python_version: v["python_version"].as_str().unwrap_or("").into(),
                custom_nginx: v["custom_nginx"].as_str().unwrap_or("").into(),
                created: v["created"].as_str().unwrap_or("").into(),
            });
        }
    }
    sites
}

#[tauri::command]
fn create_site(
    name: String, site_type: String, domain: String, root: String,
    php: String, port: String, ssl: bool,
    db_type: String, db_name: String, cors_enabled: bool, cors_origin: String,
    node_version: String, python_version: String, custom_nginx: String,
) -> CmdResult {
    let mut args = vec!["create", &name, "--type", &site_type];
    if !domain.is_empty() { args.extend(&["--domain", &domain]); }
    if !root.is_empty() { args.extend(&["--root", &root]); }
    if !php.is_empty() { args.extend(&["--php", &php]); }
    if !port.is_empty() { args.extend(&["--port", &port]); }
    if !ssl { args.push("--no-ssl"); }
    if !db_type.is_empty() { args.extend(&["--db", &db_type]); }
    if !db_name.is_empty() { args.extend(&["--db-name", &db_name]); }
    if !cors_enabled { args.push("--no-cors"); }
    if !cors_origin.is_empty() && cors_origin != "*" { args.extend(&["--cors-origin", &cors_origin]); }
    if !node_version.is_empty() { args.extend(&["--node-version", &node_version]); }
    if !python_version.is_empty() { args.extend(&["--python-version", &python_version]); }
    if !custom_nginx.is_empty() { args.extend(&["--custom-nginx", &custom_nginx]); }
    run_devstack(&args)
}

#[tauri::command]
fn edit_site(
    name: String, domain: String, site_type: String, php: String,
    port: String, ssl: String, db_type: String, db_name: String,
    cors_enabled: String, cors_origin: String,
    node_version: String, python_version: String, custom_nginx: String,
) -> CmdResult {
    let mut args = vec!["edit", &name];
    if !domain.is_empty() { args.extend(&["--domain", &domain]); }
    if !site_type.is_empty() { args.extend(&["--type", &site_type]); }
    if !php.is_empty() { args.extend(&["--php", &php]); }
    if !port.is_empty() { args.extend(&["--port", &port]); }
    if !ssl.is_empty() { args.extend(&["--ssl", &ssl]); }
    if !db_type.is_empty() { args.extend(&["--db", &db_type]); }
    if !db_name.is_empty() { args.extend(&["--db-name", &db_name]); }
    if !cors_enabled.is_empty() { args.extend(&["--cors", &cors_enabled]); }
    if !cors_origin.is_empty() { args.extend(&["--cors-origin", &cors_origin]); }
    if !node_version.is_empty() { args.extend(&["--node-version", &node_version]); }
    if !python_version.is_empty() { args.extend(&["--python-version", &python_version]); }
    if !custom_nginx.is_empty() { args.extend(&["--custom-nginx", &custom_nginx]); }
    run_devstack(&args)
}

#[tauri::command]
fn delete_site(name: String) -> CmdResult {
    let cli = format!("{}/devstack", devstack_home());
    run_shell(&format!("echo 'n' | '{}' delete '{}'", cli, name))
}

#[tauri::command]
fn open_in_browser(url: String) -> CmdResult { run_shell(&format!("open '{}'", url)) }

#[tauri::command]
fn open_in_editor(path: String) -> CmdResult {
    if run_shell("which code").success { run_shell(&format!("code '{}'", path)) }
    else { run_shell(&format!("open '{}'", path)) }
}

#[tauri::command]
fn open_in_terminal(path: String) -> CmdResult {
    run_shell(&format!("open -a Terminal '{}'", path))
}

#[tauri::command]
fn reload_nginx() -> CmdResult { run_shell("nginx -s reload 2>&1") }

// ── Services ───────────────────────────────────────────────────────

#[tauri::command]
fn start_services() -> CmdResult { run_devstack(&["start"]) }

#[tauri::command]
fn stop_services() -> CmdResult { run_devstack(&["stop"]) }

#[tauri::command]
fn restart_service(name: String) -> CmdResult { run_shell(&format!("brew services restart {} 2>&1", name)) }

#[tauri::command]
fn toggle_service(name: String, action: String) -> CmdResult {
    run_shell(&format!("brew services {} {} 2>&1", action, name))
}

// ── Packages ───────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct PackageInfo {
    pub name: String,
    pub version: String,
    pub status: String,
    pub pid: String,
    pub category: String,
}

#[tauri::command]
fn get_packages() -> Vec<PackageInfo> {
    let brew = run_shell("brew services list 2>/dev/null").output;
    let is_running = |n: &str| brew.lines().any(|l| l.contains(n) && l.contains("started"));
    let get_pid = |n: &str| -> String {
        if is_running(n) { run_shell(&format!("pgrep -f {} 2>/dev/null | head -1", n)).output.trim().to_string() }
        else { String::new() }
    };
    let installed = |n: &str| run_shell(&format!("which {} 2>/dev/null", n)).success || run_shell(&format!("brew list {} 2>/dev/null", n)).success;

    let mut pkgs = Vec::new();

    // Services
    let svc = |name: &str, ver_cmd: &str, cat: &str| -> PackageInfo {
        let v = run_shell(ver_cmd).output.trim().to_string();
        let inst = !v.is_empty() || installed(name);
        PackageInfo {
            name: name.into(), version: if v.is_empty() { "—".into() } else { v },
            status: if is_running(name) { "Running".into() } else if inst { "Stopped".into() } else { "Not Installed".into() },
            pid: get_pid(name), category: cat.into(),
        }
    };

    // Web Server
    pkgs.push(svc("nginx", "nginx -v 2>&1 | cut -d/ -f2", "Web Server"));

    // Databases
    pkgs.push(svc("mysql", "mysql --version 2>/dev/null | awk '{print $3}'", "Databases"));
    pkgs.push(PackageInfo {
        name: "mariadb".into(),
        version: run_shell("mariadb --version 2>/dev/null | awk '{print $5}' | tr -d ','").output.trim().to_string(),
        status: if is_running("mariadb") { "Running".into() } else if installed("mariadb") { "Stopped".into() } else { "Not Installed".into() },
        pid: get_pid("mariadb"), category: "Databases".into(),
    });
    pkgs.push(PackageInfo {
        name: "postgresql".into(),
        version: run_shell("psql --version 2>/dev/null | awk '{print $3}'").output.trim().to_string(),
        status: if is_running("postgresql") { "Running".into() } else if installed("psql") { "Stopped".into() } else { "Not Installed".into() },
        pid: get_pid("postgresql"), category: "Databases".into(),
    });
    pkgs.push(PackageInfo {
        name: "mongodb".into(),
        version: run_shell("mongod --version 2>/dev/null | head -1 | awk '{print $3}' | tr -d 'v'").output.trim().to_string(),
        status: if is_running("mongod") { "Running".into() } else if installed("mongod") { "Stopped".into() } else { "Not Installed".into() },
        pid: get_pid("mongod"), category: "Databases".into(),
    });
    pkgs.push(svc("redis", "redis-server --version 2>/dev/null | awk '{print $3}' | cut -d= -f2", "Databases"));
    pkgs.push(PackageInfo {
        name: "memcached".into(),
        version: run_shell("memcached -h 2>/dev/null | head -1 | awk '{print $2}'").output.trim().to_string(),
        status: if is_running("memcached") { "Running".into() } else if installed("memcached") { "Stopped".into() } else { "Not Installed".into() },
        pid: get_pid("memcached"), category: "Databases".into(),
    });

    // Languages
    pkgs.push(svc("php", "php -v 2>/dev/null | head -1 | awk '{print $2}'", "Languages"));
    let rt = |name: &str, which: &str, ver_cmd: &str| -> PackageInfo {
        let v = run_shell(ver_cmd).output.trim().to_string();
        PackageInfo {
            name: name.into(), version: if v.is_empty() { "—".into() } else { v },
            status: if installed(which) { "Installed".into() } else { "Not Installed".into() },
            pid: String::new(), category: "Languages".into(),
        }
    };
    pkgs.push(rt("node", "node", "node -v 2>/dev/null"));
    pkgs.push(rt("python", "python3", "python3 --version 2>/dev/null | awk '{print $2}'"));
    pkgs.push(rt("go", "go", "go version 2>/dev/null | awk '{print $3}' | sed 's/go//'"));
    pkgs.push(rt("java", "java", "java -version 2>&1 | head -1 | awk -F'\"' '{print $2}'"));
    pkgs.push(rt("ruby", "ruby", "ruby -v 2>/dev/null | awk '{print $2}'"));
    pkgs.push(rt("rust", "rustc", "rustc --version 2>/dev/null | awk '{print $2}'"));
    pkgs.push(rt("dotnet", "dotnet", "dotnet --version 2>/dev/null"));

    // Common Services
    pkgs.push(svc("dnsmasq", "dnsmasq --version 2>/dev/null | head -1 | awk '{print $3}'", "Common Services"));
    pkgs.push(PackageInfo {
        name: "mkcert".into(),
        version: run_shell("mkcert --version 2>/dev/null").output.trim().to_string(),
        status: if installed("mkcert") { "Installed".into() } else { "Not Installed".into() },
        pid: String::new(), category: "Common Services".into(),
    });

    // Dev Tools
    let tool = |name: &str, which: &str, ver_cmd: &str| -> PackageInfo {
        let v = run_shell(ver_cmd).output.trim().to_string();
        PackageInfo {
            name: name.into(), version: if v.is_empty() { "—".into() } else { v },
            status: if installed(which) { "Installed".into() } else { "Not Installed".into() },
            pid: String::new(), category: "Dev Tools".into(),
        }
    };
    pkgs.push(tool("git", "git", "git --version 2>/dev/null | awk '{print $3}'"));
    pkgs.push(tool("composer", "composer", "composer --version 2>/dev/null | awk '{print $3}'"));
    pkgs.push(tool("npm", "npm", "npm -v 2>/dev/null"));
    pkgs.push(tool("pnpm", "pnpm", "pnpm -v 2>/dev/null"));
    pkgs.push(tool("yarn", "yarn", "yarn -v 2>/dev/null"));
    pkgs.push(tool("openssl", "openssl", "openssl version 2>/dev/null | awk '{print $2}'"));
    pkgs.push(tool("curl", "curl", "curl --version 2>/dev/null | head -1 | awk '{print $2}'"));
    pkgs.push(tool("svn", "svn", "svn --version 2>/dev/null | head -1 | awk '{print $3}'"));

    // AI
    pkgs.push(PackageInfo {
        name: "ollama".into(),
        version: run_shell("ollama --version 2>/dev/null | awk '{print $NF}'").output.trim().to_string(),
        status: if run_shell("pgrep -x ollama").success { "Running".into() }
                else if installed("ollama") { "Stopped".into() }
                else { "Not Installed".into() },
        pid: if run_shell("pgrep -x ollama").success { run_shell("pgrep -x ollama | head -1").output.trim().to_string() } else { String::new() },
        category: "AI".into(),
    });

    // Search
    pkgs.push(PackageInfo {
        name: "meilisearch".into(),
        version: run_shell("meilisearch --version 2>/dev/null | awk '{print $2}'").output.trim().to_string(),
        status: if is_running("meilisearch") { "Running".into() } else if installed("meilisearch") { "Stopped".into() } else { "Not Installed".into() },
        pid: get_pid("meilisearch"), category: "Search".into(),
    });

    // Object Storage
    pkgs.push(PackageInfo {
        name: "minio".into(),
        version: run_shell("minio --version 2>/dev/null | head -1 | awk '{print $3}'").output.trim().to_string(),
        status: if is_running("minio") { "Running".into() } else if installed("minio") { "Stopped".into() } else { "Not Installed".into() },
        pid: get_pid("minio"), category: "Object Storage".into(),
    });

    pkgs
}

// ── DNS ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DnsEntry {
    pub domain: String,
    pub ip: String,
    pub source: String,
}

#[tauri::command]
fn get_dns_entries() -> Vec<DnsEntry> {
    let mut entries = Vec::new();
    // Read /etc/hosts
    let hosts = run_shell("cat /etc/hosts 2>/dev/null").output;
    for line in hosts.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') { continue; }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            for domain in &parts[1..] {
                entries.push(DnsEntry {
                    domain: domain.to_string(),
                    ip: parts[0].to_string(),
                    source: "hosts".into(),
                });
            }
        }
    }
    // Check dnsmasq
    let dnsmasq_conf = run_shell("cat /opt/homebrew/etc/dnsmasq.conf 2>/dev/null").output;
    for line in dnsmasq_conf.lines() {
        if line.starts_with("address=") {
            let parts: Vec<&str> = line.trim_start_matches("address=").split('/').collect();
            if parts.len() >= 3 {
                entries.push(DnsEntry {
                    domain: format!("*.{}", parts[1]),
                    ip: parts[2].to_string(),
                    source: "dnsmasq".into(),
                });
            }
        }
    }
    entries
}

// ── SSL ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SslCert {
    pub domain: String,
    pub cert_path: String,
    pub key_path: String,
    pub exists: bool,
}

#[tauri::command]
fn get_ssl_certs() -> Vec<SslCert> {
    let certs_dir = format!("{}/certs", devstack_home());
    let result = run_shell(&format!("ls '{}'/*.pem 2>/dev/null | grep -v '\\-key'", certs_dir));
    let mut certs = Vec::new();
    for line in result.output.lines() {
        let path = line.trim();
        if path.is_empty() { continue; }
        let domain = path.split('/').last().unwrap_or("").replace(".pem", "");
        let key = path.replace(".pem", "-key.pem");
        certs.push(SslCert {
            domain: domain.clone(),
            cert_path: path.to_string(),
            key_path: key.clone(),
            exists: std::path::Path::new(&key).exists(),
        });
    }
    certs
}

#[tauri::command]
fn create_ssl_cert(domain: String) -> CmdResult {
    let certs_dir = format!("{}/certs", devstack_home());
    run_shell(&format!(
        "mkdir -p '{}' && cd '{}' && mkcert '{}' 2>&1",
        certs_dir, certs_dir, domain
    ))
}

#[tauri::command]
fn delete_ssl_cert(domain: String) -> CmdResult {
    let certs_dir = format!("{}/certs", devstack_home());
    run_shell(&format!(
        "rm -f '{}/{}.pem' '{}/{}-key.pem' 2>&1",
        certs_dir, domain, certs_dir, domain
    ))
}

// ── Hosts ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_hosts_file() -> CmdResult {
    run_shell("cat /etc/hosts 2>/dev/null")
}

#[tauri::command]
fn add_host_entry(ip: String, domain: String) -> CmdResult {
    // Check if entry already exists
    let check = run_shell(&format!("grep -q '{}' /etc/hosts 2>/dev/null", domain));
    if check.success {
        return CmdResult { success: true, output: "Entry already exists".into(), error: String::new() };
    }
    run_shell(&format!(
        "echo '{} {}' | sudo tee -a /etc/hosts > /dev/null 2>&1",
        ip, domain
    ))
}

#[tauri::command]
fn remove_host_entry(domain: String) -> CmdResult {
    run_shell(&format!(
        "sudo sed -i '' '/{}/d' /etc/hosts 2>&1",
        domain
    ))
}

// ── PHP ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_php_versions() -> Vec<ServiceStatus> {
    let result = run_shell("brew list --formula 2>/dev/null | grep '^php'");
    let active = run_shell("php -v 2>/dev/null | head -1").output;
    let mut versions = Vec::new();
    for pkg in result.output.lines() {
        let ver = run_shell(&format!("brew info {} --json 2>/dev/null | jq -r '.[0].installed[0].version'", pkg))
            .output.trim().to_string();
        let is_active = active.contains(&ver.split('_').next().unwrap_or(""));
        versions.push(ServiceStatus {
            name: pkg.to_string(), display_name: pkg.to_string(),
            status: if is_active { "active".into() } else { "installed".into() },
            version: ver, pid: String::new(), brew_name: pkg.to_string(),
        });
    }
    versions
}

#[tauri::command]
fn switch_php(version: String) -> CmdResult { run_devstack(&["php", "switch", &version]) }

// ── Multi-Version Management ────────────────────────────────────────

#[derive(Serialize)]
pub struct VersionInfo {
    pub formula: String,
    pub version: String,
    pub installed: bool,
    pub active: bool,
    pub running: bool,
}

#[tauri::command]
fn get_installed_versions(package: String) -> Vec<VersionInfo> {
    // List installed brew formulae matching the package name
    let installed = run_shell(&format!(
        "brew list --formula 2>/dev/null | grep -E '^{}(@|$)'", package
    )).output;
    let brew_services = run_shell("brew services list 2>/dev/null").output;

    let mut versions = Vec::new();
    for formula in installed.lines() {
        let formula = formula.trim();
        if formula.is_empty() { continue; }
        let ver = run_shell(&format!(
            "brew info {} --json 2>/dev/null | jq -r '.[0].installed[0].version' 2>/dev/null", formula
        )).output.trim().to_string();
        let running = brew_services.lines().any(|l| l.contains(formula) && l.contains("started"));
        // Detect active version for runtimes
        let active = match package.as_str() {
            "php" => {
                let active_ver = run_shell("php -v 2>/dev/null | head -1").output;
                active_ver.contains(&ver.split('_').next().unwrap_or(""))
            },
            "node" => {
                let active_ver = run_shell("node -v 2>/dev/null").output;
                active_ver.contains(&ver.split('_').next().unwrap_or(""))
            },
            "python" | "python3" => {
                let active_ver = run_shell("python3 --version 2>/dev/null").output;
                active_ver.contains(&ver.split('_').next().unwrap_or(""))
            },
            _ => running,
        };
        versions.push(VersionInfo {
            formula: formula.to_string(),
            version: ver,
            installed: true,
            active,
            running,
        });
    }
    versions
}

#[tauri::command]
fn get_available_versions(package: String) -> Vec<String> {
    // Search brew for available versioned formulae
    let result = run_shell(&format!(
        "brew search '/^{}@/' 2>/dev/null", package
    ));
    let mut versions: Vec<String> = result.output.lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && !l.starts_with("="))
        .collect();
    // Also add the unversioned formula
    let base_exists = run_shell(&format!("brew info {} 2>/dev/null", package)).success;
    if base_exists && !versions.contains(&package) {
        versions.insert(0, package);
    }
    versions
}

#[tauri::command]
fn install_package(formula: String) -> CmdResult {
    run_shell(&format!("brew install {} 2>&1", formula))
}

#[tauri::command]
fn uninstall_package(formula: String) -> CmdResult {
    run_shell(&format!("brew uninstall {} 2>&1", formula))
}

#[tauri::command]
fn start_package(formula: String) -> CmdResult {
    run_shell(&format!("brew services start {} 2>&1", formula))
}

#[tauri::command]
fn stop_package(formula: String) -> CmdResult {
    run_shell(&format!("brew services stop {} 2>&1", formula))
}

// ── Install Check ───────────────────────────────────────────────────

#[tauri::command]
fn check_installed(name: String) -> bool {
    run_shell(&format!("which {} >/dev/null 2>&1", name)).success
        || run_shell(&format!("brew list {} >/dev/null 2>&1", name)).success
}

// ── Databases ──────────────────────────────────────────────────────

#[tauri::command]
fn list_databases(db_type: String) -> CmdResult {
    match db_type.as_str() {
        "mysql" | "mariadb" => run_shell("mysql -u root -e 'SHOW DATABASES;' 2>/dev/null"),
        "postgres" => run_shell("psql -l 2>/dev/null"),
        "mongodb" => run_shell("mongosh --quiet --eval 'db.adminCommand({listDatabases:1}).databases.forEach(d => print(d.name))' 2>/dev/null"),
        _ => CmdResult { success: false, output: String::new(), error: "Unknown DB type".into() },
    }
}

#[tauri::command]
fn create_database(db_type: String, name: String) -> CmdResult {
    match db_type.as_str() {
        "mysql" | "mariadb" => run_shell(&format!("mysql -u root -e \"CREATE DATABASE IF NOT EXISTS \\`{}\\`;\" 2>&1", name)),
        "postgres" => run_shell(&format!("createdb '{}' 2>&1", name)),
        "mongodb" => run_shell(&format!("mongosh --quiet --eval 'use {}' 2>&1", name)),
        _ => CmdResult { success: false, output: String::new(), error: "Unknown DB type".into() },
    }
}

#[tauri::command]
fn drop_database(db_type: String, name: String) -> CmdResult {
    match db_type.as_str() {
        "mysql" | "mariadb" => run_shell(&format!("mysql -u root -e \"DROP DATABASE IF EXISTS \\`{}\\`;\" 2>&1", name)),
        "postgres" => run_shell(&format!("dropdb '{}' 2>&1", name)),
        "mongodb" => run_shell(&format!("mongosh --quiet --eval 'db.getSiblingDB(\"{}\").dropDatabase()' 2>&1", name)),
        _ => CmdResult { success: false, output: String::new(), error: "Unknown DB type".into() },
    }
}

// ── Logs ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_logs(name: String) -> CmdResult {
    let log_file = if name.ends_with("-access") {
        format!("{}/logs/{}.log", devstack_home(), name)
    } else if name == "nginx" {
        "/opt/homebrew/var/log/nginx/error.log".into()
    } else if name == "nginx-access" {
        "/opt/homebrew/var/log/nginx/access.log".into()
    } else {
        format!("{}/logs/{}-error.log", devstack_home(), name)
    };
    run_shell(&format!("tail -200 '{}' 2>/dev/null || echo 'No logs found for: {}'", log_file, name))
}

// ── Troubleshoot ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct TroubleshootResult {
    pub name: String,
    pub status: String,
    pub detail: String,
}

#[tauri::command]
fn run_troubleshoot() -> Vec<TroubleshootResult> {
    let mut checks = Vec::new();

    // System info
    let os = run_shell("sw_vers -productVersion 2>/dev/null").output.trim().to_string();
    checks.push(TroubleshootResult { name: "System Information".into(), status: "ok".into(), detail: format!("macOS {}", os) });

    // DevStack info
    let ver = run_shell(&format!("{}/devstack --version 2>/dev/null || echo unknown", devstack_home())).output.trim().to_string();
    checks.push(TroubleshootResult { name: "DevStack Version".into(), status: "ok".into(), detail: ver });

    // Port checks
    let port_80 = run_shell("lsof -i :80 -sTCP:LISTEN 2>/dev/null | head -2").output;
    checks.push(TroubleshootResult {
        name: "Port 80 Check".into(),
        status: if port_80.contains("nginx") { "ok".into() } else if port_80.is_empty() { "warn".into() } else { "error".into() },
        detail: if port_80.is_empty() { "Port 80 not in use".into() } else { port_80.lines().last().unwrap_or("").to_string() },
    });

    let port_443 = run_shell("lsof -i :443 -sTCP:LISTEN 2>/dev/null | head -2").output;
    checks.push(TroubleshootResult {
        name: "Port 443 Check".into(),
        status: if port_443.contains("nginx") { "ok".into() } else if port_443.is_empty() { "warn".into() } else { "error".into() },
        detail: if port_443.is_empty() { "Port 443 not in use".into() } else { port_443.lines().last().unwrap_or("").to_string() },
    });

    // DNS check
    let dns_ok = std::path::Path::new("/etc/resolver/test").exists();
    checks.push(TroubleshootResult {
        name: "DNS Status".into(),
        status: if dns_ok { "ok".into() } else { "error".into() },
        detail: if dns_ok { "/etc/resolver/test exists".into() } else { "Missing /etc/resolver/test — *.test domains won't resolve".into() },
    });

    // SSL CA check
    let ca_ok = run_shell("mkcert -CAROOT 2>/dev/null").success;
    checks.push(TroubleshootResult {
        name: "SSL Certificate Authority".into(),
        status: if ca_ok { "ok".into() } else { "error".into() },
        detail: if ca_ok { run_shell("mkcert -CAROOT 2>/dev/null").output.trim().to_string() } else { "mkcert CA not installed".into() },
    });

    // Service checks
    let brew = run_shell("brew services list 2>/dev/null").output;
    for (name, display) in [("nginx", "Nginx"), ("php", "PHP-FPM"), ("mysql", "MySQL"), ("postgresql", "PostgreSQL"), ("redis", "Redis")] {
        let running = brew.lines().any(|l| l.contains(name) && l.contains("started"));
        checks.push(TroubleshootResult {
            name: format!("Service: {}", display),
            status: if running { "ok".into() } else { "warn".into() },
            detail: if running { "Running".into() } else { "Stopped".into() },
        });
    }

    // Nginx config check
    let nginx_test = run_shell("nginx -t 2>&1");
    checks.push(TroubleshootResult {
        name: "Nginx Config Test".into(),
        status: if nginx_test.success { "ok".into() } else { "error".into() },
        detail: if nginx_test.success { "Configuration valid".into() } else { nginx_test.error.lines().last().unwrap_or("Failed").to_string() },
    });

    // Website checks
    let sites = get_sites();
    for site in &sites {
        let url = format!("{}://{}", if site.ssl == "true" { "https" } else { "http" }, site.domain);
        let curl = run_shell(&format!("curl -sSk -o /dev/null -w '%{{http_code}}' '{}' 2>/dev/null", url));
        let code = curl.output.trim().to_string();
        checks.push(TroubleshootResult {
            name: format!("Website: {}", site.name),
            status: if code.starts_with('2') || code.starts_with('3') { "ok".into() } else { "error".into() },
            detail: format!("{} → HTTP {}", url, code),
        });
    }

    checks
}

// ── Ollama Models ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: String,
    pub modified: String,
}

#[tauri::command]
fn get_ollama_models() -> Vec<OllamaModel> {
    let result = run_shell("ollama list 2>/dev/null");
    let mut models = Vec::new();
    for line in result.output.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            models.push(OllamaModel {
                name: parts[0].to_string(),
                size: parts.get(2).unwrap_or(&"").to_string(),
                modified: parts.get(3..).map(|p| p.join(" ")).unwrap_or_default(),
            });
        }
    }
    models
}

#[tauri::command]
fn pull_ollama_model(name: String) -> CmdResult {
    run_shell(&format!("ollama pull '{}' 2>&1", name))
}

#[tauri::command]
fn delete_ollama_model(name: String) -> CmdResult {
    run_shell(&format!("ollama rm '{}' 2>&1", name))
}

// ── Config Files ────────────────────────────────────────────────────

#[tauri::command]
fn read_config_file(path: String) -> CmdResult {
    run_shell(&format!("cat '{}' 2>/dev/null", path))
}

#[tauri::command]
fn write_config_file(path: String, content: String) -> CmdResult {
    let tmp = format!("/tmp/devstack_config_{}", std::process::id());
    if let Err(e) = std::fs::write(&tmp, &content) {
        return CmdResult { success: false, output: String::new(), error: format!("Failed to write temp file: {}", e) };
    }
    let result = run_shell(&format!("cp '{}' '{}' 2>&1", tmp, path));
    let _ = std::fs::remove_file(&tmp);
    result
}

// ── Tunnel ──────────────────────────────────────────────────────────

#[tauri::command]
fn start_tunnel(provider: String, port: String, protocol: String, hostname: String, subdomain: String) -> CmdResult {
    let log_file = format!("{}/logs/tunnel.log", devstack_home());
    let _ = std::fs::create_dir_all(format!("{}/logs", devstack_home()));
    // Clear old log
    let _ = std::fs::write(&log_file, "");

    match provider.as_str() {
        "cloudflared" => {
            let proto = if protocol.is_empty() { "http" } else { &protocol };
            let no_tls = if proto == "https" { " --no-tls-verify" } else { "" };
            let host_flags = if hostname.is_empty() { String::new() } else {
                format!(" --origin-server-name {} --http-host-header {}", hostname, hostname)
            };
            let result = run_shell(&format!(
                "nohup cloudflared tunnel{}{} --url {}://localhost:{} > '{}' 2>&1 & echo $!",
                no_tls, host_flags, proto, port, log_file
            ));
            if result.output.trim().is_empty() || !result.success {
                return CmdResult {
                    success: false,
                    output: String::new(),
                    error: if result.error.is_empty() { "cloudflared not found".into() } else { result.error },
                };
            }
            // Return immediately — frontend polls get_tunnel_status for URL
            CmdResult {
                success: true,
                output: format!("cloudflared|starting"),
                error: String::new(),
            }
        }
        "ngrok" => {
            let sub = if subdomain.is_empty() { String::new() } else { format!("--subdomain={} ", subdomain) };
            let proto = if protocol.is_empty() { "http" } else { &protocol };
            let origin = format!("{}://localhost:{}", proto, port);
            let result = run_shell(&format!(
                "nohup ngrok http {}{}> '{}' 2>&1 & echo $!",
                sub, origin, log_file
            ));
            if result.output.trim().is_empty() || !result.success {
                return CmdResult {
                    success: false,
                    output: String::new(),
                    error: if result.error.is_empty() { "ngrok not found".into() } else { result.error },
                };
            }
            CmdResult {
                success: true,
                output: format!("ngrok|starting"),
                error: String::new(),
            }
        }
        _ => CmdResult { success: false, output: String::new(), error: "Unknown provider".into() },
    }
}

#[tauri::command]
fn stop_tunnel() -> CmdResult {
    run_shell("pkill -f 'cloudflared tunnel' 2>/dev/null; pkill -f 'ngrok http' 2>/dev/null; echo stopped")
}

#[tauri::command]
fn get_tunnel_status() -> CmdResult {
    let cf = run_shell("pgrep -f 'cloudflared tunnel' 2>/dev/null").success;
    let ng = run_shell("pgrep -f 'ngrok http' 2>/dev/null").success;

    let url = if cf {
        let log_file = format!("{}/logs/tunnel.log", devstack_home());
        run_shell(&format!("grep -oE 'https://[a-z0-9-]+\\.trycloudflare\\.com' '{}' 2>/dev/null | tail -1", log_file))
            .output.trim().to_string()
    } else if ng {
        run_shell("curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -oE 'https://[a-z0-9-]+\\.ngrok[a-z.-]*\\.io' | head -1")
            .output.trim().to_string()
    } else {
        String::new()
    };

    CmdResult {
        success: cf || ng,
        output: if cf { format!("cloudflared|{}", url) } else if ng { format!("ngrok|{}", url) } else { "none".into() },
        error: String::new(),
    }
}

// ── Mail ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_mail_status() -> CmdResult {
    // Check for mailpit or mailhog
    let mailpit = run_shell("pgrep -f mailpit 2>/dev/null").success;
    let mailhog = run_shell("pgrep -f mailhog 2>/dev/null").success;
    let installed = run_shell("which mailpit 2>/dev/null").success || run_shell("which mailhog 2>/dev/null").success;
    CmdResult {
        success: mailpit || mailhog,
        output: if mailpit { "mailpit:running".into() }
                else if mailhog { "mailhog:running".into() }
                else if installed { "installed:stopped".into() }
                else { "not_installed".into() },
        error: String::new(),
    }
}

#[tauri::command]
fn toggle_mail(action: String) -> CmdResult {
    if action == "start" {
        if run_shell("which mailpit 2>/dev/null").success {
            run_shell("brew services start mailpit 2>&1")
        } else {
            run_shell("brew services start mailhog 2>&1")
        }
    } else {
        run_shell("brew services stop mailpit 2>/dev/null; brew services stop mailhog 2>/dev/null; echo stopped")
    }
}

// ── Backup ──────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct BackupEntry {
    pub id: String,
    pub date: String,
    pub size: String,
    pub contents: Vec<String>,
}

#[tauri::command]
fn get_backups() -> Vec<BackupEntry> {
    let backup_dir = format!("{}/backups", devstack_home());
    let result = run_shell(&format!("ls -1t '{}'/*.tar.gz 2>/dev/null", backup_dir));
    let mut entries = Vec::new();
    for line in result.output.lines() {
        let path = line.trim();
        if path.is_empty() { continue; }
        let filename = path.split('/').last().unwrap_or("").replace(".tar.gz", "");
        let size = run_shell(&format!("du -h '{}' 2>/dev/null | awk '{{print $1}}'", path))
            .output.trim().to_string();
        let date = run_shell(&format!("stat -f '%Sm' -t '%Y-%m-%d %H:%M' '{}' 2>/dev/null", path))
            .output.trim().to_string();
        entries.push(BackupEntry {
            id: filename.clone(),
            date,
            size,
            contents: vec!["config".into(), "websites".into(), "ssl".into()],
        });
    }
    entries
}

#[tauri::command]
fn create_backup(contents: Vec<String>) -> CmdResult {
    let backup_dir = format!("{}/backups", devstack_home());
    let home = devstack_home();
    let timestamp = run_shell("date '+%Y%m%d_%H%M%S'").output.trim().to_string();
    let filename = format!("{}/devstack_backup_{}.tar.gz", backup_dir, timestamp);

    let mut paths = Vec::new();
    for item in &contents {
        match item.as_str() {
            "config" => paths.push(format!("{}/config", home)),
            "websites" => {
                paths.push(format!("{}/sites.json", home));
                paths.push("/opt/homebrew/etc/nginx/servers".to_string());
            }
            "ssl" => paths.push(format!("{}/certs", home)),
            "mysql" => {}
            "postgres" => {}
            "files" => paths.push(format!("{}/sites", home)),
            _ => {}
        }
    }

    let existing: Vec<&String> = paths.iter().filter(|p| std::path::Path::new(p).exists()).collect();
    if existing.is_empty() {
        return CmdResult { success: false, output: String::new(), error: "No backup content found".into() };
    }

    let paths_str: Vec<String> = existing.iter().map(|p| format!("'{}'", p)).collect();
    run_shell(&format!(
        "mkdir -p '{}' && tar -czf '{}' {} 2>&1",
        backup_dir, filename, paths_str.join(" ")
    ))
}

#[tauri::command]
fn restore_backup(id: String) -> CmdResult {
    let backup_file = format!("{}/backups/{}.tar.gz", devstack_home(), id);
    if !std::path::Path::new(&backup_file).exists() {
        return CmdResult { success: false, output: String::new(), error: "Backup file not found".into() };
    }
    run_shell(&format!("tar -xzf '{}' -C / 2>&1", backup_file))
}

#[tauri::command]
fn delete_backup(id: String) -> CmdResult {
    let backup_file = format!("{}/backups/{}.tar.gz", devstack_home(), id);
    run_shell(&format!("rm -f '{}' 2>&1", backup_file))
}

// ── Database Import/Export ───────────────────────────────────────────

#[tauri::command]
fn import_database(db_type: String, name: String, file_path: String) -> CmdResult {
    match db_type.as_str() {
        "mysql" | "mariadb" => run_shell(&format!("mysql -u root '{}' < '{}' 2>&1", name, file_path)),
        "postgres" => run_shell(&format!("psql '{}' < '{}' 2>&1", name, file_path)),
        "mongodb" => run_shell(&format!("mongorestore --db '{}' '{}' 2>&1", name, file_path)),
        _ => CmdResult { success: false, output: String::new(), error: "Unsupported DB type".into() },
    }
}

#[tauri::command]
fn export_database(db_type: String, name: String, file_path: String) -> CmdResult {
    match db_type.as_str() {
        "mysql" | "mariadb" => run_shell(&format!("mysqldump -u root '{}' > '{}' 2>&1", name, file_path)),
        "postgres" => run_shell(&format!("pg_dump '{}' > '{}' 2>&1", name, file_path)),
        "mongodb" => run_shell(&format!("mongodump --db '{}' --out '{}' 2>&1", name, file_path)),
        _ => CmdResult { success: false, output: String::new(), error: "Unsupported DB type".into() },
    }
}

// ── Service Config Paths ────────────────────────────────────────────

#[tauri::command]
fn get_config_paths(service: String) -> Vec<(String, String)> {
    let prefix = run_shell("brew --prefix 2>/dev/null").output.trim().to_string();
    let prefix = if prefix.is_empty() { "/opt/homebrew".to_string() } else { prefix };

    match service.as_str() {
        "php" => {
            let mut paths = Vec::new();
            let result = run_shell(&format!("ls -d {}/etc/php/*/php.ini 2>/dev/null", prefix));
            for line in result.output.lines() {
                let ver = line.split('/').rev().nth(1).unwrap_or("").to_string();
                paths.push((format!("php.ini ({})", ver), line.trim().to_string()));
            }
            let result2 = run_shell(&format!("ls -d {}/etc/php/*/php-fpm.d/www.conf 2>/dev/null", prefix));
            for line in result2.output.lines() {
                let ver = line.split('/').rev().nth(2).unwrap_or("").to_string();
                paths.push((format!("php-fpm www.conf ({})", ver), line.trim().to_string()));
            }
            if paths.is_empty() {
                paths.push(("php.ini".into(), format!("{}/etc/php/8.3/php.ini", prefix)));
            }
            paths
        }
        "mysql" => vec![
            ("my.cnf".into(), format!("{}/etc/my.cnf", prefix)),
            ("my.cnf.d/".into(), format!("{}/etc/my.cnf.d/", prefix)),
        ],
        "mariadb" => vec![
            ("my.cnf".into(), format!("{}/etc/my.cnf", prefix)),
        ],
        "postgresql" => {
            vec![
                ("postgresql.conf".into(), format!("{}/share/postgresql/postgresql.conf.sample", prefix)),
                ("pg_hba.conf".into(), format!("{}/var/postgresql@14/pg_hba.conf", prefix)),
            ]
        }
        "redis" => vec![
            ("redis.conf".into(), format!("{}/etc/redis.conf", prefix)),
        ],
        "memcached" => vec![
            ("memcached.conf".into(), format!("{}/etc/memcached.conf", prefix)),
        ],
        "mongodb" | "mongod" => vec![
            ("mongod.conf".into(), format!("{}/etc/mongod.conf", prefix)),
        ],
        "nginx" => vec![
            ("nginx.conf".into(), format!("{}/etc/nginx/nginx.conf", prefix)),
            ("servers/".into(), format!("{}/etc/nginx/servers/", prefix)),
        ],
        _ => vec![],
    }
}

// ── SSL Cert Types ──────────────────────────────────────────────────

#[tauri::command]
fn create_ssl_cert_advanced(cert_type: String, domain: String, org: String) -> CmdResult {
    let home = devstack_home();
    let certs_dir = format!("{}/certs", home);
    run_shell(&format!("mkdir -p '{}'", certs_dir));

    match cert_type.as_str() {
        "domain" => {
            run_shell(&format!(
                "cd '{}' && mkcert '{}' '*.{}' 2>&1",
                certs_dir, domain, domain
            ))
        }
        "smime" => {
            // Generate S/MIME cert for email signing
            run_shell(&format!(
                "cd '{}' && openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                 -keyout '{}-smime.key' -out '{}-smime.pem' \
                 -subj '/CN={}/O={}/emailAddress={}' 2>&1",
                certs_dir, domain, domain, domain, org, domain
            ))
        }
        "code" => {
            // Generate code signing cert
            run_shell(&format!(
                "cd '{}' && openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                 -keyout '{}-code.key' -out '{}-code.pem' \
                 -subj '/CN={}/O={}/OU=Code Signing' \
                 -addext 'extendedKeyUsage=codeSigning' 2>&1",
                certs_dir, domain, domain, domain, org
            ))
        }
        "document" => {
            run_shell(&format!(
                "cd '{}' && openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                 -keyout '{}-doc.key' -out '{}-doc.pem' \
                 -subj '/CN={}/O={}/OU=Document Signing' 2>&1",
                certs_dir, domain, domain, domain, org
            ))
        }
        _ => CmdResult { success: false, output: String::new(), error: "Unknown cert type".into() },
    }
}

// ── Scheduled Backups ───────────────────────────────────────────────

#[tauri::command]
fn get_backup_schedule() -> CmdResult {
    run_shell("crontab -l 2>/dev/null | grep devstack_backup || echo 'none'")
}

#[tauri::command]
fn set_backup_schedule(frequency: String, contents: Vec<String>) -> CmdResult {
    let home = devstack_home();
    let items = contents.join(",");
    let schedule = match frequency.as_str() {
        "daily" => "0 2 * * *",
        "weekly" => "0 2 * * 0",
        "monthly" => "0 2 1 * *",
        "off" => {
            return run_shell("crontab -l 2>/dev/null | grep -v devstack_backup | crontab - 2>&1");
        }
        _ => return CmdResult { success: false, output: String::new(), error: "Invalid frequency".into() },
    };

    let backup_script = format!("{}/backup_cron.sh", home);
    let script_content = format!(
        "#!/bin/bash\ncd '{}'\n./devstack backup create --items {} 2>&1 >> {}/logs/backup.log",
        home, items, home
    );
    let _ = std::fs::write(&backup_script, &script_content);
    let _ = run_shell(&format!("chmod +x '{}'", backup_script));

    // Add to crontab (remove old entry first)
    run_shell(&format!(
        "(crontab -l 2>/dev/null | grep -v devstack_backup; echo '{} {}  # devstack_backup') | crontab - 2>&1",
        schedule, backup_script
    ))
}

// ── Settings Persistence ────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub start_on_launch: bool,
    pub stop_on_quit: bool,
    pub theme: String,
    pub domain_suffix: String,
}

#[tauri::command]
fn load_settings() -> AppSettings {
    let path = format!("{}/config/settings.json", devstack_home());
    if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or(AppSettings {
            launch_at_login: false,
            start_on_launch: true,
            stop_on_quit: true,
            theme: "dark".into(),
            domain_suffix: ".test".into(),
        })
    } else {
        AppSettings {
            launch_at_login: false,
            start_on_launch: true,
            stop_on_quit: true,
            theme: "dark".into(),
            domain_suffix: ".test".into(),
        }
    }
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> CmdResult {
    let path = format!("{}/config/settings.json", devstack_home());
    let dir = format!("{}/config", devstack_home());
    let _ = std::fs::create_dir_all(&dir);
    match serde_json::to_string_pretty(&settings) {
        Ok(json) => {
            match std::fs::write(&path, &json) {
                Ok(_) => CmdResult { success: true, output: "Settings saved".into(), error: String::new() },
                Err(e) => CmdResult { success: false, output: String::new(), error: e.to_string() },
            }
        }
        Err(e) => CmdResult { success: false, output: String::new(), error: e.to_string() },
    }
}

// ── Custom TLD ──────────────────────────────────────────────────────

#[tauri::command]
fn get_custom_tlds() -> Vec<String> {
    let result = run_shell("ls /etc/resolver/ 2>/dev/null");
    result.output.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect()
}

#[tauri::command]
fn add_custom_tld(tld: String) -> CmdResult {
    run_shell(&format!(
        "echo 'nameserver 127.0.0.1' | sudo tee /etc/resolver/{} 2>&1",
        tld
    ))
}

// ── Homebrew Update Checker ─────────────────────────────────────────

#[derive(Serialize)]
pub struct OutdatedPkg {
    pub name: String,
    pub current: String,
    pub latest: String,
}

#[tauri::command]
fn check_outdated_packages() -> Vec<OutdatedPkg> {
    let result = run_shell("brew outdated --json 2>/dev/null");
    if !result.success { return vec![]; }

    let parsed: Result<serde_json::Value, _> = serde_json::from_str(&result.output);
    match parsed {
        Ok(val) => {
            if let Some(formulae) = val.get("formulae").and_then(|v| v.as_array()) {
                formulae.iter().filter_map(|f| {
                    let name = f.get("name")?.as_str()?.to_string();
                    let current = f.get("installed_versions")?.as_array()?.last()?.as_str()?.to_string();
                    let latest = f.get("current_version")?.as_str()?.to_string();
                    Some(OutdatedPkg { name, current, latest })
                }).collect()
            } else {
                vec![]
            }
        }
        Err(_) => vec![],
    }
}

#[tauri::command]
fn upgrade_package(name: String) -> CmdResult {
    run_shell(&format!("brew upgrade '{}' 2>&1", name))
}

// ── Onboarding ──────────────────────────────────────────────────────

#[tauri::command]
fn check_onboarding_status() -> Vec<(String, bool)> {
    vec![
        ("Homebrew".into(), run_shell("which brew 2>/dev/null").success),
        ("Nginx".into(), run_shell("which nginx 2>/dev/null").success),
        ("PHP".into(), run_shell("which php 2>/dev/null").success),
        ("MySQL".into(), run_shell("which mysql 2>/dev/null").success),
        ("Node.js".into(), run_shell("which node 2>/dev/null").success),
        ("mkcert".into(), run_shell("which mkcert 2>/dev/null").success),
        ("dnsmasq".into(), run_shell("which dnsmasq 2>/dev/null").success),
        ("CA Installed".into(), run_shell("mkcert -CAROOT 2>/dev/null").success),
        ("DNS Resolver".into(), std::path::Path::new("/etc/resolver/test").exists()),
        ("DevStack Dir".into(), std::path::Path::new(&devstack_home()).exists()),
    ]
}

#[tauri::command]
fn run_onboarding_step(step: String) -> CmdResult {
    let home = devstack_home();
    match step.as_str() {
        "dirs" => run_shell(&format!(
            "mkdir -p '{}'/{{sites,certs,logs,config,backups}} 2>&1",
            home
        )),
        "homebrew" => run_shell("/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\" 2>&1"),
        "essentials" => run_shell("brew install nginx php mysql node mkcert dnsmasq 2>&1"),
        "mkcert" => run_shell("mkcert -install 2>&1"),
        "dns" => run_shell("echo 'address=/.test/127.0.0.1' >> /opt/homebrew/etc/dnsmasq.conf && sudo mkdir -p /etc/resolver && echo 'nameserver 127.0.0.1' | sudo tee /etc/resolver/test && brew services restart dnsmasq 2>&1"),
        "start" => run_shell("brew services start nginx && brew services start php && brew services start mysql 2>&1"),
        _ => CmdResult { success: false, output: String::new(), error: "Unknown step".into() },
    }
}

// ── Per-site Logs ───────────────────────────────────────────────────

#[tauri::command]
fn get_site_logs(domain: String, log_type: String) -> CmdResult {
    let suffix = if log_type == "access" { "access.log" } else { "error.log" };
    let path = format!("/opt/homebrew/var/log/nginx/{}-{}", domain, suffix);
    if std::path::Path::new(&path).exists() {
        run_shell(&format!("tail -300 '{}' 2>/dev/null", path))
    } else {
        CmdResult {
            success: true,
            output: format!("No {} log found at {}", log_type, path),
            error: String::new(),
        }
    }
}

// ── Hosts File GUI ──────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct HostEntry {
    pub ip: String,
    pub hostname: String,
    pub comment: String,
    pub enabled: bool,
}

#[tauri::command]
fn get_hosts_entries() -> Vec<HostEntry> {
    let result = run_shell("cat /etc/hosts 2>/dev/null");
    let mut entries = Vec::new();
    for line in result.output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }

        let (enabled, content) = if trimmed.starts_with('#') {
            let inner = trimmed.trim_start_matches('#').trim();
            if inner.is_empty() || !inner.contains(char::is_whitespace) { continue; }
            (false, inner.to_string())
        } else {
            (true, trimmed.to_string())
        };

        let parts: Vec<&str> = content.splitn(3, char::is_whitespace).collect();
        if parts.len() >= 2 {
            let comment = if parts.len() > 2 {
                parts[2].trim_start_matches('#').trim().to_string()
            } else {
                String::new()
            };
            entries.push(HostEntry {
                ip: parts[0].to_string(),
                hostname: parts[1].to_string(),
                comment,
                enabled,
            });
        }
    }
    entries
}

#[tauri::command]
fn save_hosts_entries(entries: Vec<HostEntry>) -> CmdResult {
    let mut content = String::from("# /etc/hosts - managed by DevStack\n# Do not edit manually\n\n");
    for entry in &entries {
        let prefix = if entry.enabled { "" } else { "# " };
        let comment = if entry.comment.is_empty() { String::new() } else { format!("  # {}", entry.comment) };
        content.push_str(&format!("{}{}\t{}{}\n", prefix, entry.ip, entry.hostname, comment));
    }
    let tmp = format!("/tmp/devstack_hosts_{}", std::process::id());
    let _ = std::fs::write(&tmp, &content);
    let result = run_shell(&format!("sudo cp '{}' /etc/hosts 2>&1", tmp));
    let _ = std::fs::remove_file(&tmp);
    result
}

// ── Docker ──────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct DockerContainer {
    id: String,
    name: String,
    image: String,
    status: String,
    ports: String,
    state: String,
}

#[derive(serde::Serialize)]
struct DockerImage {
    id: String,
    repository: String,
    tag: String,
    size: String,
    created: String,
}

#[tauri::command]
fn get_docker_containers() -> Vec<DockerContainer> {
    let out = run_shell("docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.State}}' 2>/dev/null").output;
    out.trim().lines().filter(|l| !l.is_empty()).map(|line| {
        let p: Vec<&str> = line.splitn(6, '|').collect();
        DockerContainer {
            id: p.first().unwrap_or(&"").to_string(),
            name: p.get(1).unwrap_or(&"").to_string(),
            image: p.get(2).unwrap_or(&"").to_string(),
            status: p.get(3).unwrap_or(&"").to_string(),
            ports: p.get(4).unwrap_or(&"").to_string(),
            state: p.get(5).unwrap_or(&"").to_string(),
        }
    }).collect()
}

#[tauri::command]
fn get_docker_images() -> Vec<DockerImage> {
    let out = run_shell("docker images --format '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedSince}}' 2>/dev/null").output;
    out.trim().lines().filter(|l| !l.is_empty()).map(|line| {
        let p: Vec<&str> = line.splitn(5, '|').collect();
        DockerImage {
            id: p.first().unwrap_or(&"").to_string(),
            repository: p.get(1).unwrap_or(&"").to_string(),
            tag: p.get(2).unwrap_or(&"").to_string(),
            size: p.get(3).unwrap_or(&"").to_string(),
            created: p.get(4).unwrap_or(&"").to_string(),
        }
    }).collect()
}

#[tauri::command]
fn docker_action(container_id: String, action: String) -> CmdResult {
    run_shell(&format!("docker {} '{}' 2>&1", action, container_id))
}

#[tauri::command]
fn docker_remove_container(container_id: String, force: bool) -> CmdResult {
    let f = if force { " -f" } else { "" };
    run_shell(&format!("docker rm{} '{}' 2>&1", f, container_id))
}

#[tauri::command]
fn docker_remove_image(image_id: String, force: bool) -> CmdResult {
    let f = if force { " -f" } else { "" };
    run_shell(&format!("docker rmi{} '{}' 2>&1", f, image_id))
}

#[tauri::command]
fn docker_pull_image(image: String) -> CmdResult {
    run_shell(&format!("docker pull '{}' 2>&1", image))
}

#[tauri::command]
fn get_docker_logs(container_id: String) -> String {
    run_shell(&format!("docker logs --tail 100 '{}' 2>&1", container_id)).output
}

// ── Queue Management ────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct QueueInfo {
    name: String,
    queue_type: String, // redis or rabbitmq
    status: String,
    messages: String,
    consumers: String,
}

#[tauri::command]
fn get_redis_queues() -> Vec<QueueInfo> {
    let out = run_shell("redis-cli KEYS 'queue:*' 'bull:*' 'laravel_*' 2>/dev/null").output;
    let mut queues = Vec::new();
    for line in out.trim().lines() {
        let l = line.trim();
        if l.is_empty() || l.starts_with("ERR") || l.starts_with("(") { continue; }
        let len = run_shell(&format!("redis-cli LLEN '{}' 2>/dev/null", l)).output.trim().to_string();
        queues.push(QueueInfo {
            name: l.to_string(),
            queue_type: "redis".into(),
            status: "active".into(),
            messages: if len.parse::<i64>().is_ok() { len } else { "0".into() },
            consumers: "-".into(),
        });
    }
    queues
}

#[tauri::command]
fn get_rabbitmq_queues() -> Vec<QueueInfo> {
    let out = run_shell("rabbitmqctl list_queues name messages consumers 2>/dev/null").output;
    out.trim().lines().skip(1).filter(|l| !l.is_empty()).map(|line| {
        let p: Vec<&str> = line.split_whitespace().collect();
        QueueInfo {
            name: p.first().unwrap_or(&"").to_string(),
            queue_type: "rabbitmq".into(),
            status: "active".into(),
            messages: p.get(1).unwrap_or(&"0").to_string(),
            consumers: p.get(2).unwrap_or(&"0").to_string(),
        }
    }).collect()
}

#[tauri::command]
fn redis_queue_action(queue: String, action: String) -> CmdResult {
    match action.as_str() {
        "flush" => run_shell(&format!("redis-cli DEL '{}' 2>&1", queue)),
        "peek" => {
            let out = run_shell(&format!("redis-cli LRANGE '{}' 0 9 2>&1", queue));
            out
        },
        _ => CmdResult { success: false, output: String::new(), error: "Unknown action".into() },
    }
}

// ── Cron Jobs ───────────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct CronJob {
    schedule: String,
    command: String,
    raw: String,
}

#[tauri::command]
fn get_cron_jobs() -> Vec<CronJob> {
    let out = run_shell("crontab -l 2>/dev/null").output;
    out.trim().lines().filter(|l| {
        let t = l.trim();
        !t.is_empty() && !t.starts_with('#')
    }).map(|line| {
        let parts: Vec<&str> = line.splitn(6, char::is_whitespace).collect();
        if parts.len() >= 6 {
            CronJob {
                schedule: parts[..5].join(" "),
                command: parts[5..].join(" "),
                raw: line.to_string(),
            }
        } else {
            CronJob {
                schedule: String::new(),
                command: line.to_string(),
                raw: line.to_string(),
            }
        }
    }).collect()
}

#[tauri::command]
fn add_cron_job(schedule: String, command: String) -> CmdResult {
    let entry = format!("{} {}", schedule, command);
    run_shell(&format!(
        "(crontab -l 2>/dev/null; echo '{}') | sort -u | crontab - 2>&1",
        entry.replace('\'', "'\\''")
    ))
}

#[tauri::command]
fn remove_cron_job(raw: String) -> CmdResult {
    run_shell(&format!(
        "crontab -l 2>/dev/null | grep -vF '{}' | crontab - 2>&1",
        raw.replace('\'', "'\\''")
    ))
}

#[tauri::command]
fn get_cron_raw() -> String {
    run_shell("crontab -l 2>/dev/null").output
}

#[tauri::command]
fn save_cron_raw(content: String) -> CmdResult {
    let tmp = format!("/tmp/devstack_cron_{}", std::process::id());
    let _ = std::fs::write(&tmp, &content);
    let result = run_shell(&format!("crontab '{}' 2>&1", tmp));
    let _ = std::fs::remove_file(&tmp);
    result
}

// ── Site Templates ──────────────────────────────────────────────────

#[tauri::command]
fn create_from_template(name: String, template: String, _domain: String) -> CmdResult {
    let site_dir = format!("{}/.devstack/sites/{}", std::env::var("HOME").unwrap_or_default(), name);
    let _ = std::fs::create_dir_all(&site_dir);

    let cmd = match template.as_str() {
        "laravel" => format!(
            "cd '{}' && composer create-project laravel/laravel . 2>&1",
            site_dir
        ),
        "nextjs" => format!(
            "cd '{}' && npx create-next-app@latest . --ts --app --no-git --use-npm 2>&1",
            site_dir
        ),
        "django" => format!(
            "cd '{}' && python3 -m venv venv && source venv/bin/activate && pip install django && django-admin startproject app . 2>&1",
            site_dir
        ),
        "wordpress" => format!(
            "cd '{}' && curl -sO https://wordpress.org/latest.tar.gz && tar -xzf latest.tar.gz --strip-components=1 && rm latest.tar.gz 2>&1",
            site_dir
        ),
        "symfony" => format!(
            "cd '{}' && composer create-project symfony/skeleton . 2>&1",
            site_dir
        ),
        "express" => format!(
            "cd '{}' && npm init -y && npm install express && echo \"const express = require('express');\\nconst app = express();\\napp.get('/', (req, res) => res.send('Hello from Express'));\\napp.listen(3000, () => console.log('Server running on port 3000'));\" > index.js 2>&1",
            site_dir
        ),
        "static" => format!(
            "cd '{}' && echo '<!DOCTYPE html><html><head><title>{}</title></head><body><h1>Welcome to {}</h1></body></html>' > index.html 2>&1",
            site_dir, name, name
        ),
        _ => format!("echo 'Unknown template: {}'", template),
    };

    run_shell(&cmd)
}

// ── Main ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn cleanup_services() {
    // Only kill tunnel processes DevStack may have started — don't touch brew services
    let _ = run_shell(
        "pkill -f 'cloudflared tunnel' 2>/dev/null; \
         pkill -f 'ngrok http' 2>/dev/null"
    );
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // System Tray
            let start_all = MenuItemBuilder::with_id("start_all", "Start All Services").build(app)?;
            let stop_all = MenuItemBuilder::with_id("stop_all", "Stop All Services").build(app)?;
            let open_app = MenuItemBuilder::with_id("open_app", "Open DevStack").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&open_app)
                .separator()
                .item(&start_all)
                .item(&stop_all)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .tooltip("DevStack")
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "start_all" => {
                            let _ = run_shell("brew services start --all 2>&1");
                        }
                        "stop_all" => {
                            let _ = run_shell("brew services stop --all 2>&1");
                        }
                        "open_app" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "quit" => {
                            std::thread::spawn(|| cleanup_services());
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard, get_system_stats, check_requirements,
            get_sites, create_site, edit_site, delete_site,
            open_in_browser, open_in_editor, open_in_terminal, reload_nginx,
            start_services, stop_services, restart_service, toggle_service,
            get_packages,
            get_dns_entries, get_ssl_certs, create_ssl_cert, delete_ssl_cert,
            get_hosts_file, add_host_entry, remove_host_entry,
            get_php_versions, switch_php,
            get_installed_versions, get_available_versions,
            install_package, uninstall_package, start_package, stop_package,
            list_databases, create_database, drop_database,
            get_logs, run_troubleshoot,
            get_backups, create_backup, restore_backup, delete_backup,
            get_ollama_models, pull_ollama_model, delete_ollama_model,
            read_config_file, write_config_file,
            start_tunnel, stop_tunnel, get_tunnel_status,
            get_mail_status, toggle_mail,
            import_database, export_database,
            get_config_paths, create_ssl_cert_advanced,
            get_backup_schedule, set_backup_schedule,
            get_custom_tlds, add_custom_tld,
            check_outdated_packages, upgrade_package,
            check_onboarding_status, run_onboarding_step,
            get_site_logs, get_hosts_entries, save_hosts_entries,
            load_settings, save_settings,
            check_installed,
            // Docker
            get_docker_containers, get_docker_images, docker_action,
            docker_remove_container, docker_remove_image, docker_pull_image, get_docker_logs,
            // Queues
            get_redis_queues, get_rabbitmq_queues, redis_queue_action,
            // Cron
            get_cron_jobs, add_cron_job, remove_cron_job, get_cron_raw, save_cron_raw,
            // Templates
            create_from_template,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    std::thread::spawn(|| cleanup_services());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
