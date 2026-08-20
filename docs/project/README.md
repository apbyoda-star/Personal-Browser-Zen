# Project documents

Planning and decision records for the Vector migration. These were written on the
macOS side and are committed here so any machine that clones the repo has the full
context — including a fresh Claude Code session on the Windows PC.

| File | What it is |
|---|---|
| `MIGRATION_PLAN.md` | The authoritative plan: every feature of the old Electron browser, what happens to it, and in what order. Start here. |
| `NATIVE_PARITY_AUDIT.md` | Evidence behind the plan: for each subsystem, whether Firefox/Zen already does it natively. Justifies every "port" decision. |
| `DECISIONS_MADE.md` | Decisions made without the owner present, all reversible, with reasoning. |
| `WINDOWS_VERIFICATION.md` | Checklist of things that must be verified on Windows specifically. |
| `MORNING_REPORT.md` | Status report from the overnight macOS build, with the owner's questions (all now answered — see below). |
| `OVERNIGHT_LOG.md` | Chronological log of the overnight build session. |

**For building on Windows, read `WINDOWS_BUILD.md` in the repository root instead** —
it is the operational runbook and is self-sufficient.

## Owner decisions (binding)

Recorded 2026-08-19 and 2026-08-20. These override anything in the older documents:

- **Product name is Vector**, with Vector's existing logo and favicon everywhere.
  Nothing user-visible may read "Zen".
- **Windows is the primary platform**, macOS secondary. Every change must work on
  both.
- **Little Arc is a hard requirement** — it is the single reason stock Zen was
  rejected. Page-initiated `window.open` opens a floating panel that preserves the
  opener and session (the Tekmetric → PartsTech punch-out), dismissible with no tab
  left behind, resizable, centered on the window.
- **Custom password manager: delete.** The 43 saved logins migrate into **Firefox's
  built-in password manager inside Vector** — explicitly *not* Bitwarden, though
  Bitwarden stays installed as an extension. Migrate and verify against a copy
  before deleting anything.
- **Cards/contacts vault: delete.** Native form autofill is sufficient.
- **Sync: Firefox/Zen Sync**, retiring the old Supabase layer (export data first).
- **No companion service, ever.** Anything the old helper process did must run from
  the fork's own privileged layer.
- **Dropped:** Arc import (a Vector-state importer replaces it), top-dock mode,
  three-finger swipe, network recorder, wall display. The Chrome-only DetectAuto
  extension is out of scope.
- **Use Zen's native implementations** wherever one exists — configure and reskin
  rather than porting a parallel implementation. When in doubt, check for a native
  equivalent and report before porting.
- **Auto-updates** will come from the owner's own GitHub releases. Not yet built;
  updates stay disabled until that pipeline exists.
- **Windows builds are made natively on the owner's ThinkStation**, not in CI.
