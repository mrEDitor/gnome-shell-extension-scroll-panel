/* exported WindowSwitcherPopup */
const { GLib, GObject } = imports.gi;
const SwitcherPopup = imports.ui.switcherPopup;
const AltTab = imports.ui.altTab;

/**
 * Stable-sequenced window switcher popup.
 * Based on built-in AltTab, but in opposite to it does not switch windows,
 * just shows them and highlights the active one.
 * See original sources at {@link https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/master/js/ui/altTab.js}
 */
var WindowSwitcherPopup = GObject.registerClass(
    class WindowSwitcherPopup extends SwitcherPopup.SwitcherPopup {
        _init(windows) {
            super._init();
            this.reactive = false;
            this.selectedIndex = 0;
            this._visibilityTimeoutHandle = 0;

            // These fields are defined and used by parent class, do not rename them.
            this._switcherList = new AltTab.WindowSwitcher(windows, AltTab.AppIconMode.BOTH);
            this._items = this._switcherList.icons;
            this.add_actor(this._switcherList);
        }

        /**
         * Try display switcher.
         * @param {number} activeIndex - 0-based index of element to highlight.
         * @param {number} timeout - Timeout (in milliseconds) before hiding of
         * the switcher.
         * @returns {boolean} - Whether switcher was successfully displayed.
         */
        tryDisplay(activeIndex, timeout) {
            this.selectedIndex = activeIndex;
            if (this._items.length === 0) {
                return false;
            } else {
                this._resetVisibilityTimeout(timeout);
                this._switcherList.highlight(activeIndex);
                return true;
            }
        }

        _resetVisibilityTimeout(timeout) {
            this.visible = true;

            if (this._visibilityTimeoutHandle !== 0) {
                GLib.source_remove(this._visibilityTimeoutHandle);
            }

            this._visibilityTimeoutHandle = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                timeout, // ms
                () => {
                    this.destroy();
                    this._visibilityTimeoutHandle = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );
        }
    }
);
