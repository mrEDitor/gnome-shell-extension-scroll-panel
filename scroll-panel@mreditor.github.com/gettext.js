/**********************************************************************
 * This file is licensed under MIT license.                           *
 * Learn more from LICENSE file from package or upstream:             *
 * https://github.com/mrEDitor/gnome-shell-extension-scroll-panel/    *
 **********************************************************************/
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Config = imports.misc.config;
const localeDir = Me.dir.get_child('locale');

/**
 * Gettext binder.
 */
function bind() {
	if (localeDir.query_exists(null))
		imports.gettext.bindtextdomain(Me.metadata['gettext-domain'], localeDir.get_path());
	else
		imports.gettext.bindtextdomain(Me.metadata['gettext-domain'], Config.LOCALEDIR);
	return imports.gettext.gettext;
}
