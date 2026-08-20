# Decisions Made Without Owner Input — for later review

Recorded during the overnight autonomous run. Each is a call I made because you weren't available and the build needed to move; flag any you'd have done differently.

| # | Decision | Why | Reversible? |
|---|---|---|---|
| 1 | Disabled the auto-updater entirely (`app.update.auto/enabled` = false) | It offered a real *Zen Browser* update that would overwrite Vector. No update server of our own exists yet. | Yes — re-enable once we own an update server |
| 2 | Pointed update/release-notes URLs at your GitHub repo `apbyoda-star/Personal-Browser-Zen/releases` | They were hardcoded to zen-browser.app by surfer; needed *some* Vector-appropriate target | Yes — change to any URL later |
| 3 | Blanked the welcome/privacy/whatsnew homepage URLs (opened Zen tabs on first run) | Zen-branded tabs are wrong for Vector; no Vector equivalents exist yet | Yes — set real URLs when they exist |
| 4 | Set `vendor` = "Bruce Yoder" in surfer.json | Rebrand needed a vendor; used your name from git config | Yes |
| 5 | Phase 3 pref values taken from Vector's measured constants (folder-peek 280ms, sidebar max 440, etc.) | Configuring Zen to match Vector rather than porting code, per the audit | Yes — all just prefs |
| 6 | Windows keeps native window controls for now (`hide-window-controls` split by platform) | Vector's replacement pill doesn't exist yet; hiding them would strand a Windows user | Yes — flip after the pill ships |
| 7 | Little Arc search-host exclusion list = Vector's shipped SEARCH_HOSTS verbatim | It's the rule Vector actually used; no reason to deviate | Yes |

## Added during overnight run (continued)

| # | Decision | Why | Reversible? |
|---|---|---|---|
| 8 | Little Arc search-exclusion = Vector's exact SEARCH_HOSTS (google/bing/ddg/yahoo/brave/ecosia/startpage/baidu) | It's the rule Vector shipped; no reason to change without your input | Yes — edit the list |
| 9 | Little Arc gated behind `vector.little-arc.enabled` (default on) + drops cross-domain restriction | Tekmetric punch-outs are often same-domain; the restriction would block them | Yes — flip pref |
| 10 | Nested panels fall back to a normal tab (rather than stacking or dropping) | Predictable, never loses a page; Vector's stacking destroyed the parent | Yes |
| 11 | STOPPED feature work after Little Arc core once the machine locked | Remaining items (badge hide, edge glow, chrome-Esc, start page) are UI that can only be verified visually. Writing them blind = the "AI slop" you warned against | n/a |
| 12 | Committed + pushed 3 milestones to origin/dev overnight | You said keep going to completion; pushing preserves the work and lets the PC pull it | Yes — git revert |

## Things I did NOT touch (waiting on you)
- Old Vector password vault (`main/passwords.ts` in Vector Source) — you confirmed Bitwarden works, but I did NOT delete or migrate anything. Untouched.
- Windows build — cannot be done from the Mac; needs your PC or a route decision.
- The Vector-state importer, shop tools, Slack, AI — later phases, not started.

## Added 2026-08-20 (morning, during your testing)

| # | Decision | Why | Reversible? |
|---|---|---|---|
| 13 | Renamed "Zen Mods" → "Vector Mods", "Zen URL Bar" → "Vector URL Bar" etc. in Settings | Your rule: nothing ships reading "Zen". NOTE: the Mods *marketplace* still serves Zen's mods (zen-browser.app) — so "Vector Mods" is a label over Zen's content. Flag: do you want a Vector mod store, generic "Mods", or leave it? | Yes |
| 14 | Disabled BOTH update systems (Firefox native + Zen's ZenUpdates doorhanger) | They pointed at Zen's servers and offered Zen builds. See Q1 in morning report. | Yes |
| 15 | Suppressed first-run/what's-new page (mstone=ignore) | It opened zen-browser.app welcome/privacy tabs every version change | Yes |
