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
const Gio = imports.gi.Gio;
const GioSettingsSchemaSource = imports.gi.Gio.SettingsSchemaSource;
const Device = Me.imports.devices.Device;

const settings = new Gio.Settings({
	settings_schema:
		GioSettingsSchemaSource.new_from_directory(Me.dir.get_child('schemas').get_path(), GioSettingsSchemaSource.get_default(), false)
			.lookup(Me.metadata['settings-schema'], true),
});
const devices = { /* name1: Device, name2: Device */ };

function init() {
	const settingsChanged = ()=>{
		settings.get_value('devices').deep_unpack().every((arg) => {
			devices[arg[0]] = Device.prototype._construct.apply(Object.create(Device.prototype), arg);
		});
	}
	settings.connect('changed::devices', settingsChanged);
	settingsChanged();
}


let localiztion;
function get_l10n() {
	if (!localiztion) {
		const Gettext = imports.gettext;
		const domain = Me.metadata['gettext-domain'];
		Gettext.bindtextdomain(domain, Me.dir.get_child('locale').get_path());
		localiztion = Gettext.domain(domain).gettext;
	}
	return localiztion;
}
