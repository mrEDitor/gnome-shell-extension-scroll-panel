/**********************************************************************
 * This file is licensed under MIT license.                           *
 * Learn more from LICENSE file from package or upstream:             *
 * https://github.com/mrEDitor/gnome-shell-extension-scroll-panel/    *
 **********************************************************************/
const Me = imports.misc.extensionUtils.getCurrentExtension();
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const GetText = Me.imports.gettext;
const Settings = Me.imports.settings;

const DEVICE = { NAME: 0, DELETABLE: 1 };
const TARGET = { ID: 0, NAME: 1 };
let filllock = false;
let devices;
let _;

/**
 * Initialize prefs with gettext helper.
 */
function init() {
	_ = GetText.bind();
}

/**
 * Build, bind and return widget.
 */
function buildPrefsWidget() {
	devices = Settings.get_devices();
	const ui_builder = new Gtk.Builder();
	ui_builder.add_from_file(Me.path + '/ui/prefs.ui');

	const wide_left = ui_builder.get_object('setting-wide-left');
	wide_left.active = Settings.is('wide-left');
	wide_left.connect('toggled', () => { Settings.settings.set_boolean('wide-left', wide_left.active); });

	const wide_center = ui_builder.get_object('setting-wide-center');
	wide_center.active = Settings.is('wide-center');
	wide_center.connect('toggled', () => { Settings.settings.set_boolean('wide-center', wide_center.active); });

	const devices_list = ui_builder.get_object('devices-list');
	for (let name in devices) {
		if (name != Settings.UNLISTED_DEVICE)
		{
			const iter = devices_list.insert(0);
			devices_list.set_value(iter, DEVICE.NAME, name);
			devices_list.set_value(iter, DEVICE.DELETABLE, true);
		}
	}
	const devices_sel = ui_builder.get_object('devices-selection');
	const targets_sel = ui_builder.get_object('targets-selection');
	const selection_changed_listener = Lang.bind(null, _on_selection_changed, devices_sel, targets_sel, ui_builder);
	devices_sel.connect('changed', selection_changed_listener);
	targets_sel.connect('changed', selection_changed_listener);
	_on_affecting_configs_changed(0, ui_builder);

	ui_builder.get_object('device-this').connect('clicked', Lang.bind(null, _add_or_find_device, ui_builder));
	ui_builder.get_object('device-remove').connect('toggled', Lang.bind(null, _remove_device, ui_builder));
	
	const settings_changed_listener = Lang.bind(null, _on_settings_changed, ui_builder);
	ui_builder.get_object('setting-enable').connect('toggled', settings_changed_listener);
	ui_builder.get_object('setting-invert').connect('toggled', settings_changed_listener);
	ui_builder.get_object('setting-cyclic').connect('toggled', settings_changed_listener);
	ui_builder.get_object('setting-switcher').connect('toggled', settings_changed_listener);
	ui_builder.get_object('setting-pressure').connect('value-changed', settings_changed_listener);
	
	return ui_builder.get_object('prefs');
}

/**
 * Selection change callback.
 */
function _on_selection_changed(source, devices_sel, targets_sel, ui) {
	_on_affecting_configs_changed(devices_sel.count_selected_rows() * targets_sel.count_selected_rows(), ui);
}

/**
 * Device remove callback.
 */
function _remove_device(source, path, ui) {
	let [ok, iter] = ui.get_object('devices').get_model().get_iter(Gtk.TreePath.new_from_string(path));
	const devices_list = ui.get_object('devices-list');
	delete devices[devices_list.get_value(iter, DEVICE.NAME)];
	devices_list.remove(iter);
}

/**
 * On config change callback.
 */
function _on_affecting_configs_changed(count, ui) {
	ui.get_object('settings').sensitive = (count != 0);
	ui.get_object('info-empty-selection').visible = (count == 0);
	
	if (count != 0) {
		_foreach_selected((config) => {
			filllock = true;
			ui.get_object('setting-enable').active = config['setting-enable'];
			ui.get_object('setting-invert').active = config['setting-invert'];
			ui.get_object('setting-cyclic').active = config['setting-cyclic'];
			ui.get_object('setting-switcher').active = config['setting-switcher'];
			ui.get_object('setting-pressure').value = config['setting-pressure'];
			filllock = false;
		}, ui);
	}
}

/**
 * Adding device callback.
 */
function _add_or_find_device(source, ui) {
	const device = Gtk.get_current_event().get_source_device();
	const list = ui.get_object('devices-list');
	const selection = ui.get_object('devices-selection')
	list.foreach(
		(model, path, iter) => {
			if (list.get_value(iter, DEVICE.DELETABLE) == false) {
				iter = list.insert(0);
				list.set_value(iter, DEVICE.NAME, device.name);
				list.set_value(iter, DEVICE.DELETABLE, true);
				devices[device.name] = JSON.parse(JSON.stringify(devices[Settings.UNLISTED_DEVICE]));
			} else if (list.get_value(iter, 1) != device.name) {
				return false;
			}
			selection.unselect_all();
			selection.select_iter(iter);
			return true;
		}
	);
}

/**
 * Foreach callback executor.
 */
function _foreach_selected(callback, ui) {
	let [devices_pathes, devices_model] =
		ui.get_object('devices-selection').get_selected_rows();
	let [targets_pathes, targets_model] =
		ui.get_object('targets-selection').get_selected_rows();
	devices_pathes.forEach((device_path) => {
		const [device_ok, device_iter] = devices_model.get_iter(device_path);
		const device_id = devices_model.get_value(device_iter, DEVICE.DELETABLE)
			? devices_model.get_value(device_iter, DEVICE.NAME)
			: Settings.UNLISTED_DEVICE;
		if (devices[device_id] == undefined) {
			devices[device_id] = {
				'switching-workspaces': {},
				'switching-windows': {},
			};
		}
		const targets = devices[device_id];
		targets_pathes.forEach((target_path) => {
			const [target_ok, target_iter] = targets_model.get_iter(target_path);
			const target_id = targets_model.get_value(target_iter, TARGET.ID);
			if (targets[target_id] == undefined) {
				targets[target_id] = {
					'setting-enable': true,
					'setting-invert': false,
					'setting-cyclic': false,
					'setting-switcher': false,
					'setting-pressure': 1,
				};
			}
			callback(targets[target_id]);
		});
	});
}

/**
 * Settings change callback.
 */
function _on_settings_changed(source, ui) {
	if (!filllock) {
		_foreach_selected((config) => {
			config['setting-enable'] = ui.get_object('setting-enable').active;
			config['setting-invert'] = ui.get_object('setting-invert').active;
			config['setting-cyclic'] = ui.get_object('setting-cyclic').active;
			config['setting-switcher'] = ui.get_object('setting-switcher').active;
			config['setting-pressure'] = ui.get_object('setting-pressure').value;
		}, ui);
		Settings.settings.set_string('devices', JSON.stringify(devices));
	}
}
