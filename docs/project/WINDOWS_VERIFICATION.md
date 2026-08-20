# Windows Verification Checklist

**Why this file exists:** authoring happens on the Mac (available anytime, fast `build:ui` loop). The Lenovo ThinkStation P3 Ultra is a work machine, only alongside the Mac **weekdays 7:30am–5:30pm**. That window is scarce, so it is spent **testing, not building** — and never improvising. Items accumulate here as they are written on the Mac; walk the list when the window opens.

**Status key:** ⬜ not yet tested · ✅ verified on Windows · ❌ broken on Windows (file details) · ➖ N/A

---

## How a Windows build gets made (pick one — see MIGRATION_PLAN §0.4)

| Option | Build time | Impact on work machine | Verdict |
|---|---|---|---|
| **Kick off a build on the P3 at ~5:00pm, collect next morning** | overnight, unattended | none during work hours | **Recommended** — a Firefox build needs no supervision |
| **GitHub Actions** | slow on free 2-core runners (hours); Zen's own CI uses paid 8-vcpu runners | none | Good if repo is public or runner minutes are available |
| Build during the workday | ~1hr+ | **hogs the workstation** | Avoid |

First time on the PC: install **MozillaBuild + Visual Studio**, then
`git clone` → `npm i` → `npm run brand:vector` → `npm run download` → `npm run bootstrap` → `npm run import` → `npm run build`.

---

## Checklist

### Phase 1 (spikes — already passed on macOS)
- ⬜ **Bitwarden installs + autofills** — should auto-install from `distribution/extensions/`. Confirm the toolbar/popup works and autofill fires on a real login form.
- ⬜ **Bundled extension loads** — the `builtin-addons` jar mechanism (Spike A) is platform-neutral, but confirm on Windows once the real shop extension exists.

### Phase 2 (branding + theme)
- ⬜ **App name reads "Vector"** in title bar, Start menu, taskbar, and Add/Remove Programs.
- ⬜ **Icons are Vector's, not Zen's or Firefox's** — taskbar, Start tile (`VisualElements_*`), file associations (`document.ico`), private-browsing icon (`pbmode.ico`). *These were regenerated from Vector's master icon on 2026-08-19 and have never been seen on Windows.*
- ⬜ **Font stack** — Windows must use Segoe UI Variable, not Inter. Vector's CSS branched on `html.win`; confirm the port preserved it.
- ⬜ **Installer wizard art** (`wizWatermark.bmp`) — still Zen's artwork, not regenerated. Low priority; cosmetic, installer-only.

### Phase 3 (Zen-native reskin)
- ⬜ **Window controls** — macOS uses traffic lights; Windows needs drawn min/max/close. Vector's hover-reveal pill at top-right was **Windows-only by design**.
- ⬜ **Compact mode hover-reveal** — Zen ships `ZenMouseTrackerWin.cpp`, so a native impl exists; confirm the sidebar reveal feels right with a mouse (not a trackpad).
- ⬜ **Gestures** — 2-finger swipe is trackpad-centric. Confirm what a mouse user gets; may need keyboard-only fallbacks on the PC.

### Phase 4 (custom chrome UI)
- ⬜ **Little Arc / PartsTech punch-out** — THE critical one. Verified mechanically on macOS; must confirm on Windows with a real Tekmetric session: panel opens, auth carries, data returns to opener, dismiss leaves no tab.
- ⬜ **Always-on-top Slack popup** — `CHROME_ALWAYS_ON_TOP` maps to `HWND_TOPMOST` on Windows. Confirm it floats and does not steal focus.

### Phase 6 (shop tools)
- ⬜ **Silent printing** to a named printer (`nsIPrintSettings.printSilent` + `printerName`) — TYC cards, AR statements, dispatch list. Windows printer names/trays differ.
- ⬜ **BG LAN print server** (`http://<host>:8080/print`) — plain fetch, should be identical; confirm on the shop LAN.
- ⬜ **UDP LAN nudge** (`nsIUDPSocket`, multicast 239.255.42.99 + broadcast, port 47799) — **Windows Firewall will likely prompt or block.** Verify multicast join works and peers are heard.
- ⬜ **Tekmetric token capture** via `webRequest` — platform-neutral, but confirm.

### Phase 7 (data migration)
- ⬜ **Profile paths** — Windows profile lives under `%APPDATA%`, not `~/Library`. Confirm the Vector-state importer resolves paths correctly.
- ⬜ **Password import** into Firefox's login manager.
- ⬜ **Windows Hello unlock** (`nsIOSReauthenticator`) — replaces Touch ID for password reveal.

---

## Findings log
*(record anything that behaves differently on Windows)*

| Date | Item | Result | Notes |
|---|---|---|---|
| | | | |
