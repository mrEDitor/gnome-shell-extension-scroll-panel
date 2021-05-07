/* exported init */

const { Clutter, GLib, Meta } = imports.gi;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const Me = imports.misc.extensionUtils.getCurrentExtension();

/** @type WindowSwitcherPopup */
const WindowSwitcherPopup = Me.imports.windowSwitcher.WindowSwitcherPopup;

/** @type {PrefsCompanionModule} */
const PrefsCompanion = Me.imports.prefsCompanion.module;

/** @type {PrefsSourceModule} */
const PrefsSource = Me.imports.prefsSource.module;

class ActorScrollHandler {
    /**
     * @param {string} action - Action identifier from {@link PrefsSource}.
     * @param {function(number): boolean} onSwitch - Callback for switch action.
     * The only argument is switching distance (-N for left, +N for right).
     */
    constructor(action, onSwitch) {
        this._action = action;
        this._onSwitch = onSwitch;

        /** @type {function()|null} */
        this._signalDisconnector = null;
    }

    /**
     * Subscribe for scrolling signals of specified actor.
     * @param {Clutter.Actor|null} actor - Actor to scroll signals of.
     */
    handleActor(actor) {
        if (this._signalDisconnector) {
            this._signalDisconnector();
            this._signalDisconnector = null;
        }
        if (actor) {
            actor.reactive = true;
            const connectionId = actor.connect(
                'scroll-event',
                (source, event) => this._switch(event)
            );
            this._signalDisconnector = () => {
                actor.disconnect(connectionId);
            };
        }
    }

    _switch(event) {
        const horizontalMultiplier = PrefsSource.switcherHorizontalMultiplier(this._action);
        const verticalMultiplier = PrefsSource.switcherVerticalMultiplier(this._action);
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.LEFT:
            return this._onSwitch(-horizontalMultiplier.value);
        case Clutter.ScrollDirection.RIGHT:
            return this._onSwitch(horizontalMultiplier.value);
        case Clutter.ScrollDirection.UP:
            return this._onSwitch(-verticalMultiplier.value);
        case Clutter.ScrollDirection.DOWN:
            return this._onSwitch(verticalMultiplier.value);
        default:
            return false;
        }
    }
}

/**
 * Extension main module instance.
 * @type {ExtensionModule}
 */
var module = new class ExtensionModule {
    constructor() {
        /** @type {function()[]} */
        this._signalDisconnectors = [];

        // prefer `module` over `this` here to enable debug-tracing
        this._workspacesSwitcherHandler = new ActorScrollHandler(
            PrefsSource.workspacesSwitcher,
            distance => module._switchWorkspace(distance)
        );
        this._windowsSwitcherHandler = new ActorScrollHandler(
            PrefsSource.windowsSwitcher,
            distance => module._switchWindow(distance)
        );

        /** @type {WindowSwitcherPopup} */
        this._windowSwitcherPopup = null;

        /** @type {WorkspaceSwitcherPopup.WorkspaceSwitcherPopup} */
        this._workspacesSwitcherPopup = null;

        this._windowSwitchTimeoutHandle = null;
        this._workspaceSwitchTimeoutHandle = null;
    }

    enable() {
        this._signalDisconnectors.push(
            PrefsCompanion.run(),
            PrefsSource.onChange(this._updateHandlers.bind(this))
        );
    }

    disable() {
        this._windowsSwitcherHandler.handleActor(null);
        this._workspacesSwitcherHandler.handleActor(null);
        for (const disconnector of this._signalDisconnectors) {
            disconnector();
        }
    }

    _updateHandlers() {
        this._workspacesSwitcherHandler.handleActor(
            PrefsCompanion.findActor(
                PrefsSource.switcherActorPath(
                    PrefsSource.workspacesSwitcher
                ).value
            )
        );
        this._windowsSwitcherHandler.handleActor(
            PrefsCompanion.findActor(
                PrefsSource.switcherActorPath(
                    PrefsSource.windowsSwitcher
                ).value
            )
        );
    }

    /**
     * @param {number} distance - Switching distance, signed.
     * @returns {boolean} - Whether switching performed.
     */
    _switchWindow(distance) {
        if (!distance || this._windowSwitchTimeoutHandle) {
            return false;
        }
        const switcher = PrefsSource.windowsSwitcher;
        const cycle = PrefsSource.switcherCycle(switcher).value;
        const visualize = PrefsSource.switcherVisualize(switcher).value;
        const timeout = PrefsSource.switcherTimeout(switcher).value;
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

        const currentWindow = global.display.get_tab_current(mode, workspace);
        let index = windows.indexOf(currentWindow) + distance;
        // such that `modBallast > abs(distance) && modBallast % count == 0`
        const modBallast = Math.abs(distance) * windows.length;
        index = cycle
            ? (index + modBallast) % windows.length
            : Math.min(Math.max(0, index), windows.length - 1);

        if (visualize) {
            if (!this._windowSwitcherPopup?.tryDisplay(index, 1.5 * timeout)) {
                this._windowSwitcherPopup = new WindowSwitcherPopup(windows);
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
        if (!distance || this._workspaceSwitchTimeoutHandle) {
            return false;
        }

        const switcher = PrefsSource.workspacesSwitcher;
        const cycle = PrefsSource.switcherCycle(switcher).value;
        const visualize = PrefsSource.switcherVisualize(switcher).value;
        const timeout = PrefsSource.switcherTimeout(switcher).value;
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

        if (distance < 0) {
            // such that `modBallast > abs(distance) && modBallast % count == 0`
            const modBallast = Math.abs(distance) * count;
            index = cycle
                ? (index + distance + modBallast) % count
                : Math.max(0, index + distance);
            this._workspacesSwitcherPopup?.display(Meta.MotionDirection.LEFT, index);
        } else {
            index = cycle
                ? (index + distance) % count
                : Math.min(index + distance, count - 1);
            this._workspacesSwitcherPopup?.display(Meta.MotionDirection.RIGHT, index);
        }

        global.workspaceManager
            .get_workspace_by_index(index)
            .activate(global.get_current_time());
        return true;
    }
}();

/**
 * Construct the extension main module instance.
 * @returns {ExtensionModule} - Extension main module.
 */
function init() {
    try {
        /** @type {DebugModule} */
        const Debug = Me.imports.debug.module;
        Debug.logDebug('Initializing shell extension...');
        Debug.injectModulesTraceLogs(Me.imports);
    } catch {
        // Debug module is optional.
    }
    return module;
}
