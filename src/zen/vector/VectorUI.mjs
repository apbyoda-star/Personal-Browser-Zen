// Vector UI behaviours on top of Zen.
//
// Sidebar drag-to-snap (ported from Vector App.tsx): dragging the sidebar
// splitter below SNAP (130px) collapses to the icon-only sidebar
// (zen.view.sidebar-expanded = false); dragging it back out past FULL_MIN
// (150px) expands again. Zen's stock splitter only resizes width and leaves
// a uselessly-narrow "expanded" sidebar instead of snapping.

const VECTOR_SNAP = 130; // drag narrower than this => icon-only
const VECTOR_FULL_MIN = 150; // drag wider than this while collapsed => expand

var gVectorSidebarSnap = {
  _lastGoodWidth: null,

  _addSearchButton() {
    // Magnifier shown only in the icon-only sidebar: opens the floating urlbar
    // overlay (same as Cmd+L). It gets its OWN container prepended to the
    // sidebar root: anything inside #zen-sidebar-top-buttons is relocated into
    // #nav-bar whenever the sidebar collapses (ZenUIManager "navBar.prepend
    // (topButtons)") - and we hide #nav-bar in icon mode, so a button there
    // can never be visible exactly when we need it.
    if (document.getElementById("vector-collapsed-tools")) {
      return;
    }
    const toolbox = document.getElementById("navigator-toolbox");
    if (!toolbox) {
      requestAnimationFrame(() => this._addSearchButton());
      return;
    }
    const box = document.createXULElement("hbox");
    box.id = "vector-collapsed-tools";
    const btn = document.createXULElement("toolbarbutton");
    btn.id = "vector-search-button";
    btn.className = "toolbarbutton-1";
    btn.setAttribute("tooltiptext", "Search or enter address");
    btn.addEventListener("command", () => {
      document.getElementById("Browser:OpenLocation")?.doCommand();
    });
    box.appendChild(btn);
    toolbox.prepend(box);
  },

  // ── Floating search: center on the PAGE AREA, not the window ──────────
  // Zen positions the floating urlbar with `left: 50%` of the window and a
  // top of (windowHeight - 333)/2, so the sidebar shoves it off-centre
  // horizontally and the input rides high because the 333px reservation for
  // the results list is centred rather than the input itself.
  // Vector centres the INPUT ROW on the content area on both axes, keeping
  // Zen's fixed reservation so the panel never jumps around while typing.
  _centerUrlbar() {
    const urlbar = document.getElementById("urlbar");
    const panels = gBrowser?.tabpanels;
    if (!urlbar || !panels) {
      return;
    }
    const area = panels.getBoundingClientRect();
    if (!area.width || !area.height) {
      return;
    }
    const RESERVED = 333; // Zen's assumed panel height (input + results list)
    const EDGE = 24;
    // The INPUT ROW height - NOT urlbar.getBoundingClientRect().height, which
    // includes the results list and would centre the whole block, leaving the
    // bar itself riding high above the page centre.
    const inputH =
      parseFloat(
        getComputedStyle(urlbar).getPropertyValue("--urlbar-container-height")
      ) || 62;

    let top = area.y + area.height / 2 - inputH / 2;
    // Never let the reserved results area spill past the page bottom.
    const maxTop = area.bottom - EDGE - RESERVED;
    if (top > maxTop) {
      top = maxTop;
    }
    if (top < area.y + EDGE) {
      top = area.y + EDGE;
    }
    const targetCX = area.x + area.width / 2;
    const targetInputCY = top + inputH / 2;

    // Set `top`/`left` DIRECTLY, not via --zen-urlbar-top: Zen rewrites that
    // variable from window geometry after the urlbar opens and would undo us.
    // Inline !important also beats Zen's `top:`/`left: 50%` stylesheet rules.
    const place = (l, t) => {
      urlbar.style.setProperty("left", Math.round(l) + "px", "important");
      urlbar.style.setProperty("top", Math.round(t) + "px", "important");
    };
    place(targetCX, top);

    // Self-correct. The theme applies its own margins and a -50% translate to
    // the urlbar, so the box does not necessarily land where `left`/`top` say
    // (measured 12px off in the collapsed sidebar). Measure where it actually
    // rendered and close the gap, rather than hard-coding a fudge factor that
    // would rot on another platform or theme.
    const r = urlbar.getBoundingClientRect();
    const dx = targetCX - (r.x + r.width / 2);
    const dy = targetInputCY - (r.y + inputH / 2);
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      let correctedTop = top + dy;
      if (correctedTop > maxTop) {
        correctedTop = maxTop;
      }
      if (correctedTop < area.y + EDGE) {
        correctedTop = area.y + EDGE;
      }
      place(targetCX + dx, correctedTop);
    }
  },

  // The sidebar animates when it collapses/expands, so a measurement taken the
  // instant the urlbar opens can read a content area that is still moving.
  // Re-centre once the animation has settled.
  _centerUrlbarSettled() {
    this._centerUrlbar();
    requestAnimationFrame(() => this._centerUrlbar());
    setTimeout(() => this._centerUrlbar(), 120);
    setTimeout(() => this._centerUrlbar(), 320);
  },

  _watchUrlbar() {
    const urlbar = document.getElementById("urlbar");
    if (!urlbar) {
      requestAnimationFrame(() => this._watchUrlbar());
      return;
    }
    // Re-centre every time it opens: the sidebar may have been resized or
    // collapsed since last time, which moves the content area.
    new MutationObserver(() => {
      if (urlbar.hasAttribute("open")) {
        this._centerUrlbarSettled();
      } else {
        // Drop our overrides so the docked urlbar isn't left displaced.
        urlbar.style.removeProperty("top");
        urlbar.style.removeProperty("left");
      }
    }).observe(urlbar, { attributeFilter: ["open"] });
    window.addEventListener("resize", () => {
      if (urlbar.hasAttribute("open")) {
        this._centerUrlbar();
      }
    });
  },

  init() {
    this._addSearchButton();
    this._watchUrlbar();
    const splitter = document.getElementById("zen-sidebar-splitter");
    const toolbox = document.getElementById("navigator-toolbox");
    if (!splitter || !toolbox) {
      // Sidebar not built yet; retry on the next frame.
      requestAnimationFrame(() => this.init());
      return;
    }
    splitter.addEventListener("mousedown", (downEvent) => {
      const rightSide = Services.prefs.getBoolPref(
        "zen.tabs.vertical.right-side",
        false
      );
      if (
        Services.prefs.getBoolPref("zen.view.sidebar-expanded", true) &&
        toolbox.getBoundingClientRect().width >= VECTOR_FULL_MIN
      ) {
        this._lastGoodWidth = toolbox.getBoundingClientRect().width;
      }
      // Both thresholds are judged on ONE value: the pointer's distance from
      // the sidebar's window edge. Collapse below VECTOR_SNAP, expand above
      // VECTOR_FULL_MIN, do nothing in between (hysteresis). Judging collapse
      // against the splitter and expand against the drag start point - the
      // old scheme - made each rule undo the other once per mouse event in
      // that gap, which the owner saw as the sidebar strobing.
      const onMove = (ev) => {
        const dist = rightSide ? window.innerWidth - ev.clientX : ev.clientX;
        const expanded = Services.prefs.getBoolPref(
          "zen.view.sidebar-expanded",
          true
        );
        if (expanded && dist < VECTOR_SNAP) {
          // Restore the pre-drag width first so re-expanding isn't tiny.
          if (this._lastGoodWidth) {
            toolbox.style.width = this._lastGoodWidth + "px";
            toolbox.setAttribute("width", this._lastGoodWidth + "px");
          }
          Services.prefs.setBoolPref("zen.view.sidebar-expanded", false);
        } else if (!expanded && dist > VECTOR_FULL_MIN) {
          // Hand off at the cursor's width so the edge follows the pointer.
          const w = Math.round(dist) + "px";
          toolbox.style.width = w;
          toolbox.setAttribute("width", w);
          Services.prefs.setBoolPref("zen.view.sidebar-expanded", true);
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  },
};

window.addEventListener(
  "load",
  () => {
    gVectorSidebarSnap.init();
  },
  { once: true }
);
