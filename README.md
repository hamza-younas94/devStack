<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="DevStack Logo">
</p>

<h1 align="center">DevStack</h1>

<p align="center">
  <strong>Your local development environment, managed.</strong><br>
  A native macOS desktop app for managing nginx, PHP, databases, DNS, SSL, tunnels, and more — all from one place.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-blue?style=flat-square" alt="macOS">
  <img src="https://img.shields.io/badge/built_with-Tauri_v2-orange?style=flat-square" alt="Tauri v2">
  <img src="https://img.shields.io/badge/frontend-React_19-61dafb?style=flat-square" alt="React">
  <img src="https://img.shields.io/badge/backend-Rust-brown?style=flat-square" alt="Rust">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT">
</p>

---

## Screenshots

### Dashboard
Monitor all services, system resources, and websites at a glance.

![Dashboard](screenshots/dashboard.png)

<!-- Add more screenshots as you capture them:
### Websites
![Websites](screenshots/websites.png)

### Databases
![Databases](screenshots/databases.png)

### Tunnel
![Tunnel](screenshots/tunnel.png)

### Settings (Light Theme)
![Light Theme](screenshots/settings-light.png)
-->

---

## Features

### Services & Infrastructure

<table>
<tr>
<td width="50%">

#### Dashboard
- Live CPU, memory, disk, and network stats
- All services at a glance with version + PID
- Quick Start All / Stop All controls
- Session uptime counter
- Website list with quick actions (open, terminal, editor)

</td>
<td width="50%">

#### Websites
- Create sites in one click: PHP, Node.js, Python, Static, WordPress
- **Site templates**: Laravel, WordPress, Next.js, Django, Express, Symfony
- Auto-generates nginx config, SSL cert, and DNS entry
- Custom document root, PHP version per site
- Access/error log viewer per site
- Open in browser, terminal, or code editor

</td>
</tr>
<tr>
<td>

#### Web Server (nginx)
- Start, stop, restart, reload nginx
- Edit nginx config directly in-app
- Auto-tail access and error logs
- Rewrite rule templates (WordPress, Laravel, etc.)

</td>
<td>

#### Databases
- **MySQL**, **PostgreSQL**, and **MongoDB** support
- Create, drop, import (`.sql`), and export databases
- Edit `my.cnf` / `postgresql.conf` in-app
- View connection details (host, port, socket)

</td>
</tr>
<tr>
<td>

#### Languages & Runtimes
- **PHP** — Multiple versions, one-click switching
- **Node.js** — Version management
- **Python** — Version management
- **Go, Ruby, Java** — Install and manage
- Active version shown per runtime

</td>
<td>

#### DNS
- Local DNS via **dnsmasq** (`.test` domains)
- Click-to-install if not present
- `/etc/hosts` editor — add, remove, edit entries
- Custom TLD support
- One-click DNS setup and reconfigure

</td>
</tr>
</table>

### Security & Networking

<table>
<tr>
<td width="50%">

#### SSL Certificates
- Auto-generate trusted local certs via **mkcert**
- Wildcard certificate support
- Install local CA with one click
- Manage and delete certificates

</td>
<td width="50%">

#### Tunnels
- **Cloudflare Tunnel** — Free, no account needed
- **ngrok** — Full tunnel support
- Click-to-install providers (no manual brew commands)
- Copy public URL, open in browser
- Auto-detects tunnel URL from logs

</td>
</tr>
</table>

### DevOps & Containers

<table>
<tr>
<td width="33%">

#### Docker
- Container lifecycle (start, stop, restart, remove)
- Image management (pull, remove)
- Container logs viewer
- Click-to-install Docker

</td>
<td width="33%">

#### Queues
- **Redis** queue inspection (peek, flush)
- **RabbitMQ** queue monitoring
- Message count + consumer count
- Click-to-install both

</td>
<td width="33%">

#### Cron Jobs
- Visual cron editor with schedule presets
- Raw crontab editor
- Add/remove jobs from GUI
- Common schedule templates

</td>
</tr>
<tr>
<td>

#### Google Cloud Run
- Deploy sites directly to Cloud Run
- Auto-generate Dockerfiles (PHP, Node, Python, Laravel, Django, Next.js)
- GCP project selector + region picker
- View logs, manage traffic, delete services

</td>
<td>

#### Site Templates
- **Laravel** — Full scaffold with Composer
- **WordPress** — Auto-download + wp-config
- **Next.js / Express** — npm init + dependencies
- **Django** — virtualenv + pip install
- **Symfony** — Composer create-project

</td>
<td></td>
</tr>
</table>

### Advanced Tools

<table>
<tr>
<td width="33%">

#### AI (Ollama)
- Pull and manage LLM models
- Start/stop Ollama service
- Click-to-install
- Model list with sizes

</td>
<td width="33%">

#### Mail (Mailpit)
- Local mail server
- Click-to-install
- Start/stop with one click
- Catch all outgoing mail

</td>
<td width="33%">

#### Search (Meilisearch)
- Full-text search engine
- Click-to-install
- Start/stop service
- Lightning fast indexing

</td>
</tr>
<tr>
<td>

#### Object Storage (MinIO)
- S3-compatible storage
- Click-to-install
- Start/stop service
- Local development storage

</td>
<td>

#### Backup & Restore
- Backup sites and databases
- Scheduled backups
- One-click restore
- Manage backup history

</td>
<td>

#### Packages
- Full Homebrew package list
- Install, upgrade, uninstall
- Check for updates
- Upgrade all at once

</td>
</tr>
</table>

### App Experience

<table>
<tr>
<td width="50%">

#### Settings
- **Dark / Light / Auto** theme
- Launch at login toggle
- Custom domain suffix (`.test`, `.local`, etc.)
- Auto-start services on launch
- Persistent preferences

</td>
<td width="50%">

#### System
- **Onboarding Wizard** — First-run guided setup
- **Troubleshoot** — Diagnostics for nginx, PHP, MySQL, ports, DNS, CA, disk
- **System Tray** — Quick access from menu bar
- **Toast Notifications** — Feedback on every action

</td>
</tr>
</table>

---

## Requirements

- **macOS** (Apple Silicon or Intel)
- **Homebrew** — DevStack uses Homebrew to install and manage all services

> DevStack will guide you through installing everything else via the built-in **Onboarding Wizard**.

---

## Getting Started

### Option 1: Download the DMG

Grab the latest `.dmg` from [Releases](https://github.com/hamza-younas94/devStack/releases), open it, and drag DevStack to Applications.

### Option 2: Build from Source

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (1.77+)
- [Homebrew](https://brew.sh/)

```bash
# Clone the repo
git clone git@github.com:hamza-younas94/devStack.git
cd devStack

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

The built app will be at:
```
src-tauri/target/release/bundle/macos/DevStack.app
src-tauri/target/release/bundle/dmg/DevStack_0.1.0_aarch64.dmg
```

---

## First Run

When you launch DevStack for the first time, the **Onboarding Wizard** checks your system and walks you through setup:

| Step | What it does |
|------|-------------|
| **Create Dirs** | Creates `~/.devstack` directory structure |
| **Install Essentials** | Installs nginx, PHP, MySQL, Node.js, Redis via Homebrew |
| **Setup SSL CA** | Installs a local Certificate Authority via mkcert |
| **Setup DNS** | Configures dnsmasq for `.test` domains |
| **Start Services** | Starts all installed services |

You can run each step individually or skip and set up later.

---

## Usage

### Create a Website

```
Websites → Create Site → name: myapp, type: PHP → Create
```

DevStack automatically:
- Creates `~/.devstack/sites/myapp/`
- Generates nginx config with SSL
- Creates a trusted SSL certificate via mkcert
- Configures DNS → `myapp.test`

Visit **https://myapp.test** in your browser.

### Expose via Tunnel

```
Tunnel → Install Cloudflare (one click) → Port: 443 → Create Tunnel → Copy URL
```

Share the public URL with anyone — they can access your local site.

### Manage Databases

```
Databases → MySQL → Create Database → name: myapp_db
```

Import `.sql` files, export backups, edit configs — all in the GUI.

### Switch PHP Version

```
Languages → PHP → Click desired version → nginx reloads automatically
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Tauri v2](https://v2.tauri.app/) (native, lightweight) |
| **Frontend** | React 19, TypeScript 5.9, Vite 8 |
| **Backend** | Rust 2021 edition |
| **Package Manager** | Homebrew |
| **Styling** | Custom CSS (dark + light theme, no framework) |

---

## Rust Backend (Tauri Commands)

The backend is a single Rust file (`src-tauri/src/lib.rs`) with **90+ Tauri commands** organized into modules:

| Module | Commands | Description |
|--------|----------|-------------|
| **Dashboard** | `get_system_stats`, `get_dashboard` | CPU, memory, disk stats; service status grid |
| **Websites** | `get_sites`, `create_site`, `edit_site`, `delete_site`, `get_site_logs` | Full CRUD with nginx config + SSL generation |
| **Templates** | `create_from_template` | Scaffold Laravel, WordPress, Next.js, Django, Express, Symfony, Static |
| **Web Server** | `reload_nginx`, `start_services`, `stop_services`, `restart_service`, `toggle_service` | Per-service start/stop controls |
| **Databases** | `list_databases`, `create_database`, `drop_database`, `import_database`, `export_database` | MySQL, PostgreSQL, MongoDB |
| **Languages** | `get_php_versions`, `switch_php`, `get_installed_versions`, `get_available_versions` | Multi-version PHP, Node, Python, Go, Ruby, Java |
| **DNS** | `get_dns_entries`, `get_hosts_entries`, `save_hosts_entries`, `add_host_entry`, `remove_host_entry` | dnsmasq + /etc/hosts management |
| **SSL** | `get_ssl_certs`, `create_ssl_cert`, `create_ssl_cert_advanced`, `delete_ssl_cert` | mkcert CA + cert generation |
| **Tunnels** | `start_tunnel`, `stop_tunnel`, `get_tunnel_status` | Cloudflare + ngrok tunnel management |
| **Packages** | `get_packages`, `install_package`, `uninstall_package`, `check_outdated_packages`, `upgrade_package` | Homebrew package management |
| **Docker** | `get_docker_containers`, `get_docker_images`, `docker_action`, `docker_pull_image`, `get_docker_logs` | Container + image lifecycle |
| **Queues** | `get_redis_queues`, `get_rabbitmq_queues`, `redis_queue_action` | Queue inspection + flush |
| **Cron** | `get_cron_jobs`, `add_cron_job`, `remove_cron_job`, `get_cron_raw`, `save_cron_raw` | Visual + raw crontab editing |
| **Cloud Run** | `gcloud_check`, `gcloud_list_projects`, `cloudrun_list_services`, `cloudrun_build_and_deploy`, `cloudrun_generate_dockerfile` | GCP Cloud Run deployment |
| **AI** | `get_ollama_models`, `pull_ollama_model`, `delete_ollama_model` | Ollama LLM management |
| **Mail** | `get_mail_status`, `toggle_mail` | Mailpit service control |
| **Backup** | `get_backups`, `create_backup`, `restore_backup`, `delete_backup`, `get_backup_schedule`, `set_backup_schedule` | Backup/restore + scheduling |
| **Config** | `read_config_file`, `write_config_file`, `get_config_paths` | In-app config editing for any service |
| **Settings** | `load_settings`, `save_settings`, `get_custom_tlds`, `add_custom_tld` | App preferences + custom TLDs |
| **System** | `check_requirements`, `check_onboarding_status`, `run_onboarding_step`, `run_troubleshoot` | Setup wizard + diagnostics |

### Architecture

```
Frontend (React)                    Backend (Rust)
┌────────────────┐                 ┌────────────────────┐
│  Component.tsx │ ── invoke() ──→ │ #[tauri::command]   │
│                │                 │ fn my_command()     │
│  await invoke( │                 │   → run_shell(cmd)  │
│    "command",  │                 │   → run_devstack()  │
│    { args }    │ ←── Result ──── │   → CmdResult       │
│  )             │                 │                     │
└────────────────┘                 └────────────────────┘
```

- **`run_shell(cmd)`** — Executes shell commands with Homebrew-aware `PATH`
- **`run_devstack(args)`** — Calls the DevStack CLI binary at `~/.devstack/devstack`
- **`CmdResult`** — Standard return type: `{ success, output, error }`

### DevStack CLI

DevStack includes a CLI binary (`~/.devstack/devstack`) used by both the GUI and terminal:

```bash
# Service management
devstack start              # Start all services
devstack stop               # Stop all services
devstack status             # Show service status

# PHP version switching
devstack php switch 8.3     # Switch active PHP version
devstack php list           # List installed PHP versions

# Site management
devstack site create myapp  # Create a new site
devstack site delete myapp  # Delete a site
devstack site list          # List all sites

# DNS
devstack dns setup          # Configure dnsmasq for .test domains
devstack dns status         # Check DNS resolution

# SSL
devstack ssl create myapp   # Generate SSL cert for myapp.test
devstack ssl ca install     # Install local CA
```

---

## Project Structure

```
devstack-app/
├── src/                        # React frontend
│   ├── App.tsx                 # Layout, sidebar, routing, onboarding
│   ├── main.tsx                # Entry point
│   ├── ToastContext.tsx         # Global toast notifications
│   ├── styles.css              # All styles (1400+ lines, dark + light)
│   └── components/
│       ├── Dashboard.tsx        # System overview, service grid
│       ├── Websites.tsx         # Site CRUD, logs, config
│       ├── WebServer.tsx        # nginx control, log tailing
│       ├── Databases.tsx        # MySQL/PostgreSQL management
│       ├── Languages.tsx        # Runtime version management
│       ├── DNS.tsx              # dnsmasq + /etc/hosts
│       ├── SSL.tsx              # mkcert certificates
│       ├── Tunnel.tsx           # Cloudflare/ngrok tunnels
│       ├── AI.tsx               # Ollama models
│       ├── Mail.tsx             # Mailpit service
│       ├── Search.tsx           # Meilisearch service
│       ├── ObjectStorage.tsx    # MinIO service
│       ├── Packages.tsx         # Homebrew package management
│       ├── Docker.tsx           # Docker container/image management
│       ├── Queues.tsx           # Redis + RabbitMQ queues
│       ├── CronJobs.tsx         # Cron job visual + raw editor
│       ├── CloudRun.tsx         # Google Cloud Run deployment
│       ├── Backup.tsx           # Backup/restore
│       ├── Settings.tsx         # App preferences
│       └── Troubleshoot.tsx     # System diagnostics
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── lib.rs              # 90+ Tauri commands (~2100 lines)
│   │   └── main.rs             # App entry
│   ├── Cargo.toml
│   └── tauri.conf.json
├── screenshots/                 # App screenshots
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Supported Services

| Service | Formula | Purpose |
|---------|---------|---------|
| nginx | `nginx` | Web server / reverse proxy |
| PHP | `php` | PHP-FPM (multi-version) |
| MySQL | `mysql` | Relational database |
| PostgreSQL | `postgresql@17` | Relational database |
| MongoDB | `mongodb-community` | Document database |
| Redis | `redis` | In-memory cache / store |
| RabbitMQ | `rabbitmq` | Message queue broker |
| Docker | `docker` | Container runtime |
| Node.js | `node` | JavaScript runtime |
| Python | `python` | Python runtime |
| Go | `go` | Go runtime |
| dnsmasq | `dnsmasq` | Local DNS server |
| mkcert | `mkcert` | Trusted local SSL certs |
| Mailpit | `mailpit` | Local mail catch-all |
| Meilisearch | `meilisearch` | Search engine |
| MinIO | `minio` | S3-compatible storage |
| Ollama | `ollama` | Local AI / LLMs |
| Cloudflare Tunnel | `cloudflare/cloudflare/cloudflared` | Public tunnels |
| ngrok | `ngrok/ngrok/ngrok` | Public tunnels |

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Build and test: `npm run tauri build`
5. Commit and push
6. Open a Pull Request

### Adding a New Service

1. **Backend** — Add Tauri commands in `src-tauri/src/lib.rs` and register in `invoke_handler`
2. **Frontend** — Create `src/components/YourService.tsx`, use `invoke()` to call commands
3. **Sidebar** — Add menu item in `src/App.tsx`
4. **Styles** — Reuse existing card/table/button classes from `src/styles.css`

---

## Roadmap

- [x] Docker container management
- [x] MongoDB support
- [x] Queue management (Redis queues, RabbitMQ)
- [x] Cron job management
- [x] Site templates (Laravel, Next.js, Django, WordPress, Symfony, Express)
- [x] Google Cloud Run deployment
- [ ] Linux support (apt/dnf package manager backend)
- [ ] Windows support (choco/winget/scoop backend)
- [ ] Multiple PHP-FPM pools per site
- [ ] Auto-update mechanism

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Tauri, React, and Rust<br>
  <sub>Made by <a href="https://github.com/hamza-younas94">Hamza Younas</a></sub>
</p>
