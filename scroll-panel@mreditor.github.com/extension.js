/**********************************************************************
 * This file is licensed under MIT license.                           *
 * Learn more from LICENSE file from package or upstream:             *
 * https://github.com/mrEDitor/gnome-shell-extension-scroll-panel/    *
 **********************************************************************/
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Clutter = imports.gi.Clutter;
const AltTab = imports.ui.altTab;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const GetText = Me.imports.gettext;
const Settings = Me.imports.settings;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;


let connected = [];
let _delta_windows = 0, _delta_workspaces = 0;
let devices;
let workspaceManager = global.screen || global.workspace_manager;
var wsPopup = null;

/**
 * Init action.
 */
function init() {
}

/**
 * Enable extension action.
 */
function enable() {
	Main.panel._leftBox.reactive = true;
	connected = [
		{
			target: Settings.is('wide-left') ? Main.panel._leftBox : Main.panel.statusArea.appMenu,
			event: 'scroll-event',
			callback: _switch_window
		},
		{
			target: Settings.is('wide-center') ? Main.panel : Main.panel.statusArea.dateMenu,
			event: 'scroll-event',
			callback: Settings.is('wide-center') ? _switch_workspace_deep_check : _switch_workspace
		},
		{
			target: Settings.settings,
			event: 'changed::wide-left',
			callback: () => { disable(); enable(); }
		},
		{
			target: Settings.settings,
			event: 'changed::wide-center',
			callback: () => { disable(); enable(); }
		},
		{
			target: Settings.settings,
			event: 'changed::devices',
			callback: () => { devices = Settings.get_devices(); }
		}
	];
	connected.forEach((c) => { c.handle = c.target.connect(c.event, c.callback); });
	devices = Settings.get_devices();
}

/**
 * Disable extension action.
 */
function disable() {
	connected.forEach((c) => { c.target.disconnect(c.handle); });
}

/**
 * Main panel actor event detection.
 */
function _switch_workspace_deep_check(source, event) {
	const [x,y] = event.get_coords();
	let top = event.get_stage().get_actor_at_pos(Clutter.PickMode.ALL, x, y);
	while (top != Main.panel && top != null) {
		if (top == Main.panel._leftBox || top == Main.panel._rightBox) {
			return;
		}
		top = top.get_parent();
	}
	_switch_workspace(source, event);
}

/**
 * Switch workspace by event.
 */
function _switch_workspace(source, event) {
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
			if (settings['setting-switcher']) {
				const prevWsPopup = wsPopup;
				if (prevWsPopup != null) {
					prevWsPopup.hide();
				}

				wsPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
				wsPopup.connect('destroy', () => { this.wsPopup = null });
				wsPopup.reactive = false;
				const switcher_direction = direction < 0
					? Meta.MotionDirection.UP
					: Meta.MotionDirection.DOWN;
				if (!Main.overview.visible) {
					wsPopup.display(switcher_direction, index);
				}
			}
		}
	}
}

/**
 * Switch window by event.
 */
function _switch_window(source, event) {
	const settings = devices[event.get_source_device().name] == undefined
		? devices[Settings.UNLISTED_DEVICE]['switching-windows']
		: devices[event.get_source_device().name]['switching-windows'];

	if (settings['setting-enable']) {
		const direction = _get_direction(event) * (settings['setting-invert'] ? -1 : 1);
		_delta_windows += direction;

		if (settings['setting-switcher']) {
			let tabPopup = new AltTab.WindowSwitcherPopup();
			if (!tabPopup.show(settings['setting-invert'], 0, 0)) {
				tabPopup.destroy();
			}
		}
		else if (Math.abs(_delta_windows) >= settings['setting-pressure']) {
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
}

/**
 * Get event scroll direction as signed int.
 */
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
