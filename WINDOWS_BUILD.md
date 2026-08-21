# Vector — Windows Build Runbook

**Read this first if you are a Claude Code session running on Bruce's Windows PC
(Lenovo ThinkStation P3 Ultra).** This file is self-sufficient: everything needed
to produce a working Windows build of Vector is here or in this repo.

Vector is a Firefox 154 fork (built with the Surfer tool) that reproduces Bruce's
former Electron browser. Windows is the **primary** platform; macOS is secondary.

---

## 0. Ground rules (non-negotiable)

1. **No spaces anywhere in the checkout path.** Firefox's `mach` hard-aborts on a
   path containing a space and symlinks do not help (it resolves realpath).
   Good: `C:\Projects\Vector\Zen-Fork`. Bad: `C:\My Projects\...`.
2. **The product is named Vector.** Nothing user-visible may read "Zen". If you
   see Zen branding in the UI, that is a bug to report, not to accept.
3. **Never edit `engine/`.** It is the downloaded Firefox tree, gitignored and
   regenerated. Real sources live in `src/`; `engine/zen` symlinks to `src/zen`,
   so edits under `engine/zen` write through to tracked files — confirm with
   `git status` before committing.
4. **Report before porting.** If a feature seems missing, check for a native
   Firefox/Zen equivalent first and tell Bruce before writing a port.
5. `mach` suppresses real error output when the `CLAUDECODE` environment variable
   is set. On Windows PowerShell, clear it for a command with
   `$env:CLAUDECODE=$null` in that shell before running mach directly.

---

## 1. One-time machine setup

Everything below is installed once and reused for every later build.

| Tool | How | Notes |
|---|---|---|
| **Git** | https://git-scm.com/download/win | |
| **Node.js 22 LTS** | https://nodejs.org | Node 26 has an `fs.rmdir` removal that breaks one dependency; `scripts/postinstall-fixups.mjs` patches it, but 22 LTS avoids the issue entirely. |
| **Python 3.11+** | https://python.org — **check "Add to PATH"** | The repo's scripts invoke `python3`, which the python.org installer does not create on Windows (and the bare name hits the Microsoft Store stub). After installing, copy `python.exe` to `python3.exe` in the same folder: `$p = Split-Path (Get-Command python).Source; Copy-Item "$p\python.exe" "$p\python3.exe"`. Without this, `npm run import` fails at the `import:dumps` step. |
| **Rust** | https://rustup.rs | Needed for the `ffprefs` tool and Firefox itself. |
| **Visual Studio 2022 Build Tools** | https://visualstudio.microsoft.com/downloads/ | Select **Desktop development with C++**, plus **Windows 11 SDK** and **ATL/MFC**. This is the big one (~10 GB). |
| **MozillaBuild** | https://ftp.mozilla.org/pub/mozilla/libraries/win32/MozillaBuildSetup-Latest.exe | Install to the default `C:\mozilla-build`. |
| **7-Zip** | https://www.7-zip.org (or `winget install 7zip.7zip`) | `7z` must be on PATH (`C:\Program Files\7-Zip`). Surfer shells out to it to unpack the Firefox source archive on Windows; without it `npm run download` fails at the unpack step. |

After installing Rust:

```powershell
rustup target add x86_64-pc-windows-msvc
```

The ThinkStation is x86_64, so that is the only target needed. (`bootstrap.ps1`
in this repo also adds aarch64 — that is for CI cross-builds, not this machine.)

---

## 2. Get the source

```powershell
git clone https://github.com/apbyoda-star/Personal-Browser-Zen.git C:\Projects\Vector\Zen-Fork
cd C:\Projects\Vector\Zen-Fork
git checkout dev
```

`dev` is the working branch — **not** `main`.

---

## 3. First build (long: expect 1–3 hours on this hardware)

Run each step and let it finish before the next. Order matters: `import` needs
Rust available, and `bootstrap` pulls the build toolchain.

```powershell
npm install
npm run download
npm run bootstrap
npm run import
npm run build
```

What each step does:

- **`npm install`** — Node deps + a postinstall fixup for newer Node versions.
- **`npm run download`** — fetches the Firefox 154 source tree into `engine/`
  (large; several GB).
- **`npm run bootstrap`** — Mozilla's own toolchain bootstrap.
- **`npm run import`** — generates prefs, copies localization packs, and applies
  every Vector patch and file from `src/` into `engine/`. **Any time you change
  something under `src/`, this is what carries it into the build.**
- **`npm run build`** — the actual compile.

### After the build

```powershell
npm run dist:apply
```

This copies `distribution/policies.json` into the built app. It is what keeps
Firefox's updater from advertising phantom updates. It must be re-run after any
build that regenerates `dist/`. (The script auto-detects the platform's output
layout — no path editing needed.)

### Run it

The binary lands under `engine\obj-*\dist\bin\`. Launch with a dedicated dev
profile so Bruce's real profile is never touched:

```powershell
engine\obj-x86_64-pc-windows-msvc\dist\bin\vector.exe -profile C:\Projects\Vector\vector-dev-profile
```

(Adjust the `obj-*` folder name to whatever actually exists after the build.)

---

## 4. The fast iteration loop

A full rebuild is only needed for C++ or configuration changes. For UI work —
chrome JavaScript and CSS, which is where nearly all Vector code lives:

```powershell
npm run import
npm run build:ui
npm run dist:apply
```

That cycle takes well under a minute (~25 s on the Mac). Restart the browser to
see changes.

**Never add a newly-registered build file (for example a new `jar.inc.mn`
include) while a build is running** — the build will fail with FILE_NOT_FOUND.
Run `npm run import` first, then build.

---

## 5. What to verify on Windows

Everything below was built and verified on macOS. None of it is Windows-verified
yet. `WINDOWS_VERIFICATION.md` (in the parent project folder — ask Bruce for it
if it is not present) has the fuller checklist; these are the essentials:

1. **Branding** — the window, taskbar, and Start menu all say **Vector** with
   Vector's V icon. No Zen name, spiral logo, fox mascot, or flame icon anywhere.
2. **Window controls — the hover pill** (Windows-verified 2026-08-20).
   `zen.view.hide-window-controls` is **true**: min/max/close live in a
   compact pill that fades in at the **top-right corner** on hover, in BOTH
   sidebar modes. Pure CSS (`#zen-appcontent-navbar-wrapper` rules in
   vector-theme.css) — the Mac side's JS port of the same idea
   ([vector-winctl], commit 87d67d936) was superseded by this and lives only
   in git history. Escape hatches if the pill ever regresses: Alt+F4,
   Alt+Space.
3. **Fonts** — Windows should render in Segoe UI, not Inter. Driven by a
   `-moz-platform: windows` media query in `src/zen/vector/vector-theme.css`.
4. **Little Arc (the flagship feature)** — a page-initiated `window.open` must
   become a floating centered panel, not a new tab or OS window. **The real test
   is Tekmetric → PartsTech**: open a repair order, punch out to parts, confirm
   the panel carries the login through, that adding parts returns the cart data
   to the estimate, and that dismissing the panel leaves no tab behind.
   The panel opens INSTANTLY at a fixed size — width from the Settings →
   Look and Feel "Popout width" control (default 85%), full height,
   centered on the display. There is deliberately NO resizing and NO
   per-site width memory (owner decision 2026-08-20; the old grips port
   was removed). Esc closes it.
5. **Sidebar drag** — dragging the sidebar narrow collapses it to icons;
   dragging back out expands it. In icon mode there is no top URL bar at all;
   a magnifier icon at the top of the icon strip opens a centered floating
   search.
6. **Bitwarden** — NOT bundled (owner decision 2026-08-20, made on Windows;
   supersedes older docs saying it auto-installs). The XPI was never committed
   to `distribution/extensions/` anyway. Install manually from
   addons.mozilla.org if wanted; `dist:apply` still ships
   `distribution/extensions/` if that folder ever gains content.
7. **Updates must stay silent.** No "update available" prompts, and absolutely no
   prompt offering real Zen Browser. If one appears, that is a serious
   regression — capture a screenshot and report it.

---

## 6. Known traps (already paid for on macOS — do not rediscover)

- **Spaces in the path** — see ground rule 1. This cost hours.
- **Git identity must exist before `npm run download`** (Windows trap, found
  2026-08-20). Surfer git-inits `engine/` and commits the pristine Firefox tree,
  but never sets `user.name`/`user.email` (upstream zen-browser/desktop#1877).
  On a machine with no global git identity the commit fails **silently** —
  `npm run download` still exits 0 — leaving `engine/` with everything staged
  and zero commits, which later crashes `mach bootstrap` (`git log` exit 128).
  Fix: `git config --global user.name/user.email` before downloading, or after
  the fact set a local identity in `engine/` and run
  `git commit -aqm "Firefox 154.0"` yourself, plus `git branch 154.0` so the
  version branch exists alongside `vector`.
- **Blank Settings labels** — caused by Zen's repo-root `.ftl` localization files
  never reaching `engine/`. Fixed by the `l10n:en-US` step, which is already
  wired into `npm run import`. If Settings text is blank, that step did not run.
- **Phantom "update available"** — Firefox 154's updater UI mislabels the
  "this build cannot self-update" status as an available update. Solved by the
  `DisableAppUpdate` enterprise policy in `distribution/policies.json`, which is
  why `npm run dist:apply` matters.
- **A stale staged update can resurrect update prompts.** On Windows the update
  cache lives under `%LOCALAPPDATA%\Mozilla\updates\`. Purge it only with the
  browser fully closed, or a running instance will rewrite it on shutdown.
- **`surfer.json`'s `addons` mechanism is broken on FF154** — bundled extensions
  ship to the wrong location. Vector uses `distribution/extensions/` instead.
  Do not "fix" this by moving back to the addons mechanism.
- **Surfer cannot spawn `mach` on native Windows** (found 2026-08-20). Both
  `npm run bootstrap` and `npm run build` pass through to `mach`/`./mach`, which
  Windows cannot execute (`'mach' is not recognized`); bootstrap even exits 0
  despite doing nothing. Zen never hits this because their Windows builds are
  cross-compiled from Linux. Working recipe, proven end-to-end on this machine:
  1. `npm run bootstrap` → instead run, from `engine\`:
     `.\mach.ps1 bootstrap --application-choice browser --no-system-changes`
  2. `npm run ci -- 1.21.15b` once per checkout so the brand is `release`
     (Vector). Skipping this builds "unofficial" (wrong branding).
  3. `npm run build` → still run it once: it writes `engine\mozconfig` and the
     version files before dying at the mach spawn (exit 1 is expected). Then
     from `engine\`, with `MAR_CHANNEL_ID=release` and
     `ACCEPTED_MAR_CHANNEL_IDS=release` in the environment:
     `.\mach.ps1 build`
  4. `npm run build:ui` for the fast loop → same pattern, or `.\mach.ps1 build faster`
     after `npm run import`.
  `npm run download`, `import`, and `dist:apply` work as documented.

---

## 6b. Fast builds (LTO/PGO) on Windows — found 2026-08-20/21

Local builds are NOT release-optimized by default: all the heavy flags (thin
LTO, MOZILLA_OFFICIAL, wasm-SIMD, --enable-release) hide behind the
`ZEN_RELEASE` env var, which only Zen's CI sets. A plain local build scored
23.3 on Speedometer where official-style builds score far higher.

Recipe for an optimized build:

1. **Pin Rust to Firefox's CI version** (154 pins 1.94.1). The rustup-default
   Rust (1.97, LLVM 22) emits LTO bitcode the bundled linker (LLVM 21) cannot
   read — the build dies at xul.dll with "Unknown attribute kind". Fix:
   `rustup toolchain install 1.94.1` then, in `engine\`:
   `rustup override set 1.94.1`. After changing toolchains, WIPE the objdir —
   stale bitcode from the old compiler still breaks the link.
2. Set `$env:ZEN_RELEASE='1'` in the shell running `mach build`.
3. **PGO**: append `ac_add_options MOZ_PGO=1` to `engine\mozconfig`
   (`ac_add_options`, NOT `mk_add_options` — the mk_ form is silently
   ignored). `mach build` then runs three phases: instrumented build,
   a self-driving profiling run (browser windows open themselves — leave
   them), and the final optimized build. Budget 2.5–4 hours; the PC must not
   sleep.
4. Separate objdirs (`mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/obj-…`) let a
   long build run while the previously-built browser stays in use — a
   running instance locks its objdir's files, so never rebuild the objdir it
   runs from.

**TRAP: never edit `engine\mozconfig` (or any mach-read file) with
PowerShell's `Set-Content -Encoding utf8`** — PowerShell 5.1 writes a UTF-8
BOM, and every subsequent `mach` call hangs forever with ZERO output while
the shell chokes on the BOM. Write BOM-less:
`[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))`.

## 7. Where things live

| Path | What |
|---|---|
| `src/zen/vector/` | Vector's own code: theme tokens, sidebar/magnifier behavior |
| `src/zen/glance/ZenGlanceManager.mjs` | **Little Arc** — routing, resize, width memory |
| `prefs/zen/vector.yaml` | Vector's preference overrides (including the updater kill) |
| `configs/common/mozconfig` | App basename/branding — changing this forces a full reconfigure |
| `configs/windows/mozconfig` | Windows target settings |
| `configs/branding/release/` | Vector logo/icon set for every platform |
| `distribution/policies.json` | Enterprise policy that disables the updater |
| `distribution/extensions/` | Bundled extensions (Bitwarden) |

---

## 8. Open work (as of 2026-08-20)

- **Auto-updates from Bruce's own GitHub releases** — decided, not built. Needs a
  release build, an update manifest Firefox can poll, and reversing
  `DisableAppUpdate` once the pipeline is real. Until then updates stay off.
- **Password vault migration** — Bruce's 43 saved logins move from the old
  Electron vault into **Firefox's built-in password manager inside Vector**
  (explicitly *not* Bitwarden). macOS-side task; nothing to do on Windows.
- Later phases: the shop WebExtension (Tekmetric tooling), Slack integration,
  AI features, mail, a Vector-state importer, and retiring the Supabase sync.
  **A Slack OAuth secret in the old Electron source must be rotated** before any
  Slack work ships.
