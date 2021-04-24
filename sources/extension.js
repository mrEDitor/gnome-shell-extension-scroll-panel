/* exported init */

const { Clutter } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();

/** @type {PrefsCompanionModule} */
const PrefsCompanion = Me.imports.prefsCompanion.module;

/** @type {PrefsSourceModule} */
const PrefsSource = Me.imports.prefsSource.module;

class ActorScrollHandler {
    /**
     * @param {function(Clutter.ScrollDirection)} onSwitch - Callback for switch
     * action. The only argument is switching (scrolling) direction.
     */
    constructor(onSwitch) {
        this._onSwitch = onSwitch;

        /** @type {number} */
        this._x = null;

        /** @type {number} */
        this._y = null;

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
        // log('---------->' + event.get_source_device().name)
        const [x, y] = event.get_scroll_delta();
        if (event.get_scroll_direction() === Clutter.ScrollDirection.SMOOTH) {
            this._x += x;
            this._y += y;
        }
        while (Math.abs(this._x) >= 1) {
            if (this._x < 0) {
                this._x += 1;
                this._onSwitch(Clutter.ScrollDirection.LEFT, false);
            } else {
                this._x -= 1;
                this._onSwitch(Clutter.ScrollDirection.RIGHT, false);
            }
        }
        while (Math.abs(this._y) >= 1) {
            if (this._y < 0) {
                this._y += 1;
                this._onSwitch(Clutter.ScrollDirection.UP, false);
            } else {
                this._y -= 1;
                this._onSwitch(Clutter.ScrollDirection.DOWN, false);
            }
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
        this._windowsSwitcherHandler = new ActorScrollHandler(
            this._switchWindow.bind(this)
        );
        this._workspacesSwitcherHandler = new ActorScrollHandler(
            this._switchWorkspace.bind(this)
        );
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
                PrefsSource.workspacesSwitcherPath.value
            )
        );
        this._windowsSwitcherHandler.handleActor(
            PrefsCompanion.findActor(
                PrefsSource.windowsSwitcherPath.value
            )
        );
    }

    _switchWindow(direction) {

    }

    /**
     * @param {Clutter.ScrollDirection} direction
     */
    _switchWorkspace(direction) {
        const n = global.workspaceManager.n_workspaces;
        let workspaceIndex = global.workspaceManager.get_active_workspace_index();
        switch (direction) {
        case Clutter.ScrollDirection.UP:
        case Clutter.ScrollDirection.LEFT:
            workspaceIndex = (workspaceIndex - 1 + n) % n;
            break;
        case Clutter.ScrollDirection.DOWN:
        case Clutter.ScrollDirection.RIGHT:
            workspaceIndex = (workspaceIndex + 1) % n;
            break;
        }
        global.workspaceManager
            .get_workspace_by_index(workspaceIndex)
            .activate(global.get_current_time());
    }

    /**
     * Main panel actor event detection.
     *
     function _switch_workspace_deep_check(source, event, popupContext) {
        const [x, y] = event.get_coords();
        let top = event.get_stage().get_actor_at_pos(Clutter.PickMode.ALL, x, y);
        while (top != get_actor(Main.panel) && top != null) {
            if (top == get_actor(Main.panel._leftBox) || top == get_actor(Main.panel._rightBox)) {
                return;
            }
            top = top.get_parent();
        }
        _switch_workspace(source, event, popupContext);
    }

     /**
     * Switch workspace by event.
     *
     function _switch_workspace(source, event, popupContext) {
        const settings = devices[event.get_source_device().name] == undefined
            ? devices[Settings.UNLISTED_DEVICE]['switching-workspaces']
            : devices[event.get_source_device().name]['switching-workspaces'];
        if (settings['setting-enable'] && workspaceManager.n_workspaces > 1) {
            const direction = _get_direction(event) * (settings['setting-invert'] ? -1 : 1);
            _delta_workspaces += direction;
            if (Math.abs(_delta_workspaces) >= settings['setting-pressure']) {
                _delta_workspaces -= direction * settings['setting-pressure'];
                let current_index = workspaceManager.get_active_workspace_index();
                let index = current_index + direction;
                if (settings['setting-cyclic']) {
                    index = (index + workspaceManager.n_workspaces) % workspaceManager.n_workspaces;
                } else if (index < 0 || workspaceManager.n_workspaces <= index) {
                    index = workspaceManager.get_active_workspace_index();
                }

                workspaceManager.get_workspace_by_index(index).activate(global.get_current_time());
                if (settings['setting-switcher'] && !Main.overview.visible) {
                    const prevWsPopup = popupContext.wsPopup;
                    if (prevWsPopup != null) {
                        prevWsPopup.destroy();
                    }

                    const wsPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                    popupContext.wsPopup = wsPopup;
                    wsPopup.connect('destroy', () => popupContext.wsPopup = null);
                    get_actor(wsPopup).reactive = false;
                    const switcher_direction = direction < 0
                        ? Meta.MotionDirection.LEFT
                        : Meta.MotionDirection.RIGHT;
                    wsPopup.display(switcher_direction, index);
                }
            }
        }
    }

     /**
     * Switch window by event.
     *
     function _switch_window(source, event, popupContext) {
        const settings = devices[event.get_source_device().name] == undefined
            ? devices[Settings.UNLISTED_DEVICE]['switching-windows']
            : devices[event.get_source_device().name]['switching-windows'];

        if (settings['setting-enable']) {
            const direction = _get_direction(event) * (settings['setting-invert'] ? -1 : 1);
            _delta_windows += direction;

            if (settings['setting-switcher'] && !Main.overview.visible) {
                const prevAppPopup = popupContext.appPopup;
                if (prevAppPopup != null) {
                    prevAppPopup._scrollHandler(settings['setting-invert']
                        ? 1 - event.get_scroll_direction()
                        : event.get_scroll_direction()
                    );
                } else {
                    const appPopup = new AltTab.WindowSwitcherPopup();
                    popupContext.appPopup = appPopup;
                    appPopup.connect('destroy', () => popupContext.appPopup = null);
                    get_actor(appPopup).reactive = false;
                    if (!appPopup.show(settings['setting-invert'], 0, 0)) {
                        appPopup.destroy();
                    }
                }
            } else if (Math.abs(_delta_windows) >= settings['setting-pressure']) {
                _delta_windows -= direction * settings['setting-pressure'];
                const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspaceManager.get_active_workspace());
                const target = windows[0].get_stable_sequence() + direction;
                let next_window = null;
                let far_window = windows[0];
                switch (direction) {
                    case -1:
                        windows.forEach((window) => {
                            const id = window.get_stable_sequence();
                            if (!window.appears_focused && id <= target && (next_window == null || next_window.get_stable_sequence() < id)) {
                                next_window = window;
                            }
                            if (!window.appears_focused && id > far_window.get_stable_sequence()) {
                                far_window = window;
                            }
                        });
                        break;
                    case +1:
                        windows.forEach((window) => {
                            const id = window.get_stable_sequence();
                            if (!window.appears_focused && id >= target && (next_window == null || next_window.get_stable_sequence() > id)) {
                                next_window = window;
                            }
                            if (!window.appears_focused && id < far_window.get_stable_sequence()) {
                                far_window = window;
                            }
                        });
                        break;
                }
                if (next_window != null) {
                    next_window.activate(global.get_current_time());
                } else if (settings['setting-cyclic']) {
                    far_window.activate(global.get_current_time());
                }
            }
        }

        return true;
    }

     /**
     * Get event scroll direction as signed int.
     *
     function _get_direction(event) {
        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
                return -1;
            case Clutter.ScrollDirection.DOWN:
                return +1;
            default:
                return 0;
        }
    }

     /**
     * Get actor for back-compatibility with older gnome shell versions
     *
     function get_actor(obj) {
        return obj instanceof Clutter.Actor ? obj : obj.actor;
    }
     */
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
