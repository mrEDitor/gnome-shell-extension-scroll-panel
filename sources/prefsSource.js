/* exported module */

const { Gio, GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

/**
 * GSettings-based settings source.
 * @type {Gio.Settings}
 */
const SettingsSource = new Gio.Settings({
    settings_schema:
        Gio.SettingsSchemaSource
            .new_from_directory(
                Me.dir.get_child('schemas').get_path(),
                Gio.SettingsSchemaSource.get_default(),
                false
            )
            .lookup(
                Me.metadata['settings-schema'],
                true
            ),
});

/**
 * Log informational message.
 * @param {string} message - Message to log.
 * @see logDebug
 */
function _logInfo(message) {
    log(`[${Me.metadata.uuid}][INF] ${message}`);
}

/**
 * @class
 * String array setting accessor.
 * @param {string} key - Setting key.
 */
const StringArraySetting = GObject.registerClass(
    class StringArraySetting extends GObject.Object {
        /**
         * @inheritDoc {StringArraySetting}
         * @constructs
         */
        _init(key) {
            // TODO: is it okay to abandon setting change connections?
            SettingsSource.connect(
                `changed::${key}`,
                () => {
                    this.value = SettingsSource.get_strv(key);
                    _logInfo(`Setting ${key} set to: ${this.value}`);
                }
            );

            /**
             * GSetting key
             * @type {string} _key
             */
            this._key = key;

            /**
             * Current setting value.
             * @type {string[]} value
             */
            this.value = SettingsSource.get_strv(key);
        }

        /**
         * Subscribe a callback for setting value changes.
         * @param {function(string, string[])} callback - Callback for value change.
         * @returns {function()} - Callback for subscription cancellation.
         */
        onChange(callback) {
            const cId = SettingsSource.connect(
                `changed::${this._key}`,
                () => callback(this._key, this.value)
            );
            this.value = SettingsSource.get_strv(this._key);
            callback(this._key, this.value);
            return () => SettingsSource.disconnect(cId);
        }

        /**
         * Set new value for the setting.
         * @param {string[]} value - New value for the setting.
         */
        setValue(value) {
            SettingsSource.set_strv(this._key, value);
        }
    }
);

/**
 * @class
 * String setting accessor.
 * @param {string} key - Setting key.
 */
const StringSetting = GObject.registerClass(
    class StringSetting extends GObject.Object {
        /**
         * @inheritDoc {StringSetting}
         * @constructs
         */
        _init(key) {
            // TODO: is it okay to abandon setting change connections?
            SettingsSource.connect(
                `changed::${key}`,
                () => {
                    this.value = SettingsSource.get_string(key);
                    _logInfo(`Setting ${key} set to: ${this.value}`);
                }
            );

            /**
             * GSetting key
             * @type {string} _key
             */
            this._key = key;

            /**
             * Current setting value.
             * @type {string} value
             */
            this.value = SettingsSource.get_string(key);
        }

        /**
         * Subscribe a callback for setting value changes.
         * @param {function(string, string)} callback - Callback for value change.
         * @returns {function()} - Callback for subscription cancellation.
         */
        onChange(callback) {
            const cId = SettingsSource.connect(
                `changed::${this._key}`,
                () => callback(this._key, this.value)
            );
            this.value = SettingsSource.get_string(this._key);
            callback(this._key, this.value);
            return () => SettingsSource.disconnect(cId);
        }

        /**
         * Set new value for the setting.
         * @param {string} value - New value for the setting.
         */
        setValue(value) {
            SettingsSource.set_string(this._key, value);
        }
    }
);

var module = new class PrefsSourceModule {
    constructor() {
        /**
         * Path along the scene view to the actor to highlight.
         * The setting is used for extension-settings communication only and intended
         * to be empty when to setting widget is open.
         * @type {StringArraySetting}
         */
        this.highlightPath = new StringArraySetting('highlight-path');

        /**
         * Name of setting currently being picking. It should be a string array, namely
         * either 'workspaces-switcher-path' or 'windows-switcher-path'.
         * The setting is used for extension-settings communication only and intended
         * to be empty when no settings widget is open.
         * @type {StringSetting}
         */
        this.pickPathKey = new StringSetting('pick-path-key');

        /**
         * Path along the scene view to the actor to switch workspaces when scrolling over.
         * @type {StringArraySetting}
         */
        this.workspacesSwitcherPath = new StringArraySetting('workspaces-switcher-path');

        /**
         * Path along the scene view to the actor to switch windows when scrolling over.
         * @type {StringArraySetting}
         */
        this.windowsSwitcherPath = new StringArraySetting('windows-switcher-path');
    }

    /**
     * Subscribe callback to any setting change.
     * @param {function()} callback - Callback for settings change.
     * @returns {function()} - Callback for unsubscription.
     */
    onChange(callback) {
        const cId = SettingsSource.connect('changed', () => callback());
        callback();
        return () => SettingsSource.disconnect(cId);
    }

    /**
     * Get value of the string array setting.
     * @param {string} key - Setting key.
     * @returns {string[]} Current value for the setting.
     */
    getStringArray(key) {
        return SettingsSource.get_strv(key);
    }

    /**
     * Set new value for a string array setting.
     * @param {string} key - Setting key.
     * @param {string[]} value - New value for the setting.
     */
    setStringArray(key, value) {
        SettingsSource.set_strv(key, value);
    }
}();
