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

  _registerContentSheet() {
    // Global content styles (Arc-clean number inputs, etc.). Agent-sheet
    // registration is process-global and reaches every content process, but
    // it is idempotent per URI, so guarding on a static avoids re-running
    // per window.
    if (gVectorSidebarSnap._contentSheetRegistered) {
      return;
    }
    gVectorSidebarSnap._contentSheetRegistered = true;
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
      Ci.nsIStyleSheetService
    );
    const uri = Services.io.newURI(
      "chrome://browser/content/zen-styles/vector-content.css"
    );
    if (!sss.sheetRegistered(uri, Ci.nsIStyleSheetService.AGENT_SHEET)) {
      sss.loadAndRegisterSheet(uri, Ci.nsIStyleSheetService.AGENT_SHEET);
    }
  },

  // Floating search: one measure-and-correct pass per open. The theme's
  // margins skew the rendered box ~12px from the centre line the
  // --vector-urlbar-left variable requests (icon mode only; the docked pill
  // geometry differs). Measure where it actually landed and close the gap -
  // never hard-code the offset, it differs per platform/theme state.
  _watchUrlbarCentering() {
    const urlbar = document.getElementById("urlbar");
    if (!urlbar) {
      requestAnimationFrame(() => this._watchUrlbarCentering());
      return;
    }
    new MutationObserver(() => {
      if (!urlbar.hasAttribute("open")) {
        return;
      }
      requestAnimationFrame(() => {
        const panels = gBrowser?.tabpanels;
        if (!panels || !urlbar.hasAttribute("open")) {
          return;
        }
        const area = panels.getBoundingClientRect();
        if (!area.width) {
          return;
        }
        const target = area.x + area.width / 2;
        const r = urlbar.getBoundingClientRect();
        const dx = target - (r.x + r.width / 2);
        if (Math.abs(dx) < 2) {
          return;
        }
        const cur =
          parseFloat(urlbar.style.getPropertyValue("--vector-urlbar-left")) ||
          target;
        urlbar.style.setProperty(
          "--vector-urlbar-left",
          Math.round(cur + dx) + "px"
        );
      });
    }).observe(urlbar, { attributeFilter: ["open"] });
  },

  init() {
    this._watchUrlbarCentering();
    this._registerContentSheet();
    this._addSearchButton();
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
