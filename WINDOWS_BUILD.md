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
| **Python 3.11+** | https://python.org — **check "Add to PATH"** | |
| **Rust** | https://rustup.rs | Needed for the `ffprefs` tool and Firefox itself. |
| **Visual Studio 2022 Build Tools** | https://visualstudio.microsoft.com/downloads/ | Select **Desktop development with C++**, plus **Windows 11 SDK** and **ATL/MFC**. This is the big one (~10 GB). |
| **MozillaBuild** | https://ftp.mozilla.org/pub/mozilla/libraries/win32/MozillaBuildSetup-Latest.exe | Install to the default `C:\mozilla-build`. |

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
2. **Window controls** — Windows uses its own minimize/maximize/close buttons.
   The pref `zen.view.hide-window-controls` is deliberately **false** on Windows
   (true on macOS). If the controls are missing, that pref regressed and the user
   would have no way to close the window.
3. **Fonts** — Windows should render in Segoe UI, not Inter. Driven by a
   `-moz-platform: windows` media query in `src/zen/vector/vector-theme.css`.
4. **Little Arc (the flagship feature)** — a page-initiated `window.open` must
   become a floating centered panel, not a new tab or OS window. **The real test
   is Tekmetric → PartsTech**: open a repair order, punch out to parts, confirm
   the panel carries the login through, that adding parts returns the cart data
   to the estimate, and that dismissing the panel leaves no tab behind.
   Panel width is remembered per site; drag either edge to resize, and
   double-click or right-click an edge grip to save the current width as the
   default for all sites.
5. **Sidebar drag** — dragging the sidebar narrow collapses it to icons;
   dragging back out expands it. In icon mode there is no top URL bar at all;
   a magnifier icon at the top of the icon strip opens a centered floating
   search.
6. **Bitwarden** — auto-installs from `distribution/extensions/` on **first run
   of a fresh profile only**. If it is missing, the profile was created before
   the extension was in place; make a new profile rather than debugging it.
7. **Updates must stay silent.** No "update available" prompts, and absolutely no
   prompt offering real Zen Browser. If one appears, that is a serious
   regression — capture a screenshot and report it.

---

## 6. Known traps (already paid for on macOS — do not rediscover)

- **Spaces in the path** — see ground rule 1. This cost hours.
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

---

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
