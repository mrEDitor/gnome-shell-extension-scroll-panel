/* exported init, buildPrefsWidget, UiBuilder */

const Gtk = imports.gi.Gtk;
// WARNING: No shell or extension imports allowed here or in class constructors
// since it will break buildPrefsView() call for development environment.

/**
 * Prefs widget tabs.
 *
 * @param {string} id - Tab identifier.
 * @param {Gtk.Builder} uiBuilder - UI builder to use.
 * @param {PrefsSource} prefsSource - Preferences source module to use.
 */
class PrefsTab {
    constructor(id, uiBuilder, prefsSource) {
        this.id = id;
        this._prefsSource = prefsSource;

        /** @type {Gtk.ToggleButton} */
        this.title = uiBuilder.get_object(id);
    }

    /**
     * @returns {_Setting<string[]>} - Actor path setting.
     */
    get actorPath() {
        return this._prefsSource.switcherActorPath(this.id);
    }

    /**
     * @returns {_Setting<number>} - Actor width setting.
     */
    get actorWidth() {
        return this._prefsSource.switcherActorWidth(this.id);
    }

    /**
     * @returns {number} - Actor width setting value or its default.
     */
    get actorWidthValueOrDefault() {
        return this.actorWidth.value >= 0
            ? this.actorWidth.value
            : this.actorWidthDefault;
    }

    /**
     * @returns {number} - Actor width setting default.
     */
    get actorWidthDefault() {
        return this.actorWidth.defaultValue >= 0
            ? this.actorWidth.defaultValue
            : 300;
    }

    /**
     * @returns {_Setting<string>} - Actor content align setting.
     */
    get actorAlign() {
        return this._prefsSource.switcherActorAlign(this.id);
    }

    /**
     * @returns {_Setting<number>} - Horizontal multiplier setting.
     */
    get horizontalMultiplier() {
        return this._prefsSource.switcherHorizontalMultiplier(this.id);
    }

    /**
     * @returns {_Setting<number>} - Vertical multiplier setting.
     */
    get verticalMultiplier() {
        return this._prefsSource.switcherVerticalMultiplier(this.id);
    }

    /**
     * @returns {_Setting<number>} - Timeout setting.
     */
    get timeout() {
        return this._prefsSource.switcherTimeout(this.id);
    }

    /**
     * @returns {_Setting<boolean>} - Cyclic switching setting.
     */
    get cycle() {
        return this._prefsSource.switcherCycle(this.id);
    }

    /**
     * @returns {_Setting<boolean>} - Visualize switching setting.
     */
    get visualize() {
        return this._prefsSource.switcherVisualize(this.id);
    }
}

var UiBuilder = class _UiBuilder {
    /**
     * @param {object} extension - Extension object to build prefs widget for.
     */
    constructor(extension) {
        this._metadata = extension.metadata;
        this._builder = Gtk.Builder.new_from_file(
            `${extension.dir.get_path()}/prefs.ui`
        );
        this._prefsSource = new extension.imports.prefsSource.PrefsSource(
            extension
        );

        /**
         * Ui Widget to build. Does not contains preferences bindings
         * unless {@link bindPrefs()} was called.
         */
        this._widget = this._builder.get_object('content');

        this._tabChooserHint = this._builder.get_object('tab-chooser-hint');
        this._aboutBox = this._builder.get_object('about-box');
        this._scrollBox = this._builder.get_object('scroll-box');
        this._settingsBox = this._builder.get_object('settings-box');
        this._aboutTab = this._builder.get_object('about');
        this._workspacesSwitcherTab = new PrefsTab(
            'workspaces-switcher',
            this._builder,
            this._prefsSource
        );
        this._windowsSwitcherTab = new PrefsTab(
            'windows-switcher',
            this._builder,
            this._prefsSource
        );
        this._tabs = [
            this._workspacesSwitcherTab,
            this._windowsSwitcherTab,
        ];

        this._actorChoose = this._builder.get_object('setting-actor-choose');
        this._actor = this._builder.get_object('setting-actor');

        // {@link _actorWidth} doesn't change setting value while is insensitive.
        this._actorWidth = this._builder.get_object('setting-actor-width');
        this._actorWidthEnable = this._builder.get_object('setting-actor-width-enable');

        this._actorAlignOff = this._builder.get_object('setting-actor-align-off');
        this._actorAlignStart = this._builder.get_object('setting-actor-align-start');
        this._actorAlignCenter = this._builder.get_object('setting-actor-align-center');
        this._actorAlignEnd = this._builder.get_object('setting-actor-align-end');
        this._actorAlignToggles = [
            this._actorAlignOff,
            this._actorAlignStart,
            this._actorAlignCenter,
            this._actorAlignEnd,
        ];

        this._horizontalOff = this._builder.get_object('setting-off-horizontal');
        this._horizontalDirect = this._builder.get_object('setting-direct-horizontal');
        this._horizontalInverted = this._builder.get_object('setting-inverted-horizontal');
        this._horizontalToggles = [
            this._verticalOff,
            this._verticalDirect,
            this._verticalInverted,
        ];

        this._verticalOff = this._builder.get_object('setting-off-vertical');
        this._verticalDirect = this._builder.get_object('setting-direct-vertical');
        this._verticalInverted = this._builder.get_object('setting-inverted-vertical');
        this._verticalToggles = [
            this._verticalOff,
            this._verticalDirect,
            this._verticalInverted,
        ];

        this._timeout = this._builder.get_object('setting-timeout');
        this._cycle = this._builder.get_object('setting-cycle');
        this._visualize = this._builder.get_object('setting-visualize');

        const gettext = this._gettext();
        for (const aboutLine of [
            `<span size="larger">${this._metadata.name} ${this._metadata.version || ''}</span>`,
            `I<span size="smaller">${this._metadata.uuid} v${this._metadata['semantic-version']}</span>`,
            `<span>${gettext('by <a href="%s">Eduard Minasyan</a>', 'https://mrEDitor.github.io/')}</span>`,
            `<span>${gettext('Homepage: <a href="%1$s">%1$s</a>', this._metadata.url)}</span>`,
            `<span>${gettext(
                // it's expected to be replaced with localizer copyright
                'Seems like you are using unlocalized extension, would you like to <a href="%s">localize it</a>?',
                `${this._metadata.url}#localization`
            )}</span>`,
            '',
            `<span>${gettext(this._metadata.description)}</span>`,
        ]) {
            this._aboutBox.append(new Gtk.Label({
                marginStart: 15,
                marginEnd: 15,
                marginTop: 5,
                marginBottom: 5,
                label: aboutLine[0] === 'I' ? aboutLine.substring(1) : aboutLine,
                selectable: aboutLine[0] === 'I',
                useMarkup: true,
                wrap: true,
            }));
        }

        // bind actor highlight on hover
        const motionController = new Gtk.EventControllerMotion();
        motionController.connect('enter', () => {
            if (!this._prefsSource.pickingActorPathAction.value) {
                // Active tab is not null since it's setting is visible.
                this._prefsSource.highlightPath.value =
                    this._getActiveTab().actorPath.value;
            }
        });
        motionController.connect('leave', () => {
            if (!this._prefsSource.pickingActorPathAction.value) {
                this._prefsSource.highlightPath.value = [];
            }
        });
        this._actorChoose.add_controller(motionController);

        // bind actor picker
        this._actorChoose.connect('toggled', button => {
            // Active tab is not null since it's setting is visible.
            this._prefsSource.pickingActorPathAction.value = button.active
                ? this._getActiveTab().id
                : '';
        });

        // bind rest of the settings
        this._actorWidth.connect(
            'value-changed',
            this._createSettingCallback((tab, widget) => {
                if (widget.sensitive) {
                    tab.actorWidth.value = widget.value;
                }
            })
        );
        this._actorWidthEnable.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    this._actorWidth.sensitive = true;
                    this._actorWidth.value = tab.actorWidthValueOrDefault;
                    tab.actorWidth.value = this._actorWidth.value;
                } else {
                    this._actorWidth.sensitive = false;
                    this._actorWidth.value = tab.actorWidthDefault;
                    tab.actorWidth.value = -1;
                }
            })
        );

        this._actorAlignOff.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.actorAlign.value = '';
                }
            })
        );
        this._actorAlignStart.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.actorAlign.value = 'start';
                }
            })
        );
        this._actorAlignCenter.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.actorAlign.value = 'center';
                }
            })
        );
        this._actorAlignEnd.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.actorAlign.value = 'end';
                }
            })
        );

        this._horizontalOff.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.horizontalMultiplier.value = 0;
                }
            })
        );
        this._horizontalDirect.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.horizontalMultiplier.value = +1;
                }
            })
        );
        this._horizontalInverted.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.horizontalMultiplier.value = -1;
                }
            })
        );

        this._verticalOff.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.verticalMultiplier.value = 0;
                }
            })
        );
        this._verticalDirect.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.verticalMultiplier.value = +1;
                }
            })
        );
        this._verticalInverted.connect(
            'toggled',
            this._createSettingCallback((tab, widget) => {
                if (widget.active) {
                    tab.verticalMultiplier.value = -1;
                }
            })
        );

        this._timeout.connect(
            'value-changed',
            this._createSettingCallback((tab, widget) => {
                tab.timeout.value = widget.value;
            })
        );
        this._cycle.connect(
            'notify::active',
            this._createSettingCallback((tab, widget) => {
                tab.cycle.value = widget.active;
            })
        );
        this._visualize.connect(
            'notify::active',
            this._createSettingCallback((tab, widget) => {
                tab.visualize.value = widget.active;
            })
        );

        // bind tabs
        this._widget.connect('realize', () => {
            this._widget.get_root().set_titlebar(this._builder.get_object('titlebar'));
            this._widget.connect('unrealize', () => this._dispose());
        });
        for (const tab of this._tabs) {
            tab.title.connect('toggled', () => {
                if (tab.title.active) {
                    this._updateTab(tab);
                }
            });
        }
        this._aboutTab.connect('toggled', () => {
            if (this._aboutTab.active) {
                this._updateTab();
            }
        });
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

    /**
     * Update tab content according to interacted {@param tab}.
     *
     * @param {PrefsTab|undefined} tab - Interacted tab, if any.
     */
    _updateTab(tab = undefined) {
        this._tabChooserHint.revealed = tab === undefined;
        this._aboutBox.visible = tab === undefined;
        this._settingsBox.visible =  tab !== undefined;

        this._prefsSource.highlightPath.value = [];
        this._prefsSource.pickingActorPathAction.value = '';
        this._updateActorSetting();
        this._actorWidthEnable.active = tab?.actorWidth.value >= 0;

        // Required if `_actorWidthEnable` not changed and no callback called.
        this._actorWidth.sensitive = tab?.actorWidth.value >= 0;
        this._actorWidth.value = tab?.actorWidthValueOrDefault ?? 0;

        switch (tab?.actorAlign.value) {
        case 'start':
            this._actorAlignStart.active = true;
            break;
        case 'center':
            this._actorAlignCenter.active = true;
            break;
        case 'end':
            this._actorAlignEnd.active = true;
            break;
        default:
            this._actorAlignOff.active = true;
            break;
        }

        switch (tab?.horizontalMultiplier.value) {
        case 1:
            this._horizontalDirect.active = true;
            break;
        case -1:
            this._horizontalInverted.active = true;
            break;
        default:
            this._horizontalOff.active = true;
            break;
        }

        switch (tab?.verticalMultiplier.value) {
        case 1:
            this._verticalDirect.active = true;
            break;
        case -1:
            this._verticalInverted.active = true;
            break;
        default:
            this._verticalOff.active = true;
            break;
        }

        this._timeout.value = tab?.timeout.value || 0;
        this._cycle.active = tab?.cycle.value || false;
        this._visualize.active = tab?.visualize.value || false;
    }

    /**
     * Setup the widget for demonstration.
     *
     * @returns {Gtk.Box} - Prefs widget in demo variant.
     */
    bindDemo() {
        this._prefsChangeDisposers = [this._prefsSource.useDefaults()];

        this._scrollBox.vscrollbar_policy = Gtk.PolicyType.NEVER;
        this._workspacesSwitcherTab.title.active = true;
        return this._widget;
    }

    /**
     * Setup the widget for extension.
     *
     * @returns {Gtk.Box} - Prefs widget with extension bindings.
     */
    bindPrefs() {
        this._prefsChangeDisposers = [
            // init settings
            this._prefsSource.trackChanges(),
            // bind actor picker feedback to text field
            this._prefsSource.highlightPath.onChange(
                () => this._updateActorSetting()
            ),
            this._prefsSource.pickingActorPathAction.onChange(
                () => this._updateActorSetting()
            ),
        ];

        this._aboutTab.active = true;
        return this._widget;
    }

    _updateActorSetting() {
        const tab = this._getActiveTab();
        if (this._prefsSource.pickingActorPathAction.value) {
            const actorPath = this._prefsSource.highlightPath.value;
            this._actor.text = actorPath.join(' > ');
            this._actorChoose.active = true;
        } else if (tab) {
            const actorPath = tab.actorPath.value;
            this._actor.text = actorPath.join(' > ');
            this._actorChoose.active = false;
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
     *
     * @returns {function(string, ...string[]): string} - Gettext localization
     * helper with formatting abilities. The first method argument is message
     * body, the second is message variables to replace %s and %1$s with.
     * %s and %1$s notations should not be mixed.
     */
    _gettext() {
        const gettext = imports.gettext;
        const gettextDomain =  gettext.domain(this._metadata['gettext-domain']);
        return (message, ...args) => {
            let iter = 0;
            return gettextDomain.gettext(message)
                .replaceAll(
                    /%(?:%|([1-9][0-9]*\$)?s)/g,
                    (q, i) => q === '%%' ? '%' : args[i ? parseInt(i) - 1 : iter++]
                );
        };
    }

    _dispose() {
        const activeTab = this._getActiveTab();
        if (activeTab) {
            activeTab.title.active = false;
            this._updateTab();
        }
        this._prefsChangeDisposers.forEach(c => c());
        this._prefsChangeDisposers = [];
    }
};

/**
 * Initialize preferences submodule.
 */
function init() {
    try {
        const extension = imports.misc.extensionUtils.getCurrentExtension();
        /** @type {DebugModule} */
        const Debug = extension.imports.debug.module;
        Debug.logDebug('Initializing prefs widget...');
        Debug.injectModulesTraceLogs(extension.imports);
    } catch {
        // Debug module is optional.
    }
    imports.misc.extensionUtils.initTranslations();
}

/**
 * Build extension preferences widget with {@link UiBuilder.bindPrefs()}.
 *
 * @returns {Gtk.Widget} - The preferences widget.
 */
function buildPrefsWidget() {
    const extension = imports.misc.extensionUtils.getCurrentExtension();
    const uiBuilder = new UiBuilder(extension);
    return uiBuilder.bindPrefs();
}
