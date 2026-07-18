# DevStack

Tauri v2 desktop app for managing local dev environments on macOS. ServBay clone.

## Quick Reference

| Item | Value |
|------|-------|
| Stack | React 19 + TS 5.9 + Vite 8 (front), Rust 2021 (back), Tauri v2 |
| Repo | `hamza-younas94/devStack`, branch `main` |
| Path | `~/.devstack/devstack-app/` |
| Dev | `npm run tauri dev` |
| Build | `npm run tauri build` |

## Project Memory

- `.claude/memory/devstack.md` — full project context, architecture, version history
- `.claude/agents/devstack.md` — specialist agent with baked-in DevStack knowledge

## Architecture

```
Frontend (React)                    Backend (Rust)
  Component.tsx ── invoke() ──→  #[tauri::command] fn
                                   → run_shell(cmd)     // Homebrew-aware PATH
                                   → run_devstack(args) // CLI at ~/.devstack/devstack
                  ←── CmdResult ── { success, output, error }
```

- Backend: `src-tauri/src/lib.rs` — 90+ commands, single file
- Frontend: `src/components/` — one component per feature
- Shared types: `src/types.ts`
- Styles: `src/styles.css` (1400+ lines, dark + light, no framework)

## Conventions

- All shell execution through `run_shell()` for Homebrew PATH
- `CmdResult { success, output, error }` as standard return type
- One component per feature in `src/components/`
- Reuse existing CSS classes from `styles.css`
- Toast notifications for all user-facing actions
- Click-to-install pattern: detect missing service, show install button
- Dark + light theme support required for all new UI

## Adding a New Service

1. **Backend** — Add Tauri commands in `src-tauri/src/lib.rs`, register in `invoke_handler`
2. **Frontend** — Create `src/components/YourService.tsx`, use `invoke()` for IPC
3. **Sidebar** — Add menu item in `src/App.tsx`
4. **Styles** — Reuse existing card/table/button classes from `src/styles.css`
