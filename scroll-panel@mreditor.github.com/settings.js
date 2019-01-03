/**********************************************************************
 * This file is licensed under MIT license.                           *
 * Learn more from LICENSE file from package or upstream:             *
 * https://github.com/mrEDitor/gnome-shell-extension-scroll-panel/    *
 **********************************************************************/
const Me = imports.misc.extensionUtils.getCurrentExtension();
const GioSettingsSchemaSource = imports.gi.Gio.SettingsSchemaSource;

const UNLISTED_DEVICE = '__unlisted_device__';
const settings = new imports.gi.Gio.Settings({
	settings_schema:
		GioSettingsSchemaSource
			.new_from_directory(Me.dir.get_child('schemas').get_path(), GioSettingsSchemaSource.get_default(), false)
			.lookup(Me.metadata['settings-schema'], true)
});

/**
 * Get devices from settings.
 */
function get_devices() {
	return JSON.parse(settings.get_string('devices'));
}

/**
 * Boolean value check shortcut.
 */
function is(key) {
	return settings.get_boolean(key);
}
