# Vector → Zen Fork Migration Plan (authoritative, v2)

**Status:** Plan finalized against the owner's decisions of 2026-08-19. **PHASE 0 COMPLETE (2026-08-19, 15:48)** — stock Zen builds and launches from source on this machine. Next: Phase 1 spikes (A: bundled WebExtension, B: Bitwarden, C: Little Arc / PartsTech punch-out).

**Phase 0 result:** full build 52m30s (cold, no ccache), 4,382 object files, 222 MB XUL, 14 GB objdir. Launches to a working browser: vertical sidebar, Spaces, floating centered urlbar with suggestions, single-toolbar mode (no top chrome bar). Four environment blockers hit and resolved — see §0.

**Goal:** Reproduce Vector's exact look and the behaviors the owner actually uses, on a real Firefox base (the Zen fork), eliminating the bot-detection problems Electron/Chromium-disguise caused. Prefer Firefox/Zen natives over ported workarounds everywhere; the only things rebuilt from scratch are the genuinely-custom shop/Slack/AI application logic.

**This document supersedes v1.** It folds in `NATIVE_PARITY_AUDIT.md` and the owner's rulings. Where they changed the earlier plan, §1 lists the changes explicitly.

**Companion docs:**
- `NATIVE_PARITY_AUDIT.md` — per-feature evidence (verified APIs, Zen prefs, intent-vs-workaround quotes). Retained as the rationale record.
- Standing rule (owner, binding): **if an elaborate Vector subsystem comes up that isn't settled below, check for a Firefox/Zen native equivalent first and report the finding before porting. Do not decide alone.**

---

## 0. Folder names & the build gate

Project root: `/Users/bruceyoder/Projects/Apps/Zen-Base-New-Browser/`

| Role | Path |
|---|---|
| REFERENCE (read-only, never modify) | `Vector Source/` |
| TARGET | `Source/Zen-Fork/` |

**⚠️ Paths must not contain spaces.** Firefox's `mach` hard-aborts on any checkout path containing a space (`build/mach_initialize.py` → `check_for_spaces`), and a symlink does not help because it resolves the real path first. The project root and fork folder were therefore renamed on 2026-08-19 (`Zen Base New Browser` → `Zen-Base-New-Browser`, `Zen Fork` → `Zen-Fork`). `Vector Source/` keeps its space — it is a read-only reference and never builds. **Never reintroduce a space into any ancestor of `Source/Zen-Fork/`.**

**Phase 0 build sequence (note the reordering).** `npm run init` chains download → import → bootstrap, but *import* runs `ffprefs` which needs **cargo**, and cargo is installed by *bootstrap*. Run the steps individually in this order instead:

```
npm i
npm run download      # surfer: fetch + unpack FF 154, git-init the engine tree
npm run bootstrap     # mach bootstrap: installs Rust + build toolchain
npm run import        # ffprefs + service dumps + surfer import (applies patches)
npm run build         # full compile
npm start             # launch
```

After the first full build, UI-layer work (CSS/JS/XHTML under `src/`) iterates fast via `surfer import` + `npm run build:ui` — no C++ recompile.

**macOS prerequisites discovered during Phase 0:**
- **GNU tar** is required by surfer to unpack the source (`brew install gnu-tar`). Without it, `npm run download` fails at the unpack step.
- **Full Xcode is NOT needed** — Command Line Tools suffice; Zen's `configs/macos/mozconfig` looks for SDKs under `/Library/Developer/CommandLineTools/SDKs/`.
- **Rust/cargo** comes from `mach bootstrap`; do not run `import` before `bootstrap`.
- `surfer bootstrap` rejects pass-through flags — call `python3 ./mach bootstrap` inside `engine/` directly when flags are needed.
- **Node 26 breaks surfer's branding step.** `async-icns@1.0.2` (transitive dep, generates the macOS `.icns`) calls `fs.rmdir(path, {recursive:true})`, an option **removed in Node 26**. `npm run import` fails at "Apply 2 branding patches" with `ERR_INVALID_ARG_VALUE`. Fix applied locally in `node_modules/async-icns/icns.js` — swap `rmdir` for `rm`:
  ```
  sed -i '' "s|const { mkdir, rmdir } = require('fs/promises')|const { mkdir, rm } = require('fs/promises')|" node_modules/async-icns/icns.js
  sed -i '' "s|await rmdir(tmpDirectory, { recursive: true })|await rm(tmpDirectory, { recursive: true, force: true })|" node_modules/async-icns/icns.js
  ```
  **This lives in `node_modules/` and is wiped by any `npm i` — re-run those two lines after reinstalling.** If further Node-26 incompatibilities surface in Zen's toolchain, switch the build to a Node 22 LTS (e.g. via `fnm`/`.nvmrc`) rather than patching each one.

---

## 0.4 ⚠️ PLATFORM PRIORITY: **Windows first, macOS second** (owner, 2026-08-19)

Vector must run on **both**, with **Windows as the primary target**. This was clarified after Phase 0/1 were done on macOS; it does not invalidate that work (all ported code is cross-platform) but it changes verification and build logistics.

**Hard fact: a Windows build CANNOT be produced from this Mac.** Zen builds Windows by **cross-compiling from Linux**, not on Windows:
- `.github/workflows/windows-release-build.yml` → `runs-on: blacksmith-8vcpu-ubuntu-2404` (Ubuntu) with `ZEN_CROSS_COMPILING=1`, `SURFER_PLATFORM=win32`
- Requires `~/win-cross/vs2026` (Visual Studio files via `build/vs/vs2026.yaml` + `get_vs.py`) and `~/win-cross/wine` (Mozilla's **linux64**-wine toolchain)
- `configs/windows/mozconfig` targets `x86_64-pc-windows-msvc` / `aarch64-pc-windows-msvc`

Mozilla's prebuilt wine toolchain is Linux-only, so the macOS host cannot drive this path.

**Three viable Windows-build routes:**
| Route | What it needs | Notes |
|---|---|---|
| **GitHub Actions** (recommended) | a repo + the workflows already in-tree | This is exactly how Zen ships Windows; workflows exist and are ready to adapt |
| **Linux box / VM** | Ubuntu + `win-cross` toolchain (`get_vs.py` + wine) | Mirrors CI locally; heavy one-time setup |
| **Native Windows machine** | MozillaBuild + Visual Studio (`build/windows/bootstrap.ps1`) | Standard Firefox-on-Windows build; best for day-to-day dev if the owner's daily driver is Windows |

**Implications for the plan:**
1. **No migration work is wasted.** CSS, chrome JS, prefs, and the WebExtension are all platform-neutral.
2. **Verification must happen on Windows** for anything platform-sensitive: window controls, the Little Arc panel, silent printing (`nsIPrintSettings.printSilent`), the LAN nudge (`nsIUDPSocket`), Touch ID→**Windows Hello** (`nsIOSReauthenticator`), and Zen's native mouse tracker (`ZenMouseTrackerWin.cpp` exists — good).
3. **Windows branding is now first-class**, not an afterthought — regenerated from Vector's icon (see §0.5).
4. **The macOS build remains the fast dev loop on this machine**; treat it as the iteration target, with Windows as the release/verification target.

---

## 0.5 Branding — the product is **Vector**

**Owner decision (2026-08-19): the browser is called Vector and keeps Vector's existing logo, favicon, and all brand assets.** The fork is a Zen *base*, not a Zen *product* — nothing should ship reading "Zen".

**Source assets (already in the repo):**
| Asset | Path | Notes |
|---|---|---|
| App icon (master) | `Vector Source/build/icon.png` | **1024×1024** — ideal single source |
| Windows icon | `Vector Source/build/icon.ico` | |
| Logo (mark only) | `Vector Source/Vector Logo transparant Backgroud.png` | 1536×1024 |
| Logo + name | `Vector Source/Vector Logo+Name Transparent Backgroung.png` | for About / start page |
| Logo + name + tagline | `Vector Source/Vector Logo + Name + Tagline Transparent background.png` | marketing / welcome |

**What has to change:**
1. **`surfer.json` identity** — `name` ("Zen Browser" → "Vector"), `vendor`, `appId` (`zen` → `vector`), `binaryName` (`zen` → `vector`), and every brand block's `brandShortName` / `brandShorterName` / `brandFullName`. Also `updateHostname` (currently `updates.zen-browser.app` — irrelevant unless self-updating is wanted; see §8 open infra).
2. **`configs/common/mozconfig`** — `--with-app-basename=Zen` and `export MOZ_APP_BASENAME=Zen` → `Vector`. `--with-app-name=${binName}` follows `binaryName` automatically. Also `--with-distribution-id=app.zen-browser`.
3. **`configs/branding/<brand>/`** — replace the generated icon set (`logo16/22/128/1024.png`, `logo.png`, `logo-mac.png`, `firefox.icns`, `firefox.ico`, `firefox64.ico`, `VisualElements_70/150.png`, `PrivateBrowsing_70/150.png`, `document*.ico`, `MacOSInstaller.svg`, plus `content/`). Because `buildOptions.generateBranding: true`, **surfer regenerates most of these from a source image** via `async-icns` — supplying Vector's 1024×1024 `icon.png` should produce the set rather than hand-authoring each size. Verify which files are generated vs. which must be supplied by hand.
4. **Localized brand strings** — `locales/en-US/browser/branding/brand.ftl` (and any `zen-*.ftl` referencing the name).

**Cost warning — this is not a free change.** Editing `MOZ_APP_BASENAME` / `--with-app-basename` in mozconfig forces a **configure re-run**, which means a large rebuild (potentially close to a full one), not a `build:ui` refresh. Branding-only asset swaps are cheaper. **Therefore: batch the rebrand with any other mozconfig-level changes and do it as one deliberate step**, rather than trickling changes that each trigger a reconfigure.

**Sequencing:** Phase 0's current build intentionally ships stock `unofficial` Zen branding — its only job is to prove the toolchain works end to end. Rebranding to Vector lands as the **first task of Phase 2**, batched with any other configure-level settings, paying the rebuild cost exactly once.

---

## 1. What changed from v1 (owner decisions applied)

Every one of these is now settled — they are not open questions.

**Deletions (v1 planned to port/re-architect; now removed entirely):**
- **Custom password manager** (`main/passwords.ts`, save bar, pw autofill preload) → **DELETE.** Adopt Firefox native manager + the **Bitwarden Firefox extension**. The custom vault only existed to work around Bitwarden issues. *Migrate stored entries out and verify against a copy before deleting anything.*
- **Card/contact vault + on-page pickers** (`main/payments.ts`, `contacts.ts`, `app-lock.ts`, `preload/payment-autofill.ts`, `contact-autofill.ts`) → **DELETE.** Native `formautofill` is enough. No CVV storage, no labeled Home/Work/Shop picker.
- **Supabase sync** (`main/sync/**`, `shared/vault.ts`, `Account.tsx`) → **RETIRE.** Move to Firefox/Zen Sync. All machines cut over at once, so no old-Vector interop window. The scrypt-parity concern is void. *Export anything needed off Supabase before teardown.*
- **Arc import** (`main/arc-import*.ts`, `ArcImport.tsx`) → **DROP.** Replaced by a one-shot **Vector-state importer** (§6).
- **TopRail top-dock mode** (`TopRail.tsx`) → **DROP.** Unused experiment.
- **3-finger swipe** (`main/gestures.ts` swipe half, `index.ts:3694-3703`) → **DROP.** 2-finger + keyboard cover it.
- **Network recorder** (`shop/recorder.ts`, pagebridge recorder) → **DROP.** DevTools HAR export suffices.
- **Wall display** (`main/wallboard.ts`, `preload/wallboard.ts`, wallboard settings) → **DROP.** Out of scope.
- **Onboarding wizard** (`Onboarding.tsx`) → **DROP the custom wizard;** instead **extend Firefox/Zen's native welcome** with one Vector step (§4).

**No companion service — reversed from v1.** The owner confirmed the Slack popup only needs to float **within the browser** (they never leave the browser on that machine). That was the last out-of-process justification. **All four former-companion jobs now run from the fork's privileged chrome layer:**
- UDP LAN nudge → `nsIUDPSocket` in a chrome `.sys.mjs` (multicast verified scriptable).
- Silent/tray printing → `nsIPrintSettings.printSilent` + `printerName` + `nsIPrinterList` from chrome.
- Secret storage → `OSKeyStore` (chrome-layer, keychain-grade).
- Slack interrupt popup → chrome `window.open(…"alwaysontop"…)` (`CHROME_ALWAYS_ON_TOP`), browser-level.

**DetectAuto → OUT OF SCOPE.** Chrome-only extension, no Firefox build exists (confirmed on AMO). Owner keeps Chrome for that one workflow. Every place the shop suite assumed DetectAuto runs in the fork is marked out of scope; its chrome-runtime shim and external-messaging relay are deleted with the rest of the extension host.

**All 10 audit overrides accepted — use Zen natives, do NOT port Vector's parallel systems:**
- FolderPeek → Zen's collapsed-folder hover search (`zen.folders.search.enabled`).
- Drag-and-drop → Zen's `ZenDragAndDrop.js`. **Explicitly: do not port Vector's pointer-drag engine alongside Zen's.**
- Pinned sleep/reset → Zen's `ZenPinnedTabManager` (`zen.pinned-tab-manager.close-shortcut-behavior: reset-unload-switch`).
- Command box → Zen's floating urlbar + quick-actions provider.
- Gradient/recolor → Zen's `ZenGradientGenerator`.

**Two spikes moved to the front (before any other Bucket C work):**
1. **Bundled-WebExtension loading** via the fork's build config (no in-tree precedent). Fallback named in §3.
2. **Bitwarden Firefox build** works in the fork (the owner now depends on it instead of the custom vault).

**Kept:** Clipboard screenshot capture (Library → Media) — the owner uses it; check Firefox Screenshots overlap before porting the whole thing (§6).

---

## 2. Disposition model

Each Vector feature is now one of: **DELETE** (native, gone — ~9,000+ lines), **CONFIG** (native + set prefs), **RESKIN** (native behavior + Vector CSS), **EXTEND** (build Vector's delta on a Zen base), **PORT** (genuinely custom — the shop/Slack/AI application, ~14 items), or **DROP** (per §1). Full per-item evidence lives in `NATIVE_PARITY_AUDIT.md` §1–§6; this plan carries the settled disposition and where each lands in the Zen tree.

**The dominant fact:** almost everything browser-shaped is DELETE/CONFIG/RESKIN/EXTEND. What you actually rebuild is your business logic, not a browser.

---

## 3. Front-loaded spikes (Phase 1 — before any Bucket C work)

**Spike A — Bundled WebExtension loading.** `surfer.json`'s `addons: {}` is empty and there is **zero in-tree example**. Test whether a minimal bundled WebExtension actually loads in a fork build.
- **Primary:** declare it in `surfer.json addons` (Surfer downloads/installs as built-in). The build already permits unsigned app/system add-ons (`configs/common/mozconfig`: `--with-unsigned-addon-scopes=app,system`, `MOZ_REQUIRE_SIGNING=` unset).
- **Fallback if that fails:** ship the `.xpi` in the packaged app's **`distribution/extensions/<id>.xpi`** folder — Firefox's long-standing distribution-extension mechanism, independent of Surfer. Second fallback: in-tree `browser/extensions/<name>/` like Firefox's own built-ins (heavier: needs a `moz.build` + jar packaging).
- **Deliverable:** a one-line answer to the owner — "bundling works via X" or "it doesn't; using distribution/extensions."

### ✅ SPIKE A RESULT (2026-08-19): PASSED — but surfer's `addons` mechanism is BROKEN on FF154

**Verified working.** A bundled, unsigned WebExtension loads and executes:
```
id         : vector-spike-a@vector.local
location   : app-builtin-addons
active     : True
rootURI    : resource://builtin-addons/vector-spike-a/
signedState: None            <- unsigned, loaded anyway
```
Background script executed and WebExtension APIs work (`browser.runtime.getPlatformInfo()` returned `mac aarch64`).

**⚠️ Do NOT use `surfer.json`'s `addons` field.** It is stale for Firefox 154. Surfer downloads the xpi and generates `FINAL_TARGET_FILES.features["<id>"]`, shipping to `<app>/browser/features/<id>/`. But in FF154 `XPIProvider.sys.mjs` registers that directory as `KEY_APP_SYSTEM_ADDONS` keyed on **`KEY_PROFILEDIR`** — i.e. `<profile>/features`, *not* the app dir. Nothing scans the app-level path, so the extension ships in the bundle and is silently never installed. (Confirmed empirically: files present in `Contents/Resources/browser/features/`, absent from the profile's `extensions.json`.) The `addons` block has been reverted to `{}`.

**✅ Use the modern built-in mechanism instead.** `built_in_addons.json` is generated at build time by `toolkit/mozapps/extensions/gen_built_in_addons.py`, which **scans `browser/chrome/browser/builtin-addons`** from the install manifests. So an extension only needs a `jar.mn` mapping into that path and it is auto-registered — no manifest editing required. Working recipe (`engine/browser/extensions/vector-spike-a/`, kept in-tree as the reference implementation):

`jar.mn`:
```
browser.jar:
  builtin-addons/<name>/manifest.json (manifest.json)
  builtin-addons/<name>/bg.js (bg.js)
```
`moz.build`:
```
JAR_MANIFESTS += ["jar.mn"]
```
plus `DIRS += ["<name>"]` appended to `browser/extensions/moz.build`.

**For the real shop extension, make it reproducible via surfer:** place the extension under `src/browser/extensions/<name>/` (plain new files — surfer copies them into `engine/` on import) with its own `jar.mn` + `moz.build`, and add the `DIRS` entry through a patch to `src/browser/extensions/moz-build.patch`. That survives `surfer import` and a clean rebuild, unlike hand-edits inside `engine/`.

**Cost:** adding/altering a bundled extension is a **~22-second incremental rebuild**, not a full compile. Cheap to iterate.

**Cleanup owed:** `vector-spike-a` is currently still bundled as a test extension; remove it (or replace it with the real shop extension) before any real use.

**Fallback (not needed):** `distribution/extensions/` was the planned fallback and proved unnecessary.

**Spike B — Bitwarden on the fork.** Install the Bitwarden Firefox build in a fork build; verify unlock, autofill, and popup work. This gates the password-manager deletion (don't delete the old vault until Bitwarden is confirmed + entries migrated).

### ✅ SPIKE B RESULT (2026-08-19): PASSED (one manual step left for the owner)

Bitwarden 2026.7.0 installs, activates, and runs in the fork:
```
id          : {446900e4-71c2-419f-a6a7-df9c091e268b}
location    : app-profile
active      : True      appDisabled: False   userDisabled: False
signedState : 2  (fully AMO-signed)
granted     : <all_urls>, *://*/*, file:///*  + webRequest, webRequestBlocking,
              clipboardRead/Write, tabs, notifications, contextMenus, idle, storage...
```
**Functional proof:** on install it executed its background script and opened its own onboarding tab (`tabs.create`), which appeared correctly in Zen's sidebar with its favicon. All requested permissions were granted; no extension errors in the log. (The repeated `sandbox_extension_issue_file_to_process ... Operation not permitted` lines are normal for an unsigned local dev build and unrelated to add-ons.)

**Delivery mechanism — solved, and better than per-machine installs.** Bitwarden was installed by dropping the signed xpi into `<App>/Contents/Resources/distribution/extensions/{guid}.xpi`. Firefox auto-installs it into each new profile (`location: app-profile`) and it still updates normally from AMO. **This is how to ship Bitwarden to every shop machine automatically** — no per-machine manual install for other employees. Note this is a *different* mechanism from the built-in path in Spike A: use `distribution/extensions/` for third-party add-ons that should auto-update, and the `builtin-addons` jar path for our own bundled shop extension.

**Two useful findings:**
1. Bitwarden ships **Manifest V2 with `webRequestBlocking`** and Firefox 154 accepts it — confirming the audit's claim that Firefox retains blocking webRequest. Good news for the shop suite's `webRequest` token capture.
2. Bitwarden declares a **`sidebar_action`** (`popup/index.html?uilocation=sidebar`), so it can live in Firefox's native sidebar — an integration Vector never had under Electron.

**⚠️ Remaining manual step (owner):** log into the Bitwarden vault and confirm autofill on a real login form. This could not be automated — macOS blocks synthetic keystrokes without Accessibility permission, so the popup could not be clicked. Risk is low: the Electron popup problems were caused by `electron-chrome-extensions` popup-sizing hacks that Vector had to patch, and that failure mode does not exist in real Firefox where extension popups are native. **Do this before deleting `main/passwords.ts`.**

**Spike C — Little Arc / PartsTech punch-out (see §3.5).** Instrument `createContentWindowInFrame` in a fork build, click Tekmetric's real "Add part → Add part from PartsTech" button, and record whether the hook fires and with what window features. This is the one empirical unknown in an otherwise-verified design, and it decides whether a pref flip is needed. **Do this in Phase 1 — the owner must know before Phase 2 if it can't work.**

All three spikes are cheap and de-risk the load-bearing assumptions before real work starts.

### ✅ SPIKE C RESULT (2026-08-19): **PASSED — Little Arc is achievable.** Go.

Empirically verified on the real build by instrumenting `BrowserDOMWindow.createContentWindowInFrame` and Zen's Glance gate, then auto-firing four `window.open` variants.

**1. The hook fires, and the opener survives.** Every intercepted call carried `hasOpenWindowInfo=true` with `aWhere=3` (OPEN_NEWTAB). A full opener round-trip was proven end to end:
```
parent_got_window_object=true
child_loaded / has_opener=true / opener_closed=false
postMessage_sent=true
PARENT_RECEIVED_MESSAGE=CART_HANDBACK_FROM_CHILD   <-- the PartsTech->Tekmetric pattern
cookie_write=OK
```
**This settles the blocker question: `window.opener` stays live and the cart-handback path works.**

**2. The predicted popup-diversion problem is REAL — and the pref fixes it.** With stock settings, a sized popup silently bypassed the hook entirely:

| Case | features | reached hook (default) | reached hook (`restriction=0`) |
|---|---|---|---|
| A plain | *(none)* | ✅ | ✅ |
| B sized popup | `width=1200,height=800` | ❌ **MISSED** | ✅ |
| C sized + full chrome | `width/height + location,toolbar,menubar,scrollbars,status,resizable` | ✅ | ✅ |
| D noopener | `noopener` | ✅ | ✅ |

Case B vs C confirms it is **not** about size — it is `ShouldOpenPopup()`: any non-empty feature string that doesn't re-enable location/toolbar (etc.) is classed a popup, gets `CHROME_MINIMAL_POPUP`, and `GetWindowOpenLocation` sends it to a real OS window *before* `nsIBrowserDOMWindow` is consulted.

**Required pref (confirmed working):**
```
browser.link.open_newwindow.restriction = 0     // default is 2
```
With it, **all four cases** reach the hook. Ship this in `prefs/zen/vector.yaml`. Trade-off: it also routes OAuth/payment popups into the panel — desirable here, but a conscious choice.

**3. Why stock Zen failed the owner's Tekmetric test — confirmed, it's the gate, not the mechanism:**
```
SPIKEC|gate|hasOwner=true|ownerPinned=false|ownerIsAppTab=false
            |ownerHasGlanceId=false|prefExternal=true
            |domainsDiffer=true|glanceEnabled=true
```
Every condition passes **except `ownerPinned` and `ownerIsAppTab`**. `shouldOpenTabInGlance` demands the opener be a pinned essential/app tab; an ordinary Tekmetric tab fails and falls through to a normal tab. Replacing that predicate is the core of the implementation.

**Verdict: GO.** No blocker. Implementation = (a) ship `browser.link.open_newwindow.restriction=0`, (b) replace `shouldOpenTabInGlance` with the Vector routing rule (opener-host based; search engines → tab, else → panel), (c) pass a synthetic rect, (d) suppress the tab-strip badge, (e) handle the single-glance limit, (f) chrome-level Esc. All instrumentation has been reverted; test pages kept in `spikes/spike-c-littlearc/` for regression use.

---

## 3.5 Little Arc / Arc Mini — FIRST-CLASS REQUIREMENT

**Why it's first-class:** this is the single reason stock Zen was rejected. When a *page* requests a new window, it must open in a floating panel over the current page — dismissible back to exactly where you were with no tab created, optionally promotable to a real tab. The load-bearing case: Tekmetric's "Add part → Add part from PartsTech" (a JS `window.open` carrying auth tokens) must open in the panel, keep the auth handoff, let PartsTech return data to the Tekmetric opener, and dismiss without creating a tab.

**Correction to v2:** v2 listed this as "EXTEND on Glance," which wrongly conflated Glance's *trigger* with its *presentation*. Glance's anchor-click trigger can never fire for `window.open`. But the investigation found Zen **already has a separate page-initiated path**, so the presentation layer is reusable after all — via a different entry point than v2 assumed.

### Feasibility verdict: YES — opener and session survive by construction

Gecko sets `window.opener` from `nsIOpenWindowInfo.parent` inside `BrowsingContext::CreateDetached`, in the **content process, before the parent process is consulted**. It is not influenced by where the chrome hosts the resulting `<browser>`. Cookie-jar sharing is governed by OriginAttributes (`usercontextid`, privateBrowsingId), not by DOM position. So a panel-hosted browser keeps `window.opener`, cookies, localStorage, sessionStorage, referrer, and named target — **provided the original `nsIOpenWindowInfo` is passed through untouched and the browser is never re-created**.

Precedent that this is legal: Firefox's own **print preview** appends a `<browser>` directly to `document.documentElement` (outside `<tabbrowser>`) and returns it to Gecko as the frame for a page-initiated `window.print()` window (`toolkit/components/printing/content/printUtils.js:400-410`).

### The approach: Zen's pattern (real tab + CSS float), NOT a hand-built panel browser

Zen's Glance never creates its own `<browser>` and never moves one. It lets `gBrowser.addTab` build a fully normal tab, then re-parents only the **`<tab>` element** (which has no frameLoader, so moving it is free) and floats the *existing* `.browserSidebarContainer` with CSS. Opener, cookie jar, session restore, process switching, and promote-to-tab all keep working because the browser never leaves tabbrowser's ownership.

**Hard rule — never `appendChild` a `<browser>`.** `XULFrameElement::UnbindFromTree` destroys the frameLoader unless the move is an atomic `moveBefore()`. A plain remove+insert discards the BrowsingContext, reloads the page, and **loses the opener** — silently defeating the entire feature.

*Refinement:* `ParentNode.moveBefore()` **does** now preserve the frameLoader on `<browser>` elements — bug 2007742, fixed Firefox 149, and our base is 154. `browser-custom-element.mjs` even carries a no-op `connectedMoveCallback()` explicitly to allow it. So moving a live browser is a legitimate fallback if the CSS-float approach hits a wall. Two constraints: `moveBefore` requires the **same composed root** (cannot cross chrome windows — that still needs `swapFrameLoaders`/`swapDocShells`), and moving into/out of a XUL `<panel>` was flagged as potentially needing popup-boundary fixups with no popup-specific handling in the landed patch. Zen's CSS-float sidesteps the question entirely, so it stays the primary approach.

### The seam already exists (one line of Zen patch)

```
page window.open()
  → nsGlobalWindowOuter::OpenInternal → nsWindowWatcher::OpenWindowInternal
  → nsIWindowProvider (ContentChild::ProvideWindowCommon — BC + opener created HERE)
  → ContentParent::CommonCreateWindow
  → BrowserDOMWindow.createContentWindowInFrame          ← src/browser/modules/BrowserDOMWindow-sys-mjs.patch:19
      → gZenGlanceManager.onTabOpen(browserEl, uri)      ← ZenGlanceManager.mjs:1568
          → shouldOpenTabInGlance()                      ← :1548  ** OUR POLICY GOES HERE **
              → #openGlanceForTab()                      ← :1588  ** OUR RECT GOES HERE **
                  → openGlance(data, existingTab, ownerTab)  ← :385  THE SEAM (adopts, never re-creates)
```

**Why stock Zen failed the owner's test:** not a missing mechanism — a gate. `shouldOpenTabInGlance` requires the opener to be a **pinned essential/app tab** (`owner.pinned && owner.linkedBrowser?.browsingContext?.isAppTab`) on a different domain. A normal Tekmetric tab fails that predicate and falls through to a plain tab.

### Work required

1. **Replace the predicate** (`shouldOpenTabInGlance`) with a Little Arc rule (below). Drop the pinned/app-tab requirement.
2. **Supply geometry** in `#openGlanceForTab` — Little Arc has no click rect; pass a synthetic viewport-center rect (the search trigger already does this via `gZenUIManager._lastClickPosition`).
3. **Suppress the tab badge.** A glance renders a small favicon badge on the opener's tab row. Add a `[little-arc]` attribute + CSS rule so nothing appears in the strip (`vertical-tabs.css:372`).
4. **Handle the single-glance limit.** `openGlance` bails if one is already open (`:386-392`) — a second `window.open` mid-punch-out would silently leak a real tab. Decide: replace, queue, or explicit fallback-to-tab.
5. **Esc at chrome level** — Glance's Esc lives in a content actor, so it only fires while the page has focus. (Vector had the identical bug.)
6. **Bypass the cross-domain gate** (`tabDomainsDiffer`) so same-domain punch-outs work.

### Routing rule (proposed)

Vector's shipped rule used exactly one input — the **opener's host** — and no target-URL matching: search-engine sources (`google.`, `bing.com`, `duckduckgo.com`, `search.yahoo.`, `search.brave.com`, `ecosia.org`, `startpage.com`, `baidu.com`) open a normal tab; **everything else becomes a panel**. A URL-matched "document popup" branch was tried and deliberately removed. Adopt that rule as the baseline, plus Gecko-specific exclusions: skip `isForPrinting`/`isForWindowDotPrint`, skip `forceNoOpener` opens (nothing to preserve), and keep the http/https/file restriction.

### The one open empirical question → Spike C

`GetWindowOpenLocation` routes **"popups"** to `OPEN_NEWWINDOW` *before* `nsIBrowserDOMWindow` is consulted — so they never reach the hook. Crucially, this is **not** a size check and not merely "were features supplied." It is `ShouldOpenPopup()` (`nsWindowWatcher.cpp:1848`, a direct implementation of the HTML spec's "popup window is requested"), and `restriction=2` then tests `chromeFlags != CHROME_ALL`:

- `window.open(url)` → empty features → **never** a popup → reaches our hook. ✅
- `window.open(url, 'n', 'width=1200,height=800')` → popup (location/toolbar default false) → real OS window, hook never fires. ❌
- `window.open(url, 'n', 'toolbar=yes,location=yes,menubar=yes,resizable=yes,scrollbars=yes,status=yes')` → features supplied but **not** a popup → still reaches our hook. ✅
- `target="_blank"` → passes `aCalledFromJS=false` with an empty feature string, so the restriction block is skipped entirely → always follows `open_newwindow` → reaches our hook. ✅

**The fix, if needed, is one pref.** Firefox's own in-tree test (`dom/tests/browser/browser_test_new_window_from_content.js:58-77`) is the ground truth, and with `browser.link.open_newwindow=3` it reads:

| `window.open` form | restriction=0 | restriction=1 | restriction=2 (default) |
|---|---|---|---|
| default features | new tab | new window | new tab |
| popup features | **new tab** | new window | new window |

So **`browser.link.open_newwindow.restriction=0`** ("no restrictions — divert everything") routes even featured popups back through the tab path and into our hook. A pref, not a C++ patch. Trade-off: it also diverts OAuth/payment popups into the panel — arguably desirable here, but a conscious choice.

Spike C answers which case Tekmetric is in, with one instrumented click. Two secondary verifications while there: POST-body survival through the panel path (inferred from `aLoadState` → `DocumentLoadListener`, not directly observed), and that `browsingContext.id` is unchanged after the float.

*Also worth knowing:* the front-end restriction that `openURIInFrame` "can only open in new tabs or print" (`BrowserDOMWindow.sys.mjs:480-493`) is a **front-end policy line**, not an engine constraint — it's a `dump()` and a `return null`. Gecko itself only requires the returned element to be an `nsFrameLoaderOwner` with a laid-out frameLoader. GeckoView proves the general case: `GeckoViewNavigation.sys.mjs:348-383` returns a non-tab `<browser>` from `createContentWindowInFrame` for page-initiated opens.

### Improvements over Vector (adopt deliberately)

- **Promote-to-tab keeps the opener.** Vector's `mini:expand` destroys the guest and re-GETs the URL, losing `window.opener` and page state. In Zen the glance *is* already a tab, so promotion is just un-nesting + attribute removal — session, scroll, and opener all survive.
- **Fix `miniTabId`.** Vector never set it on adopted popups, so real punch-outs floated over *every* tab — the exact bug its own comments claim to have fixed. Bind ownership from the opener's tab at adoption.
- **Decide nested-popup semantics.** Vector's nested popup *destroys its own parent*, breaking a two-hop punch-out chain. Choose stacking or replace-one deliberately.

### Keep from Vector (genuine UX, all portable)

Backdrop dim (deliberately no blur — GPU cost on Windows), centered near-full-height card with 12px gutters, controls in the right-side gutter (validated against a real Arc screenshot), symmetric edge resize (both edges move, card stays centered), and **per-hostname persisted width** with an explicit `*` default and a pre-paint latch to avoid resize flicker. Discard all Electron z-order plumbing and the entire pdf.js capture pipeline (Gecko renders PDFs natively in any browsing context).

---

## 4. Buckets — settled dispositions

### DELETE — native (no port; styling only where noted)
The full list is `NATIVE_PARITY_AUDIT.md` §1. Highlights, all verified against a named API/pref:
- **Chrome-extension host + ext-api shims + both npm patches** (`main/extensions.ts`, `ext-api/**`, `patches/*`) — Firefox's native WebExtension engine (sidebar_action, identity, event pages, full webRequest incl. blocking in MV3, AMO/about:debugging).
- **Overlay z-order machinery** (`overlayHold.ts`, `view:setOverlay/setContentBounds`, `chrome:focus`) — Firefox chrome always paints above content; normal DOM focus.
- **PDF-in-PiP capture + image-print pipeline** — pdf.js native in any `<browser>`; `PrintUtils` preview; silent print via `nsIPrintSettings`.
- **UA/client-hints spoofing + Chrome-identity shims** — the whole reason for the migration; delete.
- **webrequest-mux, net-fetch dual-stack, single-instance lock, DPI-overhang repair, permission gating, find backend, page-zoom backend, downloads backend, context menu/spellcheck, omnibox suggest proxy, tab-eviction, vector-att protocol, pdf-parse, focus plumbing** — each native.
- **Vault biometrics / safeStorage / PowerShell-Hello bridge** — `nsIOSReauthenticator` + `OSKeyStore` (Touch ID/Hello native).
- **Auto-updater** — native Firefox updater + MAR (Zen proves the fork path); needs an update-host **decision** (infra, not code) if self-updating is wanted.

### CONFIG — native + pref
`NATIVE_PARITY_AUDIT.md` §2. Key ones:
- **HTTPS-First:** `dom.security.https_first=true` (default).
- **Pinned sleep/reset:** `zen.pinned-tab-manager.close-shortcut-behavior: reset-unload-switch` (already Vector's model) + reskin the changed-indicator.
- **2-finger swipe:** `zen.workspaces.swipe-actions`, `browser.gesture.swipe.left/right`.
- **Background-tab throttling relief (if ever needed):** `browser.docShellIsActive`, `dom.timeout.enable_budget_timer_throttling=false` — noted for completeness though wall display is dropped.

### RESKIN — native + Vector CSS
`NATIVE_PARITY_AUDIT.md` §3. The big one is the **design-token system + all component looks** (`styles.css`, 8,100 lines) mapped onto Zen's `zen-theme.css` token layer. Plus find-bar pill, save-password doorhanger, recently-closed popup, update pill/modal, context menus, settings surface (row-by-row triage — many rows die with their subsystems). CSS section map is in `NATIVE_PARITY_AUDIT.md`-referenced `styles.css` ranges (previously in v1 §8; unchanged).

### EXTEND — build Vector's delta on a Zen base
`NATIVE_PARITY_AUDIT.md` §4. Reuse the Zen module, add only what's missing, restyle:
- **Spaces** → `ZenSpaceManager` (add per-space "unpinned Today" + Clear mapping).
- **Favorites** → Zen **Essentials** grid (tune sizing/tint; cap `zen.tabs.essentials.max`).
- **Folders + hover peek** → `ZenFolders` + `zen.folders.search.*` (tune delay 500→280ms, restyle flyout).
- **MiniWindow/PiP → Little Arc: promoted to a first-class requirement, see §3.5.** Built on Zen's existing page-initiated seam + Glance presentation; policy predicate replaced, per-hostname width and Vector's card styling ported.
- **Drag-and-drop** → `ZenDragAndDrop` (reskin ghost/drop-line only).
- **Space switcher** → `ZenSpaceIcons` (Vector dot-rail aesthetic).
- **Command box** → Zen floating urlbar + `ZenUBActionsProvider` (add Vector ranking nuances + open-tabs-across-spaces; reskin).
- **Sidebar collapse / hidden top bar / no-top-chrome** → `ZenCompactMode` + `zen.view.use-single-toolbar` (configure to Vector feel; reskin reveal surfaces).
- **Recolor/gradient** → `ZenGradientGenerator` (add "scope: app" surface-ladder mode + swatch sets).
- **Keyboard shortcuts** → register Vector's set in `ZenKeyboardShortcuts` via versioned migration.
- **Favicon tint** → `PlacesUtils.favicons` + Vector's tint math.
- **macOS dock menu (spaces)** → `nsIMacDockSupport.dockMenu`.
- **Library (media/downloads/spaces overview)** → native data sources; the panel UI is custom (PORT-quality) but hangs on native backends.
- **Right dock (panel host)** → native sidebar + Zen split view to host shop/Slack panels.
- **Onboarding** → **extend Firefox/Zen native welcome** (`ZenWelcome`) with ONE Vector step: load the right space, set up pinned tabs, sign into shop tools. Restyle the stock shell; do not build a custom wizard. (Matters — other shop employees will use this.)

### PORT — genuinely custom (your design; no native equivalent)
`NATIVE_PARITY_AUDIT.md` §6. These are rebuilt, almost all as the bundled WebExtension (content scripts + background) that gates on Spike A:
- **Shop/Tekmetric suite** (~5,500 pagebridge lines + `main/shop/**` + renderer ports) — quote tracker, BG fluids, parts ETA, warranty chips, callbacks (incl. TYC print via chrome `printSilent`), customer notes, AR manager (Graph OAuth via `identity.launchWebAuthFlow`), dispatch/to-do/extras, daily briefing, BG print + NSDMC autofill, labor-guide focus. **DetectAuto paths out of scope.** UDP LAN nudge → chrome `nsIUDPSocket` module the extension reaches via a fork-provided privileged hook (or a chrome-side module; decided at implementation — §5).
- **Slack** (engine, socket, embedded client, triage) — background WS + sidebar; interrupt popup = chrome `alwaysontop` window (browser-level).
- **AI assistant** (Gemini core, 21 tools, brief, scheduled tasks) — background + chrome panel; `nsIUserIdleService`/`wake_notification` replace powerMonitor; cursor-poll drag deleted (normal DOM drag).
- **Mail/calendar** (Google, Outlook) — device-code ports as-is; Google via `identity` loopback redirect (Fx 86+) — no host needed.
- **Smart tab names** (`lib/tabName.ts`) — pure function into the tab-label path.
- **Edge glow** — ~60 lines CSS.
- **Clipboard screenshot capture (Library Media)** — `nsIClipboard.hasDataMatchingFlavors` polling + IOUtils; **first check Firefox Screenshots overlap** before porting the whole flow.
- **Vector-state importer** — new one-shot chrome JS (spaces/folders/pinned/favorites from `browser-state.json`).

---

## 5. The one real architecture question left (decide at implementation, not now)

The shop suite is best authored as a **WebExtension** (content-script ergonomics on Tekmetric pages), but a few of its privileged needs — UDP nudge, silent print, OSKeyStore secrets — are chrome-layer APIs an ordinary extension can't call. With the companion dropped, the bridge is one of:
- **(a)** a small **fork-defined privileged extension API** (WebExtension Experiments are shippable in-tree by a fork), or
- **(c)** move those three bits into **chrome `.sys.mjs` modules** and expose a tiny message hook the bundled extension calls.

Both are fork-internal (no separate process). Recommendation: **(c)** for the three privileged bits, plain WebExtension for everything else. This is flagged so it's a conscious choice when Bucket C starts — not a silent default.

Secrets that were `safeStorage`-encrypted (Slack tokens, Gemini key, OAuth refresh tokens) live wherever their owning code lives: chrome-layer → `OSKeyStore` (keychain-grade); extension-side → `storage.local` unless routed through the (c) hook. This asymmetry drives placement.

---

## 6. Data migration (Phase 7)

One-shot, verify-before-delete throughout:
- **Vector browser state** → importer maps `browser-state.json` (spaces/folders/pinned/favorites) into Zen workspaces/essentials/folders.
- **Passwords** → export from the custom vault, import into Firefox login manager, **verify against a copy, then delete `main/passwords.ts`** (gated on Spike B).
- **Supabase** → export any needed shop/account data, then retire the sync layer.
- **Clipboard media** → not migrated (runtime capture; check Firefox Screenshots first).

---

## 7. Revised phase order (smallest safe steps; build + verify between each)

**Phase 0 — Baseline.** Get stock Zen building/running (`npm i && npm run init && npm run build && npm start`). Verify: a stock Zen window loads a page.

**Phase 1 — De-risk spikes.** Spike A (bundled-extension loading + named fallback), Spike B (Bitwarden on the fork), **Spike C (Little Arc / PartsTech punch-out — §3.5)**. Verify + report all three to owner before proceeding. Spike C is the go/no-go on the one requirement that motivated rejecting stock Zen.

**Phase 2 — Pure look (RESKIN, zero behavior risk).** `vector-theme.css` tokens → Zen; then sidebar/tab/folder/essentials visual CSS; then page-card frame + edge glow. Verify Zen's own UI takes on Vector's palette and tab look with no functional change.

**Phase 3 — Configure & reskin Zen natives (CONFIG/EXTEND, low risk).** Map spaces→workspaces; favorites→essentials; pinned sleep/reset via pref + reskin indicator; folders + hover-peek (tune + reskin); command box via floating urlbar + actions; compact mode + single-toolbar to Vector feel; gradient picker; register Vector keyboard shortcuts; smart tab names; favicon tint; dot-rail switcher; DnD reskin (Zen's engine, Vector's ghost/line). Verify each against Vector behavior. **No Vector interaction engines ported.**

**Phase 4 — Custom chrome-layer UI (PORT/EXTEND).** **Little Arc implementation (§3.5) — build it first in this phase**, since Phase 6's PartsTech work depends on it. Then: Library panel + spaces overview; right dock host; edge glow; extended native onboarding with the Vector step; macOS dock menu. Verify Little Arc against the real Tekmetric→PartsTech round trip (auth handoff, data return to opener, dismiss with no tab, promote keeps opener).

**Phase 5 — The WebExtension application foundation (PORT).** Scaffold the bundled extension (background + sidebar + options + storage), using the Spike-A result. Decide the §5 privileged-bridge approach. Port the Tekmetric core (single consolidated `webRequest` token capture + API layer). Verify token capture + a read call.

**Phase 6 — Shop tools + integrations (PORT), read-only before write.**
- Read-only first: quote tracker, warranty chips, BG fluids (display), customer notes (read).
- Then write/side-effect, one at a time: parts ETA, vendor ETA rules, auto reorder, smart status/inspection monitor, dispatch/to-do/extras, callbacks (+ chrome silent-print for TYC), AR manager (+ `identity` Graph OAuth), daily briefing, BG print/NSDMC, WPS add-to-job. **DetectAuto paths skipped.**
- UDP LAN nudge as a chrome module via the §5 hook.
- Integrations: AI assistant; Slack (incl. `alwaysontop` interrupt popup); mail/calendar.
- Verify each on live pages against Vector.

**Phase 7 — Data migration + retire old backends.** Vector-state importer; password export→native→verify→delete; Supabase export→retire; clipboard-media (post Screenshots check). Verify a returning setup: spaces, pinned tabs, passwords, shop config all present.

**Phase 8 — Parity sweep + cleanup.** Walk `NATIVE_PARITY_AUDIT.md` for anything deferred; rotate the Slack client secret (`slack/oauth.ts:14`) and relocate the Supabase key if any residual use remains; confirm every DROP is truly gone.

---

## 8. Standing rule & open infra decisions

- **Standing rule (binding):** any elaborate Vector subsystem not settled above → check Firefox/Zen native first, report to owner, don't port unilaterally.
- **Infra decisions still open (not code):** update-host for self-updates (or rely on manual builds); whether to self-host anything for Firefox Sync or use Mozilla accounts (§1 sync decision picks Firefox/Zen Sync — account model TBD); the §5 privileged-bridge choice (default: chrome modules + hook).

Awaiting go-ahead on this phase order before Phase 0.
