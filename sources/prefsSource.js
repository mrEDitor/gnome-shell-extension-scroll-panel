/* exported PrefsSource */

const { Gio, GObject } = imports.gi;
// WARNING: No shell or extension imports allowed here or in class constructors
// since it will break buildPrefsView() call for development environment.

/**
 * @class
 * Base class for setting objects.
 */
var Setting = GObject.registerClass(
    /**
     * @template T
     */
    class _Setting extends GObject.Object {
        /**
         * @param {Gio.Settings} source - Setting source.
         * @param {string} key - Setting key.
         * @param {T} defaultValue - Default setting value.
         * @param {function(): T} getter - Setting getter.
         * @param {function(T)} setter - Setting setter.
         */
        _init(source, key, defaultValue, getter, setter) {
            this.key = key;
            this._defaultValue = defaultValue;
            this._getter = getter;
            this._setter = setter;
            this._source = source;
        }

        /**
         * Bind "update own value" callback.
         * Should be called before accessing value in any way in order to
         * register value fetching before other callbacks will be called.
         * Signal call order is guaranteed:
         * {@link https://developer.gnome.org/gobject/stable/gobject-Signals.html}
         *
         * @returns {function()} - Tracking disposer callback. Should be called
         * to cleanup resources when setting is not needed anymore.
         */
        trackChanges() {
            /** @type {DebugModule|null} */
            let debug = null;
            try {
                const extension = imports.misc.extensionUtils.getCurrentExtension();
                debug = extension.imports.debug?.module;
            } catch {
                // Debug module is optional.
            }

            return this.onChange(() => {
                /** @type {T} */
                this._value = this._getter();
                debug?.logDebug(`Setting ${this.key} set to: ${this._value}`);
            });
        }

        useDefault() {
            this._value = this._defaultValue;
            this._setter = () => {};
        }

        get defaultValue() {
            return this._defaultValue;
        }

        get value() {
            return this._value;
        }

        set value(value) {
            this._setter(value);
        }

        /**
         * Subscribe a callback for setting value changes and call it initially.
         *
         * @param {function(string, T)} callback - Value change callback
         * @returns {function()} - Callback for subscription cancellation.
         */
        onChange(callback) {
            const cId = this._source.connect(
                `changed::${this.key}`,
                () => callback(this.key, this._value)
            );
            callback(this.key, this._value);
            return () => {
                this._source.disconnect(cId);
            };
        }
    }
);

var PrefsSource = class _PrefsSource {
    /**
     * @param {object} extension - Extension object to create prefs source for.
     */
    constructor(extension) {
        const parentSchema = Gio.SettingsSchemaSource.get_default();
        const path = extension.dir.get_child('schemas').get_path();
        const schema = extension.metadata['settings-schema'];
        this._source = new Gio.Settings({
            settings_schema:
                Gio.SettingsSchemaSource
                    .new_from_directory(path, parentSchema, false)
                    .lookup(schema, true),
        });

        /**
         * Path along the scene view to the actor to highlight.
         * The setting is used for extension-settings communication only and
         * intended to be empty when to setting widget is open.
         *
         * @type {_Setting<string[]>}
         */
        this.highlightPath = this._createStringArraySetting('highlight-path');

        /**
         * Name of switch action currently being picking actor for. It's values
         * should be a string array.
         * The setting is used for extension-settings communication only and
         * intended to be empty when no settings widget is open.
         *
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
         * Cache for {@link _setting(key)}.
         *
         * @type {object<string, _Setting>}
         */
        this._settings = {};
    }

    /**
     * Path along the scene view to the actor to make it a scrollable switcher.
     *
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<string[]>} - Switcher actor path setting.
     */
    switcherActorPath(action) {
        return this._getSetting(
            this._createStringArraySetting.bind(this),
            `${action}-path`
        );
    }

    /**
     * Minimum width for scrollable widget actor.
     *
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<number>} - Switcher actor width setting.
     */
    switcherActorWidth(action) {
        return this._getSetting(
            this._createNumericSetting.bind(this),
            `${action}-width`
        );
    }

    /**
     * Content align for scrollable widget actor.
     *
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<string>} - Switcher actor align setting.
     */
    switcherActorAlign(action) {
        return this._getSetting(
            this._createStringSetting.bind(this),
            `${action}-align`
        );
    }

    /**
     * Horizontal switching distance multiplier.
     *
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<number>} - Switcher horizontal multiplier setting.
     */
    switcherHorizontalMultiplier(action) {
        return this._getSetting(
            this._createNumericSetting.bind(this),
            `${action}-horizontal-multiplier`
        );
    }

    /**
     * Vertical switching distance multiplier.
     *
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<number>} - Switcher vertical multiplier setting.
     */
    switcherVerticalMultiplier(action) {
        return this._getSetting(
            this._createNumericSetting.bind(this),
            `${action}-vertical-multiplier`
        );
    }

    /**
     * Whether cyclic switching enabled.
     *
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<boolean>} - Cyclic switching setting.
     */
    switcherCycle(action) {
        return this._getSetting(
            this._createBooleanSetting.bind(this),
            `${action}-cycle`
        );
    }

    /**
     * Whether switching should be visualized.
     *
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<boolean>} - Visualize switching setting.
     */
    switcherVisualize(action) {
        return this._getSetting(
            this._createBooleanSetting.bind(this),
            `${action}-visualize`
        );
    }

    /**
     * Timeout (in milliseconds) to ignore further scrolling after switching.
     *
     * @param {string} action - Switcher action identifier.
     * @returns {_Setting<number>} - Switching timeout setting.
     */
    switcherTimeout(action) {
        return this._getSetting(
            this._createNumericSetting.bind(this),
            `${action}-timeout`
        );
    }

    useDefaults() {
        for (const action of [this.windowsSwitcher, this.workspacesSwitcher]) {
            for (const switcherAccessor of this._listSwitcherSettings()) {
                switcherAccessor.call(this, action).useDefault();
            }
        }
        return () => {};
    }

    /**
     * Subscribe callback to any setting change and call callback initially.
     *
     * @param {function()|undefined} callback - Callback for settings change.
     * @returns {function()} - Callback for unsubscription.
     */
    trackChanges(callback = undefined) {
        const settings = this._listSwitcherSettings();
        const disposers = [
            this.highlightPath.trackChanges(),
            this.pickingActorPathAction.trackChanges(),
            ...[this.windowsSwitcher, this.workspacesSwitcher].flatMap(
                action => settings.map(
                    setting => setting.call(this, action).trackChanges()
                )
            ),
        ];

        if (callback) {
            const cId = this._source.connect('changed', () => callback());
            callback();
            return () => {
                this._source.disconnect(cId);
                disposers.forEach(c => c());
            };
        } else {
            return () => disposers.forEach(c => c());
        }
    }

    /**
     * @param {string} key - Setting key.
     * @returns {_Setting<boolean>} - Boolean setting.
     */
    _createBooleanSetting(key) {
        return new Setting(
            this._source,
            key,
            this._source.get_default_value(key).get_boolean(),
            () => this._source.get_boolean(key),
            value => this._source.set_boolean(key, value)
        );
    }

    /**
     * @param {string} key - Setting key.
     * @returns {_Setting<number>} - Numeric setting.
     */
    _createNumericSetting(key) {
        return new Setting(
            this._source,
            key,
            this._source.get_default_value(key).get_double(),
            () => this._source.get_double(key),
            value => this._source.set_double(key, value)
        );
    }

    /**
     * @param {string} key - Setting key.
     * @returns {_Setting<string>} - String setting.
     */
    _createStringSetting(key) {
        return new Setting(
            this._source,
            key,
            this._source.get_default_value(key).get_string(),
            () => this._source.get_string(key),
            value => this._source.set_string(key, value)
        );
    }

    /**
     * @param {string} key - Setting key.
     * @returns {_Setting<string[]>} - String array setting.
     */
    _createStringArraySetting(key) {
        return new Setting(
            this._source,
            key,
            this._source.get_default_value(key).get_strv(),
            () => this._source.get_strv(key),
            value => this._source.set_strv(key, value)
        );
    }

    /**
     * @template T
     * @param {function(string): T} settingFactory - Setting object factory.
     * @param {string} key - Setting key.
     * @returns {T} - Requested setting object.
     */
    _getSetting(settingFactory, key) {
        let setting = this._settings[key];
        if (!setting) {
            setting = settingFactory(key);
            this._settings[key] = setting;
        }
        return setting;
    }

    /**
     * @returns {(function(string): _Setting)[]} - Functions that provide
     * settings for switcher specified by it's identifier as the only argument.
     */
    _listSwitcherSettings() {
        return [
            this.switcherActorPath,
            this.switcherActorWidth,
            this.switcherActorAlign,
            this.switcherHorizontalMultiplier,
            this.switcherVerticalMultiplier,
            this.switcherCycle,
            this.switcherTimeout,
            this.switcherVisualize,
        ];
    }
};
