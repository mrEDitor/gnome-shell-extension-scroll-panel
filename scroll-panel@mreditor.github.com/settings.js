const Me = imports.misc.extensionUtils.getCurrentExtension();
const GioSettingsSchemaSource = imports.gi.Gio.SettingsSchemaSource;
const settings = new imports.gi.Gio.Settings({
	settings_schema:
		GioSettingsSchemaSource.new_from_directory(
			Me.dir.get_child('schemas').get_path(),
			GioSettingsSchemaSource.get_default(),
			false
		).lookup(Me.metadata['settings-schema'], true)
});
const UNLISTED_DEVICE = '__unlisted_device__';
