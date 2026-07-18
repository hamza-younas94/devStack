# Changelog

All notable changes to DevStack are documented in this file.

## [0.5.1] - 2026-03-22

### Fixed
- Removed duplicate UI elements: DNS TLDs tab, Database Tools table, Backup button, DevTools DB GUI tab
- Fixed Languages component refresh causing unnecessary re-renders
- Fixed WebServer race condition on concurrent operations
- Fixed Databases stale closures in event handlers

### Changed
- Deduplicated shared interfaces across 18 components (~500 lines removed)
- Consolidated shared types into `src/types.ts`

## [0.5.0] - 2026-03-22

### Added
- All remaining ServBay feature gaps closed — full feature parity

## [0.4.0] - 2026-03-22

### Added
- Dev Tools panel
- PHP extensions management
- Database GUI tools
- Caddy web server support
- URL redirect rules

## [0.3.0] - 2026-03-19

### Added
- Google Cloud Run deployment support
- Auto-generate Dockerfiles for PHP, Node, Python, Laravel, Django, Next.js
- GCP project selector and region picker
- Cloud Run service logs, traffic management, and deletion

## [0.2.0] - 2026-03-19

### Added
- Docker container management (start, stop, restart, remove, logs)
- Docker image management (pull, remove)
- Queue management — Redis queue inspection (peek, flush) and RabbitMQ monitoring
- Cron job management — visual editor with schedule presets + raw crontab editor
- Site templates: Laravel, WordPress, Next.js, Django, Express, Symfony
- MongoDB database support (alongside MySQL and PostgreSQL)

## [0.1.0] - 2026-03-18

### Added
- Initial release — DevStack local dev environment manager
- Dashboard: live CPU, memory, disk, network stats; service grid with version + PID
- Websites: create PHP, Node.js, Python, Static, WordPress sites with auto nginx + SSL + DNS
- Web Server: nginx start/stop/restart/reload, config editor, log viewer
- Databases: MySQL and PostgreSQL — create, drop, import, export
- Languages: PHP multi-version switching, Node.js, Python, Go, Ruby, Java management
- DNS: dnsmasq for `.test` domains, `/etc/hosts` editor, custom TLDs
- SSL: mkcert local CA, wildcard certs, cert management
- Tunnels: Cloudflare Tunnel and ngrok with click-to-install
- Packages: Homebrew package list, install, upgrade, uninstall
- AI: Ollama model management (pull, delete, list)
- Mail: Mailpit local mail server
- Search: Meilisearch full-text search engine
- Object Storage: MinIO S3-compatible storage
- Backup: site and database backup/restore with scheduling
- Settings: dark/light/auto theme, launch at login, custom domain suffix
- Troubleshoot: diagnostics for nginx, PHP, MySQL, ports, DNS, CA, disk
- Onboarding wizard for first-run guided setup
- System tray with quick access
