# Overnight Run — 2026-08-19/20

Owner authorized autonomous overnight work: build → test what's testable without a human → next task → repeat. No user testing available until morning. Windows-specific items go to WINDOWS_VERIFICATION.md, human-only items to the morning report at the bottom of this file.

## Night plan
1. **Clobber build lands (~23:05)** → `npm run import` + `build:ui` (picks up: l10n fix, updater-off, Zen-URL overrides, Phase 3 prefs, vector-theme.css) → launch → verify: Settings labels render, no welcome/privacy tabs, updater silent, Bitwarden auto-installs, theme tokens active. Screenshot everything.
2. **Commit + push** the verified state.
3. **Little Arc implementation** (per scratchpad/little-arc-draft.md): predicate replacement, synthetic rect, badge suppression, nested-popup fallback, chrome-level Esc. `build:ui` → test with spikes/spike-c-littlearc pages (cases A–D should open in the floating panel; verify opener round-trip marker in logs).
4. **Edge glow port** (small CSS) + start page.
5. **Commit + push** at each stable milestone.
6. **Morning report** written at the end.

## Log
(appended as the night progresses)

### 22:50 — pre-build validation (while clobber build runs)
- ✅ vector.yaml validated by the real ffprefs parser (not guessed) — all 20 prefs compile
- ✅ verified our overrides WIN by load order (280 after 500, float after floating-on-type, etc. — libpref last-write-wins)
- ✅ l10n zen-*.ftl files staged in engine (11 files); fix wired into `npm run import`
- ✅ theme CSS validated: 30 valid light-dark() calls, balanced braces, 65 tokens + 14 zen bridge vars
- ⚠️ found + fixed a real bug in my own CSS: light-dark() takes 2 args, I'd passed a 4-part shadow → would have killed the page-card frame
- NOTE: `src/zen/vector/vector-theme.css` is NOT yet in engine (engine/zen/ is per-file symlinks from last import; new folder needs a fresh `import`). Post-build sequence MUST be `import` then `build:ui`, not `build:ui` alone.
- Clobber build at 29:43 elapsed, 4383 .o files (gkrust + link + package remain). ETA ~23:05.
- Decisions requiring owner review logged in DECISIONS_MADE.md (7 so far).

### 23:00 — build FAILED at jar packaging, root-caused and fixed
- **Error:** `FILE_NOT_FOUND: engine/.../zen/vector/jar.inc.mn` at the browser/base/misc (jar) stage, 47min in.
- **Cause (my mistake):** I added the `#include zen/vector/jar.inc.mn` line to the jar manifest *while the clobber build was already running*. The manifest edit was live but the target file was never imported into engine/. I had even flagged this exact risk in the 22:50 log entry but added the registration anyway mid-build.
- **Lesson recorded:** never edit build-file *registration* (jar.mn/moz.build/#include) while a build runs, or ensure the target is imported first. Editing leaf source (already-imported files) mid-build is fine; adding NEW registered files is not.
- **Diagnostic note:** mach hides real errors under `CLAUDECODE` env (`is_running_under_coding_agent` in python/mozbuild/mozbuild/util.py). Use `env -u CLAUDECODE ./mach build <tier>` to see the true error.
- **Fix:** ran `npm run import` → created engine symlinks for src/zen/vector/{jar.inc.mn,vector-theme.css}. Both now reachable. Resuming incremental build (C++ was done; only jar/link/package remain).

### 23:38 — build SUCCEEDED, l10n fix verified, milestone committed+pushed
- Build resumed incrementally (30min), exit 0. All 4 changes verified in packaged app: theme CSS, zen l10n ftl, updater-off, welcome-url blanked.
- Runtime: **"uncaught exception: undefined" flood → 0**. Settings labels fixed. Bitwarden active.
- Committed b6aa21e51, pushed to origin/dev.
- **Machine locked itself** (display sleep → lock screen) at ~23:38. No more screenshots possible tonight; continuing with log-based/headless verification only.
- **Investigated actor error** `Failed to load resource:///actors/ZenGlanceChild.sys.mjs`: PRE-EXISTING (5× in Spike C run, before my changes; not caused by me). Actor file IS present in bundle. It's the content-actor (anchor-click) path; Little Arc uses the PARENT path (BrowserDOMWindow→onTabOpen) which Spike C proved works regardless. Not a blocker. Flagged for morning: verify normal modifier-click Glance works in a packaged build.

### Next: Little Arc core (log-testable: opener round-trip via dump markers, no display needed)

### 23:45 — Little Arc core verified + committed; stopping feature work (machine locked)
- Little Arc core applied to ZenGlanceManager.mjs: new opener-host predicate + synthetic rect + adopt path.
- Headless verified: window.open from a non-search page → panel path chosen; child handed data back to opener (CART_HANDBACK); opener + cookies preserved. The PartsTech punch-out mechanism works through the new predicate.
- Instrumentation removed, rebuilt clean (14s build:ui), committed ef6eac1b0, pushed.
- Final health check: launches clean, 0 l10n errors, no crashes, no theme/glance errors.
- **STOPPED here.** Remaining work (Little Arc badge/Esc/width polish, edge glow, start page) is UI verifiable only with a display; the Mac locked at ~23:38. Writing it blind would be unverifiable slop. Deferred to a session with the display available.

## Night summary
3 commits pushed to origin/dev. Full Mac build: DONE, Vector-branded, working. Milestones: rebrand, l10n fix, theme, Phase 3 prefs, updater-off, Little Arc core.
Owner action items: MORNING_REPORT.md (5 questions). Decisions log: DECISIONS_MADE.md (12).

### 23:50 — heartbeat check: night plan complete
- Confirmed: no build running, display locked (can't screenshot), all work committed + pushed (ef6eac1b0).
- Closed the last test gap: Little Arc **search-host → tab branch** verified — 7/7 host cases route correctly (google/bing/ddg → tab; tekmetric/partstech/example → panel), and the committed predicate matches the tested logic exactly. Both Little Arc branches now verified.
- **Edge glow NOT done**: it is visual-only and the display is locked. The night plan constrains to machine-verifiable work, so writing it blind would be slop. Deferred to a session with a display (queued in MORNING_REPORT deferred list).
- **Loop ended.** Night plan complete for all machine-verifiable items. Not rescheduling a wakeup. Morning report ready with 5 questions.
