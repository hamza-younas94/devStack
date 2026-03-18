# DevStack

A native desktop application for managing your local development environment on macOS. Built with [Tauri v2](https://v2.tauri.app/), React, and Rust.

Think of it as an open-source alternative to ServBay — manage nginx, PHP, databases, DNS, SSL, tunnels, and more from a single app.

![DevStack](src-tauri/icons/128x128.png)

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | Real-time overview of all services, system stats (CPU, memory, disk) |
| **Websites** | Create and manage local sites (PHP, Node.js, Python, Static, WordPress) |
| **Web Server** | Nginx config editing, log tailing, rewrite rule templates |
| **Databases** | MySQL & PostgreSQL — create, drop, import, export databases |
| **Languages** | Manage PHP (multi-version), Node.js, Python, Go, Ruby, Java |
| **DNS** | Local DNS via dnsmasq, custom TLDs (`.test`, `.local`), `/etc/hosts` editor |
| **SSL** | Auto-generate trusted local certificates via mkcert |
| **Tunnels** | Expose local sites via Cloudflare Tunnel or ngrok (click to install) |
| **AI** | Ollama integration — pull, manage, and run LLM models locally |
| **Mail** | Local mail server via Mailpit |
| **Search** | Meilisearch management |
| **Object Storage** | MinIO (S3-compatible) management |
| **Packages** | Install, upgrade, and manage Homebrew packages |
| **Backup** | Backup and restore sites and databases |
| **Settings** | Dark/light theme, launch preferences, custom domain suffixes |

## Requirements

- **macOS** (Apple Silicon or Intel)
- **Homebrew** — DevStack uses Homebrew to install and manage all services

> DevStack will guide you through installing everything else via the built-in onboarding wizard.

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
- **App:** `src-tauri/target/release/bundle/macos/DevStack.app`
- **DMG:** `src-tauri/target/release/bundle/dmg/DevStack_0.1.0_aarch64.dmg`

## First Run

When you launch DevStack for the first time, the **Onboarding Wizard** will check your system and help you set up:

1. **Create Dirs** — Creates `~/.devstack` directory structure
2. **Install Essentials** — Installs nginx, PHP, MySQL, Node.js, Redis via Homebrew
3. **Setup SSL CA** — Installs a local Certificate Authority via mkcert
4. **Setup DNS** — Configures dnsmasq for local `.test` domains
5. **Start Services** — Starts all installed services

Click each button or use **Quick Setup** to run them all. You can skip and set up later.

## Usage

### Creating a Site

1. Go to **Websites** in the sidebar
2. Click **Create Site**
3. Enter a name (e.g., `myapp`) — it becomes `myapp.test`
4. Choose a type: PHP, Node.js, Python, Static, or WordPress
5. Click **Create**

DevStack automatically:
- Creates the site directory at `~/.devstack/sites/myapp`
- Generates an nginx config with SSL
- Creates a trusted SSL certificate
- Adds the DNS entry

Visit `https://myapp.test` in your browser.

### Exposing a Site via Tunnel

1. Go to **Tunnel** in the sidebar
2. Install Cloudflare Tunnel or ngrok (one-click install)
3. Select a port and provider
4. Click **Create Tunnel**
5. Copy the public URL and share it

### Managing Databases

1. Go to **Databases** in the sidebar
2. Select MySQL or PostgreSQL
3. Create, drop, import (`.sql`), or export databases
4. Edit config files directly in the app

### Switching PHP Versions

1. Go to **Languages** in the sidebar
2. See all installed PHP versions
3. Click to switch the active version — nginx restarts automatically

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Tauri v2](https://v2.tauri.app/) |
| **Frontend** | React 19, TypeScript 5.9, Vite 8 |
| **Backend** | Rust (2021 edition) |
| **Package Manager** | Homebrew |
| **Styling** | Custom CSS with dark/light theme support |

## Project Structure

```
devstack-app/
├── src/                    # React frontend
│   ├── App.tsx             # Main layout, sidebar, routing
│   ├── main.tsx            # Entry point
│   ├── ToastContext.tsx     # Toast notification system
│   ├── styles.css          # All styles (dark + light theme)
│   └── components/
│       ├── Dashboard.tsx    # System overview
│       ├── Websites.tsx     # Site management
│       ├── WebServer.tsx    # Nginx control
│       ├── Databases.tsx    # MySQL/PostgreSQL
│       ├── Languages.tsx    # PHP, Node, Python, Go
│       ├── DNS.tsx          # dnsmasq + /etc/hosts
│       ├── SSL.tsx          # mkcert certificates
│       ├── Tunnel.tsx       # Cloudflare/ngrok tunnels
│       ├── AI.tsx           # Ollama models
│       ├── Mail.tsx         # Mailpit
│       ├── Search.tsx       # Meilisearch
│       ├── ObjectStorage.tsx # MinIO
│       ├── Packages.tsx     # Homebrew packages
│       ├── Backup.tsx       # Backup/restore
│       ├── Settings.tsx     # App preferences
│       └── Troubleshoot.tsx # Diagnostics
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # All Tauri commands (~1600 lines)
│   │   └── main.rs         # App entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri config
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Build and test: `npm run tauri build`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

### Adding a New Service

To add support for a new service (e.g., MongoDB):

1. **Backend** (`src-tauri/src/lib.rs`):
   - Add Tauri commands for status, start/stop, config
   - Register commands in `invoke_handler`

2. **Frontend** (`src/components/YourService.tsx`):
   - Create a new component
   - Use `invoke()` to call your backend commands
   - Add toast notifications for user feedback

3. **Sidebar** (`src/App.tsx`):
   - Add menu item to the appropriate section

4. **Styles** (`src/styles.css`):
   - Reuse existing card/table/button styles

## Supported Services

| Service | Homebrew Formula | Purpose |
|---------|-----------------|---------|
| nginx | `nginx` | Web server / reverse proxy |
| PHP | `php` | PHP-FPM (multiple versions) |
| MySQL | `mysql` | Relational database |
| PostgreSQL | `postgresql@17` | Relational database |
| Redis | `redis` | In-memory cache |
| Node.js | `node` | JavaScript runtime |
| Python | `python` | Python runtime |
| Go | `go` | Go runtime |
| dnsmasq | `dnsmasq` | Local DNS server |
| mkcert | `mkcert` | Local SSL certificates |
| Mailpit | `mailpit` | Local mail server |
| Meilisearch | `meilisearch` | Search engine |
| MinIO | `minio` | S3-compatible storage |
| Ollama | `ollama` | Local AI/LLM |
| Cloudflare Tunnel | `cloudflare/cloudflare/cloudflared` | Public tunnels |
| ngrok | `ngrok/ngrok/ngrok` | Public tunnels |

## License

MIT
