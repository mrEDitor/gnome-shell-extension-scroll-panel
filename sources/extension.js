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
     * @param {JsonSetting<DeviceSettings[]>} settingsSource - Per-device
     * settings source for the switcher.
     */
    constructor(onSwitch, settingsSource) {
        this._onSwitch = onSwitch;

        /** @type {number} */
        this._x = null;

        /** @type {number} */
        this._y = null;

        /** @type {function()|null} */
        this._signalDisconnector = null;

        settingsSource.onChange((key, value) => {
            /** @type {DeviceSettings[]} */
            this._settings = (value ?? []).map(
                v => Object.assign(v, { deviceMask: new RegExp(v.deviceMask) })
            );

            /** @type {Object.<number, DeviceSettings>} */
            this._settingsCache = {};
        });
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

    /**
     * @param {Clutter.InputDevice} device - Device to get settings for.
     * @returns {DeviceSettings} - Device settings.
     */
    _getSettings(device) {
        const cacheKey = `${device.vendor_id}_${device.product_id}`;
        if (this._settingsCache.hasOwnProperty(cacheKey)) {
            return this._settingsCache[cacheKey];
        }
        const settings = this._settings.find(s => s.deviceMask.test(device.name)) || {
            resistance: 1,
        };
        this._settingsCache[cacheKey] = settings;
        return settings;
    }

    _switch(event) {
        if (event.get_scroll_direction() !== Clutter.ScrollDirection.SMOOTH) {
            // seems like all events are doubled as both smooth and directed
            return;
        }
        const settings = this._getSettings(event.get_source_device());
        const [x, y] = event.get_scroll_delta();
        this._x += settings.horizontal !== 'disabled' ? x : 0;
        this._y += settings.vertical !== 'disabled' ? y : 0;
        while (Math.abs(this._x) >= settings.resistance) {
            if (this._x < 0) {
                this._x += 1;
                this._onSwitch(
                    settings.horizontal === 'direct'
                        ? Clutter.ScrollDirection.LEFT
                        : Clutter.ScrollDirection.RIGHT
                );
            } else {
                this._x -= 1;
                this._onSwitch(
                    settings.horizontal === 'direct'
                        ? Clutter.ScrollDirection.RIGHT
                        : Clutter.ScrollDirection.LEFT
                );
            }
        }
        while (Math.abs(this._y) >= settings.resistance) {
            if (this._y < 0) {
                this._y += 1;
                this._onSwitch(
                    settings.vertical === 'direct'
                        ? Clutter.ScrollDirection.UP
                        : Clutter.ScrollDirection.DOWN
                );
            } else {
                this._y -= 1;
                this._onSwitch(
                    settings.vertical === 'direct'
                        ? Clutter.ScrollDirection.DOWN
                        : Clutter.ScrollDirection.UP
                );
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
        this._workspacesSwitcherHandler = new ActorScrollHandler(
            this._switchWorkspace.bind(this),
            PrefsSource.workspacesSwitcherDevices
        );
        this._windowsSwitcherHandler = new ActorScrollHandler(
            this._switchWindow.bind(this),
            PrefsSource.windowsSwitcherDevices
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

    /**
     * @param {Clutter.ScrollDirection} direction - Switching direction.
     */
    _switchWindow(direction) {

    }

    /**
     * @param {Clutter.ScrollDirection} direction - Switching direction.
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
