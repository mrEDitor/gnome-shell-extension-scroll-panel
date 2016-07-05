const Me = imports.misc.extensionUtils.getCurrentExtension();
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Settings = Me.imports.settings;

let left_connection, center_connection, settings_connection;
let _delta_windows = 0, _delta_workspaces = 0;
let devices;



function init() {
}



function enable() {
	Main.panel._leftBox.reactive = true;
	center_connection = Main.panel.actor.connect('scroll-event', _switch_workspace);
	left_connection = Main.panel._leftBox.connect('scroll-event', _switch_window);
	settings_connection = Settings.settings.connect('changed::devices', () => {
		devices = Settings.get_devices();
	});
	devices = Settings.get_devices();
}



function disable() {
	Main.panel.actor.disconnect(center_connection);
	Main.panel._leftBox.disconnect(left_connection);
	Settings.settings.disconnect(settings_connection);
}



function _switch_workspace(source, event) {
	const [x,y] = event.get_coords();
	let top = event.get_stage().get_actor_at_pos(Clutter.PickMode.ALL, x, y);
	while (top != Main.panel.actor) {
		if (top == Main.panel._leftBox || top == Main.panel._rightBox) {
			return;
		}
		top = top.get_parent();
	}
	const settings = devices[event.get_source_device().name]['switching-workspaces'];
	if (settings['setting-enable']) {
		const direction = _get_direction(event) * (settings['setting-invert'] ? -1 : 1);
		_delta_workspaces += direction;
		if (Math.abs(_delta_workspaces) >= settings['setting-pressure']) {
			_delta_workspaces -= direction * settings['setting-pressure'];
			let index = global.screen.get_active_workspace_index() + direction;
			if (settings['setting-cyclic']) {
				index = (index + global.screen.n_workspaces) % global.screen.n_workspaces;
			} else if (index < 0 || global.screen.n_workspaces <= index) {
				index = global.screen.get_active_workspace_index();
			}
			global.screen.get_workspace_by_index(index).activate(global.get_current_time());
		}
	}
}



function _switch_window(source, event) {
	const settings = devices[event.get_source_device().name]['switching-windows'];
	if (settings['setting-enable']) {
		const direction = _get_direction(event) * (settings['setting-invert'] ? -1 : 1);
		_delta_windows += direction;
		if (Math.abs(_delta_windows) >= settings['setting-pressure']) {
			_delta_windows -= direction * settings['setting-pressure'];
			const windows = global.display.get_tab_list(Meta.TabList.NORMAL, global.screen.get_active_workspace());
			const target = windows[0].get_stable_sequence() + direction;
			let next_window = null;
			let far_window = windows[0];
			switch (direction) {
				case -1:
					windows.forEach((window) => {
						const id = window.get_stable_sequence();
						if (id <= target && (next_window == null || next_window.get_stable_sequence() < id)) {
							next_window = window;
						}
						if (id > far_window.get_stable_sequence()) {
							far_window = window;
						}
					});
					break;
				case +1:
					windows.forEach((window) => {
						const id = window.get_stable_sequence();
						if (id >= target && (next_window == null || next_window.get_stable_sequence() > id)) {
							next_window = window;
						}
						if (id < far_window.get_stable_sequence()) {
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
