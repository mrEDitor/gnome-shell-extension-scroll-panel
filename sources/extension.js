/* exported init */

const {Clutter, GLib, Meta} = imports.gi;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const Me = imports.misc.extensionUtils.getCurrentExtension();
// WARNING: No extension imports allowed here since it will break method calls
// tracing in development environment.

/** @type {DebugModule|null} */
const Debug = Me.imports.debug?.module;

class ActorScrollHandler {
    /**
     * @param {_PrefsSource} prefsSource - {@link PrefsSource} instance.
     * @param {string} action - Action identifier from {@link PrefsSource}.
     * @param {function(number): boolean} onSwitch - Callback for switch action.
     * The only argument is switching distance (-N for left, +N for right).
     */
    constructor(prefsSource, action, onSwitch) {
        this._prefsSource = prefsSource;
        this._action = action;
        this._onSwitch = distance => {
            return onSwitch(distance)
                ? Clutter.EVENT_STOP
                : Clutter.EVENT_PROPAGATE;
        };

        /** @type {function()|null} */
        this._signalDisconnector = null;
    }

    /**
     * Subscribe for scrolling signals of specified actor.
     *
     * @param {Clutter.Actor|null} actor - Actor to scroll signals of.
     * @param {number?} width - Fixed width to set for actor.
     * @param {string?} align - Align to set for actor.
     */
    handleActor(actor, width, align) {
        if (this._signalDisconnector) {
            this._signalDisconnector();
            this._signalDisconnector = null;
        }
        if (actor) {
            const oldWidth = actor.natural_width_set ? actor.natural_width : null;
            const oldAlign = actor.x_align || 0;
            if (actor.min_width <= width) {
                actor.natural_width = width;
            }
            switch (align) {
            case 'start':
                actor.x_align = Clutter.ActorAlign.START;
                break;
            case 'center':
                actor.x_align = Clutter.ActorAlign.CENTER;
                break;
            case 'end':
                actor.x_align = Clutter.ActorAlign.END;
                break;
            }

            actor.reactive = true;
            const connectionId = actor.connect(
                'scroll-event',
                (source, event) => this._switch(event)
            );
            this._signalDisconnector = () => {
                actor.disconnect(connectionId);
                actor.x_align = oldAlign;
                if (oldWidth === null) {
                    actor.natural_width_set = false;
                } else {
                    actor.natural_width = oldWidth;
                }
            };
        }
    }

    _switch(event) {
        if (event.is_pointer_emulated()) {
            return Clutter.EVENT_PROPAGATE;
        }

        const horizontalMultiplier = this._prefsSource.switcherHorizontalMultiplier(this._action);
        const verticalMultiplier = this._prefsSource.switcherVerticalMultiplier(this._action);
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.LEFT:
            return this._onSwitch(-horizontalMultiplier.value);
        case Clutter.ScrollDirection.RIGHT:
            return this._onSwitch(horizontalMultiplier.value);
        case Clutter.ScrollDirection.UP:
            return this._onSwitch(-verticalMultiplier.value);
        case Clutter.ScrollDirection.DOWN:
            return this._onSwitch(verticalMultiplier.value);
        case Clutter.ScrollDirection.SMOOTH:
        {
            const [x, y] = event.get_scroll_delta();
            if (x !== 0 || y !== 0) {
                return this._onSwitch(Math.trunc(
                    Math.abs(x) > Math.abs(y)
                        ? x * horizontalMultiplier.value
                        : y * verticalMultiplier.value
                ));
            }
        }
        }

        // Switcher should absorb unknown gestures during timeout.
        return this._onSwitch(0);
    }
}

class ExtensionModule {
    constructor() {
        /** @type {_WindowSwitcherPopup.constructor} */
        this.WindowSwitcherPopup = Me.imports.windowSwitcher.WindowSwitcherPopup;

        /** @type {function()[]} */
        this._signalDisconnectors = [];

        /** @type {WindowSwitcherPopup} */
        this._windowSwitcherPopup = null;

        /** @type {WorkspaceSwitcherPopup.WorkspaceSwitcherPopup} */
        this._workspacesSwitcherPopup = null;

        /** @type {object} */
        this._windowSwitchTimeoutHandle = null;

        /** @type {object} */
        this._workspaceSwitchTimeoutHandle = null;
    }

    enable() {
        /** @type {_PrefsSource} */
        this._prefsSource = new Me.imports.prefsSource.PrefsSource(Me);
        /** @type {_PrefsCompanion} */
        this._prefsCompanion = new Me.imports.prefsCompanion.PrefsCompanion(
            this._prefsSource
        );

        this._workspacesSwitcherHandler = new ActorScrollHandler(
            this._prefsSource,
            this._prefsSource.workspacesSwitcher,
            distance => this._switchWorkspace(distance)
        );
        this._windowsSwitcherHandler = new ActorScrollHandler(
            this._prefsSource,
            this._prefsSource.windowsSwitcher,
            distance => this._switchWindow(distance)
        );

        this._signalDisconnectors.push(
            this._prefsSource.trackChanges(() => {
                if (!this._prefsSource.pickingActorPathAction.value) {
                    this._updateHandler(
                        this._windowsSwitcherHandler,
                        this._prefsSource.windowsSwitcher
                    );
                    this._updateHandler(
                        this._workspacesSwitcherHandler,
                        this._prefsSource.workspacesSwitcher
                    );
                }
            }),
            this._prefsCompanion.run()
        );
    }

    disable() {
        for (const disconnector of this._signalDisconnectors) {
            disconnector();
        }
        this._signalDisconnectors = [];
        this._windowsSwitcherHandler.handleActor(null);
        this._workspacesSwitcherHandler.handleActor(null);

        // clean timeouts according to https://gjs.guide/extensions/review-guidelines/review-guidelines.html#remove-main-loop-sources
        if (this._workspaceSwitchTimeoutHandle !== null) {
            GLib.Source.remove(this._workspaceSwitchTimeoutHandle);
            this._workspaceSwitchTimeoutHandle = null;
        }
        if (this._windowSwitchTimeoutHandle !== null) {
            GLib.Source.remove(this._windowSwitchTimeoutHandle);
            this._windowSwitchTimeoutHandle = null;
        }
    }

    _updateHandler(handler, switcher) {
        // There is no reason to handle switcher actor if all multipliers are 0.
        const anyOfSwitcherMultipliersIsSet =
            this._prefsSource.switcherHorizontalMultiplier(switcher).value ||
            this._prefsSource.switcherVerticalMultiplier(switcher).value;
        handler.handleActor(
            anyOfSwitcherMultipliersIsSet
                ? this._prefsCompanion.findActor(
                    this._prefsSource.switcherActorPath(switcher).value
                )
                : null,
            this._prefsSource.switcherActorWidth(switcher).value,
            this._prefsSource.switcherActorAlign(switcher).value
        );
    }

    /**
     * @param {number} distance - Switching distance, signed.
     * @returns {boolean} - Whether switching performed.
     */
    _switchWindow(distance) {
        if (this._windowSwitchTimeoutHandle) {
            return true;
        }
        if (!distance) {
            return false;
        }

        const switcher = this._prefsSource.windowsSwitcher;
        const cycle = this._prefsSource.switcherCycle(switcher).value;
        const visualize = this._prefsSource.switcherVisualize(switcher).value;
        const timeout = this._prefsSource.switcherTimeout(switcher).value;
        this._windowSwitchTimeoutHandle = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            timeout, // ms
            () => {
                this._windowSwitchTimeoutHandle = null;
                return GLib.SOURCE_REMOVE;
            }
        );

        const mode = Meta.TabList.NORMAL;
        const workspace = global.workspaceManager.get_active_workspace();
        const windows = global.display.get_tab_list(mode, workspace);
        windows.sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());

        let index = distance;
        if (visualize && this._windowSwitcherPopup) {
            index += this._windowSwitcherPopup.selectedIndex;
        } else {
            const currentWindow = global.display.get_tab_current(mode, workspace);
            index += windows.indexOf(currentWindow);
        }
        // such that `modBallast > abs(distance) && modBallast % count == 0`
        const modBallast = Math.abs(distance) * windows.length;
        index = cycle
            ? (index + modBallast) % windows.length
            : Math.min(Math.max(0, index), windows.length - 1);

        if (visualize) {
            if (!this._windowSwitcherPopup?.tryDisplay(index, 1.5 * timeout)) {
                this._windowSwitcherPopup = new this.WindowSwitcherPopup(windows);
                this._windowSwitcherPopup.connect('destroy', () => {
                    const selectIndex = this._windowSwitcherPopup.selectedIndex;
                    windows[selectIndex].activate(global.get_current_time());
                    this._windowSwitcherPopup = null;
                });
                this._windowSwitcherPopup.tryDisplay(index, 1.5 * timeout);
            }
        } else {
            windows[index].activate(global.get_current_time());
        }

        return true;
    }

    /**
     * @param {number} distance - Switching distance, signed.
     * @returns {boolean} - Whether switching performed.
     */
    _switchWorkspace(distance) {
        if (this._workspaceSwitchTimeoutHandle) {
            return true;
        }
        if (!distance) {
            return false;
        }

        const switcher = this._prefsSource.workspacesSwitcher;
        const cycle = this._prefsSource.switcherCycle(switcher).value;
        const visualize = this._prefsSource.switcherVisualize(switcher).value;
        const timeout = this._prefsSource.switcherTimeout(switcher).value;
        this._workspaceSwitchTimeoutHandle = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            timeout, // ms
            () => {
                this._workspaceSwitchTimeoutHandle = null;
                return GLib.SOURCE_REMOVE;
            }
        );

        let index = global.workspaceManager.get_active_workspace_index();
        const count = global.workspaceManager.n_workspaces;
        if (!this._workspacesSwitcherPopup && visualize) {
            this._workspacesSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup({
                reactive: false,
            });
            this._workspacesSwitcherPopup.connect('destroy', () => {
                this._workspacesSwitcherPopup = null;
            });
        }

        const displayWorkspacesSwitcherPopup = imports.misc.config.PACKAGE_VERSION >= '42'
            ? (_, ind) => this._workspacesSwitcherPopup?.display(ind)
            : (dir, ind) => this._workspacesSwitcherPopup?.display(dir, ind);
        if (distance < 0) {
            // such that `modBallast > abs(distance) && modBallast % count == 0`
            const modBallast = Math.abs(distance) * count;
            index = cycle
                ? (index + distance + modBallast) % count
                : Math.max(0, index + distance);
            displayWorkspacesSwitcherPopup(Meta.MotionDirection.LEFT, index);
        } else {
            index = cycle
                ? (index + distance) % count
                : Math.min(index + distance, count - 1);
            displayWorkspacesSwitcherPopup(Meta.MotionDirection.RIGHT, index);
        }

        global.workspaceManager
            .get_workspace_by_index(index)
            .activate(global.get_current_time());
        return true;
    }
}

/**
 * Construct the extension main module instance.
 *
 * @returns {ExtensionModule} - Extension main module.
 */
function init() {
    Debug?.logDebug('Initializing shell extension...');
    Debug?.injectModulesTraceLogs(Me.imports);
    return new ExtensionModule();
}
