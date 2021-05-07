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
 * Base class for setting objects.
 */
const Setting = GObject.registerClass(
    /**
     * @template T
     */
    class _Setting extends GObject.Object {
        /**
         * @param {string} key - Setting key.
         * @param {function(): T} getter - Setting getter.
         * @param {function(T)} setter - Setting setter.
         */
        _init(key, getter, setter) {
            this.key = key;
            this._setter = setter;

            // Bind "update own value" callback first to fetch new value before
            // other callbacks will be called. Signal call order is guaranteed:
            // https://developer.gnome.org/gobject/stable/gobject-Signals.html
            // TODO: is it okay to abandon setting change connections?
            this.onChange(() => {
                // noinspection JSVoidFunctionReturnValueUsed
                /** @type {T} */
                this.value = getter();
                _logInfo(`Setting ${key} set to: ${this.value}`);
            });
        }

        /**
         * @param {T} value - New value for setting.
         */
        setValue(value) {
            this._setter(value);
        }

        /**
         * Subscribe a callback for setting value changes and call it initially.
         * @param {function(string, T)} callback - Value change callback
         * @returns {function()} - Callback for subscription cancellation.
         */
        onChange(callback) {
            const cId = SettingsSource.connect(
                `changed::${this.key}`,
                () => callback(this.key, this.value)
            );
            callback(this.key, this.value);
            return () => SettingsSource.disconnect(cId);
        }
    }
);

var module = new class PrefsSourceModule {
    constructor() {
        /**
         * Path along the scene view to the actor to highlight.
         * The setting is used for extension-settings communication only and
         * intended to be empty when to setting widget is open.
         * @type {_Setting<string[]>}
         */
        this.highlightPath = this._createStringArraySetting('highlight-path');

        /**
         * Name of switch action currently being picking actor for. It's values
         * should be a string array.
         * The setting is used for extension-settings communication only and
         * intended to be empty when no settings widget is open.
         * @type {_Setting<string>}
         */
        this.pickingActorPathAction = this._createStringSetting('picking-actor-path-action');

        /**
         * @type {string}
         */
        this.workspacesSwitcher = 'workspaces-switcher';

        /**
         * @type {string}
         */
        this.windowsSwitcher = 'windows-switcher';

        /**
         * @type {string}
         */
        this.windowsDragger = 'windows-dragger';

        /**
         * Cache for {@link _setting(key)}.
         */
        this._settings = [];
    }

    /**
     * Path along the scene view to the actor to make it a scrollable switcher.
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<string[]>} - Switcher action setting.
     */
    switcherActorPath(action) {
        return this._setting(this._createStringArraySetting, `${action}-path`);
    }

    /**
     * Horizontal switching distance multiplier.
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<number>} - Switcher horizontal multiplier setting.
     */
    switcherHorizontalMultiplier(action) {
        return this._setting(this._createNumericSetting, `${action}-horizontal-multiplier`);
    }

    /**
     * Vertical switching distance multiplier.
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<number>} - Switcher vertical multiplier setting.
     */
    switcherVerticalMultiplier(action) {
        return this._setting(this._createNumericSetting, `${action}-vertical-multiplier`);
    }

    /**
     * Whether cyclic switching enabled.
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<boolean>} - Cyclic switching setting.
     */
    switcherCycle(action) {
        return this._setting(this._createBooleanSetting, `${action}-cycle`);
    }

    /**
     * Whether switching should be visualized.
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<boolean>} - Visualize switching setting.
     */
    switcherVisualize(action) {
        return this._setting(this._createBooleanSetting, `${action}-visualize`);
    }

    /**
     * Timeout (in milliseconds) to ignore further scrolling after switching.
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<number>} - Switching timeout setting.
     */
    switcherTimeout(action) {
        return this._setting(this._createNumericSetting, `${action}-timeout`);
    }

    /**
     * Subscribe callback to any setting change and call callback initially.
     * @param {function()} callback - Callback for settings change.
     * @returns {function()} - Callback for unsubscription.
     */
    onChange(callback) {
        const cId = SettingsSource.connect('changed', () => callback());
        callback();
        return () => SettingsSource.disconnect(cId);
    }

    /**
     * @param {string} key - Setting key.
     * @returns {_Setting<boolean>} - Boolean setting.
     */
    _createBooleanSetting(key) {
        return new Setting(
            key,
            () => SettingsSource.get_boolean(key),
            value => SettingsSource.set_boolean(key, value)
        );
    }

    /**
     * @param {string} key - Setting key.
     * @returns {_Setting<number>} - Numeric setting.
     */
    _createNumericSetting(key) {
        return new Setting(
            key,
            () => SettingsSource.get_double(key),
            value => SettingsSource.set_double(key, value)
        );
    }

    /**
     * @param {string} key - Setting key.
     * @returns {_Setting<string>} - String setting.
     */
    _createStringSetting(key) {
        return new Setting(
            key,
            () => SettingsSource.get_string(key),
            value => SettingsSource.set_string(key, value)
        );
    }

    /**
     * @param {string} key - Setting key.
     * @returns {_Setting<string[]>} - String array setting.
     */
    _createStringArraySetting(key) {
        return new Setting(
            key,
            () => SettingsSource.get_strv(key),
            value => SettingsSource.set_strv(key, value)
        );
    }

    /**
     * @template T
     * @param {function(string): T} settingFactory - Setting object factory.
     * @param {string} key - Setting key.
     * @returns {T} - Requested setting object.
     */
    _setting(settingFactory, key) {
        let setting = this._settings[key];
        if (!setting) {
            setting = settingFactory(key);
            this._settings[key] = setting;
        }
        return setting;
    }
}();
