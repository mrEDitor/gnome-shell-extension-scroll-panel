/**
 * https://github.com/mrEDitor/gnome-scroll-panel
 * Copyright 2016 Edward Minasyan <mrEDitor@mail.ru>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Devices = imports.misc.extensionUtils.getCurrentExtension().imports.devices;

const applicationSwitcher = Main.panel.statusArea.appMenu;
const workspaceSwitcher = Main.panel.statusArea.dateMenu;

/** Stores connected event handlers */
let handlers = {
	connections: [ /* {target:obj, handle:int} */ ],
	
	connect: function (target, event, handler) {
		this.connections.push({
			target: target,
			handle: target.connect(event, handler),
		});
	},

	disconnectAll: function () {
		this.connections.forEach( function (connection) {
			connection.target.disconnect(connection.handle);
		});
		this.connections = [];
	},
};
/** Stores configured devices */
let devices = { /* name: Device */ };
let cycle_windows = false;
let cycle_workspaces = false;



function deviceEnterEvent(target, event) {
	let device = event.get_source_device().get_device_name();
	if (!(device in devices)) {
		device = 'default';
	}
	devices[device].enter(target, event);
}



function applicationSwitchEvent(target, event) {
	let device = event.get_source_device().get_device_name();
	if (!(device in devices)) {
		device = 'default';
	}
	const scroll_result = devices[device].scroll(target, event);
	if (scroll_result) {
		const windows = global.display.get_tab_list(Meta.TabList.NORMAL, global.screen.get_active_workspace());
		const current_id = windows[0].get_stable_sequence();
		let first = windows[0];
		let next = null;
		windows.forEach(
			scroll_result < 0 ?
				function (window) {
					if (window.get_stable_sequence() > first.get_stable_sequence()) {
						first = window;
					}
					if (window.get_stable_sequence() < current_id && (!next || window.get_stable_sequence() > next.get_stable_sequence())) {
						next = window;
					}
				} :
				function (window) {
					if (window.get_stable_sequence() > current_id && (!next || window.get_stable_sequence() < next.get_stable_sequence())) {
						next = window;
					}
					if (window.get_stable_sequence() < first.get_stable_sequence()) {
						first = window;
					}
				}
		);
		(next == windows[0] ? (cycle_windows ? first : windows[0]) : next).activate(global.get_current_time());
	}
}



function workspaceSwitchEvent(target, event) {
	let device = event.get_source_device().get_device_name();
	if (!(device in devices)) {
		device = 'default';
	}
	const scroll_result = devices[device].scroll(target, event);
	if (scroll_result) {
		let index = global.screen.get_active_workspace_index() + scroll_result;
		if (cycle_workspaces) {
			index = (index + global.screen.n_workspaces) % global.screen.n_workspaces;
		} else if (index < 0 || global.screen.n_workspaces <= index) {
			index = global.screen.get_active_workspace_index();
		}
		global.screen.get_workspace_by_index(index).activate(global.get_current_time());
	}
}



function load_devices() {
	devices = {
		'default': new Devices.DiscreteDevice('default', Devices.Direction.DIRECT),
		'SynPS/2 Synaptics TouchPad': new Devices.AnalogDevice('SynPS/2 Synaptics TouchPad', Devices.Direction.DIRECT, 80, 40),
	};
}



function enable() {
	load_devices();
	handlers.connect(applicationSwitcher.actor, 'scroll-event', applicationSwitchEvent);
	handlers.connect(workspaceSwitcher.actor, 'scroll-event', workspaceSwitchEvent);
	handlers.connect(applicationSwitcher.actor, 'enter-event', deviceEnterEvent);
	handlers.connect(workspaceSwitcher.actor, 'enter-event', deviceEnterEvent);
}



function disable() {
	workspaces = [];
	handlers.disconnectAll();
}
