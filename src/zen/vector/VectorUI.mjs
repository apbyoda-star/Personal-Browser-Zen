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

  init() {
    this._addSearchButton();
    const splitter = document.getElementById("zen-sidebar-splitter");
    const toolbox = document.getElementById("navigator-toolbox");
    if (!splitter || !toolbox) {
      // Sidebar not built yet; retry on the next frame.
      requestAnimationFrame(() => this.init());
      return;
    }
    splitter.addEventListener("mousedown", (downEvent) => {
      const expanded = Services.prefs.getBoolPref(
        "zen.view.sidebar-expanded",
        true
      );
      const startW = toolbox.getBoundingClientRect().width;
      const startX = downEvent.clientX;
      if (expanded && startW >= VECTOR_FULL_MIN) {
        this._lastGoodWidth = startW;
      }
      const rightSide = Services.prefs.getBoolPref(
        "zen.tabs.vertical.right-side",
        false
      );
      const onMove = (ev) => {
        const isExpanded = Services.prefs.getBoolPref(
          "zen.view.sidebar-expanded",
          true
        );
        if (isExpanded) {
          // Live snap, like Vector. The toolbox has a CSS min-width, so the
          // splitter HARD-STOPS there and the width never reaches VECTOR_SNAP —
          // detect the pointer dragging PAST the stopped splitter instead
          // (owner-reported: "hits a hard stop and never collapses").
          const w = toolbox.getBoundingClientRect().width;
          const sRect = splitter.getBoundingClientRect();
          const inwardPast = rightSide
            ? ev.clientX - sRect.right
            : sRect.left - ev.clientX;
          if (w < VECTOR_SNAP || inwardPast > 30) {
            // Restore the pre-drag width first so re-expanding isn't tiny.
            if (this._lastGoodWidth) {
              toolbox.style.width = this._lastGoodWidth + "px";
              toolbox.setAttribute("width", this._lastGoodWidth + "px");
            }
            Services.prefs.setBoolPref("zen.view.sidebar-expanded", false);
          }
        } else {
          // Collapsed: CSS clamps the toolbox width, so rect-based detection
          // can never fire. Use the mouse travel instead: dragging outward
          // (right for a left sidebar) by 40px expands.
          const dx = ev.clientX - startX;
          const outward = rightSide ? -dx : dx;
          if (outward > 40) {
            Services.prefs.setBoolPref("zen.view.sidebar-expanded", true);
          }
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
