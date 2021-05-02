/* exported module */

const { Gio, GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

/**
 * @interface DeviceSettings
 */
/**
 * @type {string}
 * @name DeviceSettings#ruleName
 */
/**
 * @type {string}
 * @name DeviceSettings#deviceNameMask
 */
/**
 * @type {string}
 * @name DeviceSettings#deviceVendorMask
 */
/**
 * @type {string}
 * @name DeviceSettings#deviceProductMask
 */
/**
 * @type {'direct'|'inverted'|'disabled'}
 * @name DeviceSettings#horizontal
 */
/**
 * @type {'direct'|'inverted'|'disabled'}
 * @name DeviceSettings#vertical
 */
/**
 * @type {number}
 * @name DeviceSettings#resistance
 */
/**
 * @type {boolean}
 * @name DeviceSettings#cycle
 */
/**
 * @type {boolean}
 * @name DeviceSettings#visualize
 */

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
var StringArraySetting = GObject.registerClass(
    class _StringArraySetting extends GObject.Object {
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
             * @type {string} key
             */
            this.key = key;

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
                `changed::${this.key}`,
                () => callback(this.key, this.value)
            );
            this.value = SettingsSource.get_strv(this.key);
            callback(this.key, this.value);
            return () => SettingsSource.disconnect(cId);
        }

        /**
         * Set new value for the setting.
         * @param {string[]} value - New value for the setting.
         */
        setValue(value) {
            SettingsSource.set_strv(this.key, value);
        }
    }
);

/**
 * @class
 * String setting accessor.
 * @param {string} key - Setting key.
 */
var StringSetting = GObject.registerClass(
    class _StringSetting extends GObject.Object {
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
             * @type {string} key
             */
            this.key = key;

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
                `changed::${this.key}`,
                () => callback(this.key, this.value)
            );
            this.value = SettingsSource.get_string(this.key);
            callback(this.key, this.value);
            return () => SettingsSource.disconnect(cId);
        }

        /**
         * Set new value for the setting.
         * @param {string} value - New value for the setting.
         */
        setValue(value) {
            SettingsSource.set_string(this.key, value);
        }
    }
);

/**
 * @class
 * JSON setting accessor.
 * @param {string} key - Setting key.
 * @template T
 */
var JsonSetting = GObject.registerClass(
    class _JsonSetting extends GObject.Object {
        _init(key) {
            // TODO: is it okay to abandon setting change connections?
            SettingsSource.connect(
                `changed::${key}`,
                () => {
                    const value = SettingsSource.get_string(key);
                    this.value = JSON.parse(value);
                    _logInfo(`Setting ${key} set to: ${value}`);
                }
            );

            /**
             * GSetting key
             * @type {string} key
             */
            this.key = key;

            /**
             * Current setting value.
             * @type {T} value
             */
            this.value = JSON.parse(SettingsSource.get_string(key));
        }

        /**
         * Subscribe a callback for setting value changes.
         * @param {function(string, T)} callback - Callback for value change.
         * @returns {function()} - Callback for subscription cancellation.
         */
        onChange(callback) {
            const cId = SettingsSource.connect(
                `changed::${this.key}`,
                () => callback(this.key, this.value)
            );
            this.value = JSON.parse(SettingsSource.get_string(this.key));
            callback(this.key, this.value);
            return () => SettingsSource.disconnect(cId);
        }

        /**
         * Set new value for the setting.
         * @param {T} value - New value for the setting.
         */
        setValue(value) {
            SettingsSource.set_string(this.key, JSON.stringify(value));
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

        /**
         * Workspaces switcher settings per device.
         * @type {JsonSetting<DeviceSettings[]>}
         */
        this.workspacesSwitcherDevices = new JsonSetting('workspaces-switcher-devices');

        /**
         * Windows switcher settings per device.
         * @type {JsonSetting<DeviceSettings[]>}
         */
        this.windowsSwitcherDevices = new JsonSetting('windows-switcher-devices');

        /**
         * Windows dragger settings per device.
         * @type {JsonSetting<DeviceSettings[]>}
         */
        this.windowsDraggerDevices = new JsonSetting('windows-dragger-devices');

        /**
         * Default {@link DeviceSettings} value.
         * @type {DeviceSettings}
         */
        this.defaultDeviceSettings = {
            resistance: 1,
        };
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
     * Set new value for string array setting.
     * @param {string} key - Setting key.
     * @param {string[]} value - New value for the setting.
     */
    setStringArray(key, value) {
        SettingsSource.set_strv(key, value);
    }
}();
