const Me = imports.misc.extensionUtils.getCurrentExtension();
const Config = imports.misc.config;
const localeDir = Me.dir.get_child('locale');
if (localeDir.query_exists(null))
	imports.gettext.bindtextdomain(Me.metadata['gettext-domain'], localeDir.get_path());
else
	imports.gettext.bindtextdomain(Me.metadata['gettext-domain'], Config.LOCALEDIR);
const gettext = imports.gettext.gettext;
