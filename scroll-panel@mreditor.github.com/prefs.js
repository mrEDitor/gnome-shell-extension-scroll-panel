const Me = imports.misc.extensionUtils.getCurrentExtension();
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const DEVICE = { NAME: 0, DELETABLE: 1 };
const TARGET = { ID: 0, NAME: 1 };
const devices = JSON.parse(Me.imports.settings.settings.get_string('devices'));
const _ = Me.imports.gettext.gettext;

let filllock = false;

function init() {
}


function buildPrefsWidget() {
	const ui_builder = new Gtk.Builder();
	ui_builder.add_from_file(Me.path + '/ui/prefs.ui');

	const devices_list = ui_builder.get_object('devices-list');
	for (let name in devices) {
		if (name != Me.imports.settings.UNLISTED_DEVICE)
		{
			const iter = devices_list.insert(0);
			devices_list.set_value(iter, DEVICE.NAME, name);
			devices_list.set_value(iter, DEVICE.DELETABLE, true);
		}
	}
	const devices_sel = ui_builder.get_object('devices-selection');
	const targets_sel = ui_builder.get_object('targets-selection');
	const selection_changed_listener = Lang.bind(
		null, _on_selection_changed, devices_sel, targets_sel, ui_builder
	);
	devices_sel.connect('changed', selection_changed_listener);
	targets_sel.connect('changed', selection_changed_listener);
	_on_affecting_configs_changed(0, ui_builder);

	ui_builder.get_object('device-this').connect('clicked', Lang.bind(
		null, _add_or_find_device, ui_builder
	));
	ui_builder.get_object('device-remove').connect('toggled', Lang.bind(
		null, _remove_device, ui_builder
	));
	
	const settings_changed_listener = Lang.bind(
		null, _on_settings_changed, ui_builder
	);
	ui_builder.get_object('setting-enable')
		.connect('toggled', settings_changed_listener);
	ui_builder.get_object('setting-invert')
		.connect('toggled', settings_changed_listener);
	ui_builder.get_object('setting-cyclic')
		.connect('toggled', settings_changed_listener);
	ui_builder.get_object('setting-pressure')
		.connect('changed', settings_changed_listener);
	ui_builder.get_object('setting-pressure-boost')
		.connect('toggled', settings_changed_listener);
	
	return ui_builder.get_object('prefs');
}



function _on_selection_changed(source, devices_sel, targets_sel, ui) {
	_on_affecting_configs_changed(
		devices_sel.count_selected_rows() * targets_sel.count_selected_rows(),
		ui
	);
}



function _remove_device(source, path, ui) {
	let [ok, iter] = ui.get_object('devices')
		.get_model()
		.get_iter(Gtk.TreePath.new_from_string(path));
	const devices_list = ui.get_object('devices-list');
	delete devices[devices_list.get_value(iter, DEVICE.NAME)];
	devices_list.remove(iter);
}



function _on_affecting_configs_changed(count, ui) {
	ui.get_object('settings').sensitive = (count != 0);
	ui.get_object('info-empty-selection').visible = (count == 0);
	
	if (count != 0) {
		_foreach_selected((config) => {
			filllock = true;
			ui.get_object('setting-enable').active = config['setting-enable'];
			ui.get_object('setting-invert').active = config['setting-invert'];
			ui.get_object('setting-cyclic').active = config['setting-cyclic'];
			ui.get_object('setting-pressure').value = config['setting-pressure'];
			ui.get_object('setting-pressure-boost').active
				= config['setting-pressure-boost'];
			filllock = false;
		}, ui);
	}
}



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
				devices[device.name] = JSON.parse(JSON.stringify(
					devices[Me.imports.settings.UNLISTED_DEVICE]
				));
			} else if (list.get_value(iter, 1) != device.name) {
				return false;
			}
			selection.unselect_all();
			selection.select_iter(iter);
			return true;
		}
	);
}



function _foreach_selected(callback, ui) {
	let [devices_pathes, devices_model] =
		ui.get_object('devices-selection').get_selected_rows();
	let [targets_pathes, targets_model] =
		ui.get_object('targets-selection').get_selected_rows();
	devices_pathes.forEach((device_path) => {
		const [device_ok, device_iter] = devices_model.get_iter(device_path);
		const device_id = devices_model.get_value(device_iter, DEVICE.DELETABLE)
			? devices_model.get_value(device_iter, DEVICE.NAME)
			: Me.imports.settings.UNLISTED_DEVICE;
		if (devices[device_id] == undefined) {
			devices[device_id] = {
				'switching-workspaces': {},
				'switching-windows': {},
				'moving-windows': {}
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
					'setting-pressure': 50,
					'setting-pressure-boost': true
				};
			}
			callback(targets[target_id]);
		});
	});
}



function _on_settings_changed(source, ui) {
	if (!filllock) {
		_foreach_selected((config) => {
			config['setting-enable'] = ui.get_object('setting-enable').active;
			config['setting-invert'] = ui.get_object('setting-invert').active;
			config['setting-cyclic'] = ui.get_object('setting-cyclic').active;
			config['setting-pressure'] = ui.get_object('setting-pressure').value;
			config['setting-pressure-boost'] 
				= ui.get_object('setting-pressure-boost').active;
		}, ui);
		_save_settings();
	}
}



function _save_settings() {
	const data = JSON.stringify(devices);
	log('Saving ' + data);
	Me.imports.settings.settings.set_value(
		'devices',
		new GLib.Variant('s', data)
	);
}
