/* exported init, buildPrefsWidget, UiBuilder */

const Gtk = imports.gi.Gtk;
// WARNING: No shell or extension imports allowed here or in class constructors
// since it will break buildPrefsView() call for development environment.

function _me() {
    return imports.misc.extensionUtils.getCurrentExtension();
}

function _prefsSource() {
    return _me().imports.prefsSource.module;
}

/**
 * Prefs widget tabs.
 * @param {string} id - Tab identifier.
 * @param {Gtk.Builder} uiBuilder - UI builder to use.
 */
class PrefsTab {
    constructor(id, uiBuilder) {
        this.id = id;

        /** @type {Gtk.ToggleButton} */
        this.title = uiBuilder.get_object(id);
    }

    /**
     * @returns {_Setting<string[]>} - Actor path setting.
     */
    get actorPath() {
        return _prefsSource().switcherActorPath(this.id);
    }

    /**
     * @returns {_Setting<number>} - Actor width setting.
     */
    get actorWidth() {
        return _prefsSource().switcherActorWidth(this.id);
    }

    /**
     * @returns {_Setting<string>} - Actor content align setting.
     */
    get actorAlign() {
        return _prefsSource().switcherActorAlign(this.id);
    }

    /**
     * @returns {_Setting<number>} - Horizontal multiplier setting.
     */
    get horizontalMultiplier() {
        return _prefsSource().switcherHorizontalMultiplier(this.id);
    }

    /**
     * @returns {_Setting<number>} - Vertical multiplier setting.
     */
    get verticalMultiplier() {
        return _prefsSource().switcherVerticalMultiplier(this.id);
    }

    /**
     * @returns {_Setting<number>} - Timeout setting.
     */
    get timeout() {
        return _prefsSource().switcherTimeout(this.id);
    }

    /**
     * @returns {_Setting<boolean>} - Cyclic switching setting.
     */
    get cycle() {
        return _prefsSource().switcherCycle(this.id);
    }

    /**
     * @returns {_Setting<boolean>} - Visualize switching setting.
     */
    get visualize() {
        return _prefsSource().switcherVisualize(this.id);
    }
}

/**
 * Strongly typed prefs widget builder.
 * @param {string} uiFile - File to build widget from.
 */
class UiBuilder {
    constructor(uiFile) {
        this._builder = Gtk.Builder.new_from_file(uiFile);

        /**
         * Ui Widget to build. Does not contains preferences bindings
         * unless {@link bindPrefs()} was called.
         */
        this.widget = this._builder.get_object('content');

        // settings tab placeholder
        this._aboutBox = this._builder.get_object('about-box');
        this._tabChooserHint = this._builder.get_object('tab-chooser-hint');

        // settings tab content
        this._settingsBox = this._builder.get_object('settings-box');
        this._workspacesSwitcherTab = new PrefsTab(
            'workspaces-switcher',
            this._builder
        );
        this._windowsSwitcherTab = new PrefsTab(
            'windows-switcher',
            this._builder
        );
        this._tabs = [
            this._workspacesSwitcherTab,
            this._windowsSwitcherTab,
        ];

        this._actorChoose = this._builder.get_object('setting-actor-choose');
        this._actor = this._builder.get_object('setting-actor');
        this._actorWidth = this._builder.get_object('setting-actor-width');
        this._actorWidthEnable = this._builder.get_object('setting-actor-width-enable');
        this._actorAlignStart = this._builder.get_object('setting-actor-align-start');
        this._actorAlignCenter = this._builder.get_object('setting-actor-align-center');
        this._actorAlignEnd = this._builder.get_object('setting-actor-align-end');
        this._directHorizontal = this._builder.get_object('setting-direct-horizontal');
        this._invertedHorizontal = this._builder.get_object('setting-inverted-horizontal');
        this._directVertical = this._builder.get_object('setting-direct-vertical');
        this._invertedVertical = this._builder.get_object('setting-inverted-vertical');
        this._timeout = this._builder.get_object('setting-timeout');
        this._cycle = this._builder.get_object('setting-cycle');
        this._visualize = this._builder.get_object('setting-visualize');

        this.widget.connect('realize', () => {
            this.widget.get_root().set_titlebar(this._builder.get_object('titlebar'));
        });

        for (const tab of this._tabs) {
            tab.title.connect('toggled', () => this._updateTab());
        }

        this._updateTab();
    }

    _updateTab() {
        const tab = this._getActiveTab();
        this._tabChooserHint.revealed = tab === undefined;
        this._aboutBox.visible = tab === undefined;
        this._settingsBox.visible =  tab !== undefined;
    }

    /**
     * Bind preferences to {@link UiBuilder.widget}.
     * @returns {Gtk.Box} - {@link UiBuilder.widget} with bindings.
     */
    bindPrefs() {
        const gettext = this._gettext();
        for (const aboutLine of [
            `<span size="larger">${_me().metadata.name} ${_me().metadata.version || ''}</span>`,
            `<span size="smaller">${_me().metadata.uuid} v${_me().metadata.semanticVersion}</span>`,
            `<span>${gettext('by <a href="%s">Eduard Minasyan</a>', 'https://mrEDitor.github.io/')}</span>`,
            `<span>${gettext('Homepage: <a href="%1$s">%s</a>', _me().metadata.url)}</span>`,
            `<span>${gettext(
                // it's expected to be replaced with localizer copyright
                'Seems like you are using unlocalized extension, would you like to <a href="%s">localize it</a>?',
                `${_me().metadata.url}#localization`
            )}</span>`,
            '',
            `<span>${gettext(_me().metadata.description)}</span>`,
        ]) {
            this._aboutBox.append(new Gtk.Label({
                marginStart: 15,
                marginEnd: 15,
                marginTop: 5,
                marginBottom: 5,
                label: aboutLine,
                useMarkup: true,
                wrap: true,
            }));
        }

        for (const tab of this._tabs) {
            tab.title.connect('toggled', () => this._fetchSettings());
        }

        this.widget.connect('unrealize', () => this._fetchSettings());
        this._fetchSettings();

        // bind actor highlight on hover
        const motionController = new Gtk.EventControllerMotion();
        motionController.connect('enter', () => {
            if (!_prefsSource().pickingActorPathAction.value) {
                // Active tab is not null since it's setting is visible.
                _prefsSource().highlightPath.setValue(
                    this._getActiveTab().actorPath.value
                );
            }
        });
        motionController.connect('leave', () => {
            if (!_prefsSource().pickingActorPathAction.value) {
                _prefsSource().highlightPath.setValue([]);
            }
        });
        this._actorChoose.add_controller(motionController);

        // bind actor picker
        this._actorChoose.connect('toggled', button => {
            // Active tab is not null since it's setting is visible.
            _prefsSource().pickingActorPathAction.setValue(
                button.active ? this._getActiveTab().id : ''
            );
        });

        // bind actor picker feedback to text field
        _prefsSource().highlightPath.onChange(() => this._fetchActorSetting());
        _prefsSource().pickingActorPathAction.onChange(() => this._fetchActorSetting());

        this._actorWidth.connect(
            'value-changed',
            this._createSettingCallback((tab, widget) => {
                tab.actorWidth.setValue(widget.value);
            })
        );
        this._actorWidthEnable.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                tab.actorWidth.setValue(widget.active ? this._actorWidth.value : -1);
                this._actorWidth.sensitive = widget.active;
            })
        );
        this._actorAlignStart.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                tab.actorAlign.setValue(widget.active ? 'start' : '');
            })
        );
        this._actorAlignCenter.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                tab.actorAlign.setValue(widget.active ? 'center' : '');
            })
        );
        this._actorAlignEnd.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                tab.actorAlign.setValue(widget.active ? 'end' : '');
            })
        );
        this._directHorizontal.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                tab.horizontalMultiplier.setValue(widget.active ? 1 : 0);
            })
        );
        this._invertedHorizontal.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                tab.horizontalMultiplier.setValue(widget.active ? -1 : 0);
            })
        );
        this._directVertical.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                tab.verticalMultiplier.setValue(widget.active ? 1 : 0);
            })
        );
        this._invertedVertical.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                tab.verticalMultiplier.setValue(widget.active ? -1 : 0);
            })
        );
        this._timeout.connect(
            'value-changed',
            this._createSettingCallback((tab, widget) => {
                tab.timeout.setValue(widget.value);
            })
        );
        this._cycle.connect(
            'notify::active',
            this._createSettingCallback((tab, widget) => {
                tab.cycle.setValue(widget.active);
            })
        );
        this._visualize.connect(
            'notify::active',
            this._createSettingCallback((tab, widget) => {
                tab.visualize.setValue(widget.active);
            })
        );

        return this.widget;
    }

    /**
     * @param {function(PrefsTab, Gtk.Widget)} callback - Callback body.
     * @returns {function(Gtk.Widget)} - Tab-acknowledged callback.
     */
    _createSettingCallback(callback) {
        return widget => {
            const tab = this._getActiveTab();
            if (tab) {
                callback(tab, widget);
            }
        };
    }

    _fetchSettings() {
        _prefsSource().highlightPath.setValue([]);
        _prefsSource().pickingActorPathAction.setValue('');
        this._fetchActorSetting();

        const tab = this._getActiveTab();
        this._actorWidth.value = tab?.actorWidth.value >= 0 ? tab?.actorWidth.value : 300;
        this._actorWidth.sensitive = tab?.actorWidth.value !== -1;
        this._actorWidthEnable.active = tab?.actorWidth.value !== -1;
        this._directHorizontal.active = tab?.horizontalMultiplier.value === 1;
        this._invertedHorizontal.active = tab?.horizontalMultiplier.value === -1;
        this._directVertical.active = tab?.verticalMultiplier.value === 1;
        this._invertedVertical.active = tab?.verticalMultiplier.value === -1;
        this._timeout.value = tab?.timeout.value || 0;
        this._cycle.active = tab?.cycle.value || false;
        this._visualize.active = tab?.visualize.value || false;
    }

    _fetchActorSetting() {
        const tab = this._getActiveTab();
        if (_prefsSource().pickingActorPathAction.value) {
            const actorPath = _prefsSource().highlightPath.value;
            this._actor.text = actorPath.join(' > ');
            this._actorChoose.active = true;
        } else if (tab) {
            const actorPath = tab.actorPath.value;
            this._actor.text = actorPath.join(' > ');
            this._actorChoose.active = false;
        }
    }

    /**
     * @param {Gtk.ToggleButton} direct - Direct mode toggle.
     * @param {Gtk.ToggleButton} inverted - Inverted mode toggle.
     * @returns {number} - Resulting multiplier.
     */
    _getMultiplier(direct, inverted) {
        if (direct.active && !inverted.active) {
            return +1;
        } else if (!direct.active && inverted.active) {
            return -1;
        } else {
            return 0;
        }
    }

    /**
     * @returns {PrefsTab|undefined} - Current active tab.
     */
    _getActiveTab() {
        return this._tabs.find(tab => tab.title.active);
    }

    /**
     * Create Gettext localization helper with formatting abilities.
     * @return {function(string, ...string[]): string} - Gettext localization
     * helper with formatting abilities. The first method argument is message
     * body, the second is message variables to replace %s and %1$s with.
     */
    _gettext() {
        const gettext = imports.gettext;
        const gettextDomain =  gettext.domain(_me().metadata['gettext-domain']);
        return (message, ...args) => {
            let iter = 0;
            return gettextDomain.gettext(message)
                .replaceAll(
                    /%(?:%|([1-9][0-9]*\$)?s)/g,
                    (q, i) => q === '%%' ? '%' : args[i ? parseInt(i) - 1 : iter++]
                );
        };
    }
}

/**
 * Initialize preferences submodule.
 */
function init() {
    try {
        /** @type {DebugModule} */
        const Debug = _me().imports.debug.module;
        Debug.logDebug('Initializing prefs widget...');
        Debug.injectModulesTraceLogs(_me().imports);
    } catch {
        // Debug module is optional.
    }
    imports.misc.extensionUtils.initTranslations();
}

/**
 * Build preferences widget with {@link UiBuilder.bindPrefs()}.
 * @returns {Gtk.Widget} - The preferences widget.
 */
function buildPrefsWidget() {
    const uiBuilder = new UiBuilder(`${_me().dir.get_path()}/prefs.ui`);
    return uiBuilder.bindPrefs();
}
