/* exported init */

const { Clutter, Meta } = imports.gi;
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
     * @param {function(number)} onSwitch - Callback for switch action.
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
            this._onSwitch(-horizontalMultiplier.value);
            return true;
        case Clutter.ScrollDirection.RIGHT:
            this._onSwitch(horizontalMultiplier.value);
            return true;
        case Clutter.ScrollDirection.UP:
            this._onSwitch(-verticalMultiplier.value);
            return true;
        case Clutter.ScrollDirection.DOWN:
            this._onSwitch(verticalMultiplier.value);
            return true;
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
     */
    _switchWindow(distance) {
        const cycle = PrefsSource.switcherCycle(
            PrefsSource.windowsSwitcher
        );
        const visualize = PrefsSource.switcherVisualize(
            PrefsSource.windowsSwitcher
        );

        const mode = Meta.TabList.NORMAL;
        const workspace = global.workspaceManager.get_active_workspace();
        const windows = global.display.get_tab_list(mode, workspace);
        windows.sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());

        const currentWindow = global.display.get_tab_current(mode, workspace);
        let index = windows.indexOf(currentWindow) + distance;
        // such that `modBallast > abs(distance) && modBallast % count == 0`
        const modBallast = Math.abs(distance) * windows.length;
        index = cycle.value
            ? (index + modBallast) % windows.length
            : Math.min(Math.max(0, index), windows.length - 1);
        windows[index].activate(global.get_current_time());

        if (visualize.value) {
            if (!this._windowSwitcherPopup?.tryDisplay(index)) {
                this._windowSwitcherPopup = new WindowSwitcherPopup(windows);
                this._windowSwitcherPopup.connect('destroy', () => {
                    this._windowSwitcherPopup = null;
                });
                this._windowSwitcherPopup.tryDisplay(index);
            }
        }
    }

    /**
     * @param {number} distance - Switching distance, signed.
     */
    _switchWorkspace(distance) {
        const cycle = PrefsSource.switcherCycle(
            PrefsSource.workspacesSwitcher
        );
        const visualize = PrefsSource.switcherVisualize(
            PrefsSource.workspacesSwitcher
        );

        let index = global.workspaceManager.get_active_workspace_index();
        const count = global.workspaceManager.n_workspaces;
        if (!this._workspacesSwitcherPopup && visualize.value) {
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
            index = cycle.value
                ? (index + distance + modBallast) % count
                : Math.max(0, index + distance);
            this._workspacesSwitcherPopup?.display(Meta.MotionDirection.LEFT, index);
        } else {
            index = cycle.value
                ? (index + distance) % count
                : Math.min(index + distance, count - 1);
            this._workspacesSwitcherPopup?.display(Meta.MotionDirection.RIGHT, index);
        }

        global.workspaceManager
            .get_workspace_by_index(index)
            .activate(global.get_current_time());
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
