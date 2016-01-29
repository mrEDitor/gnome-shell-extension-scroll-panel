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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const devices = Me.imports.lib.devices;
const settings = Me.imports.lib.settings;
const _ = Me.imports.lib.get_l10n();
const ADD_DEVICE_TEXT = _('Add specific device by exact name');

let deviceList;
let deviceName;



function init() {
	Me.imports.lib.init();
}



function buildPrefsWidget() {
	const frame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, border_width: 10, spacing: 10 });
	frame.add(buildSwitcher('cycle-windows', _('Cyclic windows switching')));
	frame.add(buildSwitcher('cycle-workspaces', _('Cyclic workspaces switching')));
	frame.add(buildDeviceList(_('Device to configure')));
	frame.add(buildDeviceSelector(_('Or click with this device')));
	frame.show_all();
	return frame;
}



function buildSwitcher(key, labeltext) {
	const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
	const label = new Gtk.Label({ label: labeltext, xalign: 0 });
	const switcher = new Gtk.Switch({ active: settings.get_boolean(key) });
	switcher.connect('notify::active', (w) => settings.set_boolean(key, w.active) );
	box.pack_start(label, true, true, 0);
	box.add(switcher);
	return box;
}



function buildDeviceList(labeltext) {
	const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
	const label = new Gtk.Label({ label: labeltext, xalign: 0 });
	deviceList = new Gtk.ComboBoxText({ hexpand: true, vexpand: false });
	box.pack_start(label, true, true, 0);
	box.add(deviceList);
	deviceList.connect('changed', updateDeviceConfig);
	for (let property in devices) {
		deviceList.append(devices[property].deviceName, _(devices[property].deviceName));
	}
	deviceList.set_active(0);
	return box;
}



function buildDeviceSelector(labeltext) {
	const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
	deviceName = new Gtk.Entry({ text: ADD_DEVICE_TEXT });
	const target = new Gtk.Button({ label: labeltext });
	deviceName.connect('activate', (target, event)=>{

	});
	target.connect('button-press-event', (target, event)=>{

	});
	box.pack_start(deviceName, true, true, 0);
	box.add(target);
	return box;
}



function updateDeviceConfig() {
	deviceName.text = deviceList.active_id == 'default' ? ADD_DEVICE_TEXT : deviceList.active_id;
}
