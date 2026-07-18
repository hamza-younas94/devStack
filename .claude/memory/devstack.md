---
name: devstack-app
description: DevStack — Tauri v2 desktop app for managing local dev environments, ServBay clone
type: project
---

# DevStack App

## Overview
- Tauri v2 desktop app (React 19 + TypeScript 5.9 + Vite 8 frontend, Rust 2021 backend)
- ServBay clone — manages local dev envs on macOS
- Repo: `hamza-younas94/devStack`, branch: `main`
- Path: `~/.devstack/devstack-app/`

## Architecture
- `invoke()` — Tauri frontend-to-backend IPC
- `run_shell(cmd)` — Rust helper, Homebrew-aware PATH
- `run_devstack(args)` — Calls CLI binary at `~/.devstack/devstack`
- `CmdResult` — return shape: `{ success, output, error }`
- Shared types `src/types.ts` (CmdResult, ServiceStatus, DashboardData, Site)

## Key Components (all implemented)
Dashboard, Websites, Packages, Languages, Databases, WebServer, DNS, SSL, Search, Mail, DevTools, Tunnel, Settings, Backup, AI, ObjectStorage, CronJobs, Queues, CloudRun, Docker, Troubleshoot

## Frontend Structure
- `src/App.tsx` — Layout, sidebar, routing, onboarding wizard
- `src/main.tsx` — Entry point
- `src/ToastContext.tsx` — Global toast notifications
- `src/styles.css` — All styles (1400+ lines, dark + light theme)
- `src/components/` — One component per feature (Dashboard.tsx, Websites.tsx, etc.)

## Backend Structure
- `src-tauri/src/lib.rs` — 90+ Tauri commands (~2100 lines), single file
- `src-tauri/src/main.rs` — App entry
- `src-tauri/tauri.conf.json` — Tauri config (app version, window, permissions)
- `src-tauri/Cargo.toml` — Rust dependencies

## Supported Services
nginx, PHP (multi-version), MySQL, PostgreSQL, MongoDB, Redis, RabbitMQ, Docker, Node.js, Python, Go, Ruby, Java, dnsmasq, mkcert, Mailpit, Meilisearch, MinIO, Ollama, Cloudflare Tunnel, ngrok

## Build Commands
- `npm run tauri dev` — development mode
- `npm run tauri build` — production build (outputs .app + .dmg)
- Build artifacts: `src-tauri/target/release/bundle/macos/DevStack.app`

## Version History
- v0.1.0 (2026-03-18) — Initial commit: core app with Dashboard, Websites, WebServer, Databases, Languages, DNS, SSL, Tunnels, Packages, AI, Mail, Search, ObjectStorage, Backup, Settings, Troubleshoot
- v0.2.0 (2026-03-19) — Docker, Queues, Cron Jobs, site templates (Laravel/WordPress/Next.js/Django/Express/Symfony), MongoDB support
- v0.3.0 (2026-03-19) — Google Cloud Run deployment support
- v0.4.0 (2026-03-22) — Dev Tools, PHP extensions, DB GUI, Caddy support, redirect rules
- v0.5.0 (2026-03-22) — All remaining ServBay feature gaps closed
- v0.5.1 (2026-03-22) — Fix UI duplicates, performance issues, deduplicate shared types (~500 lines cut)

## Recent Work (2026-03-22)
- Dedup shared interfaces across 18 components (~500 lines cut)
- Perf fixes: Languages refresh, WebServer race, Databases stale closures
- Dup UI removed: DNS TLDs tab, Database Tools table, Backup button, DevTools DB GUI tab
- Commit: `c07c003` — pushed main
