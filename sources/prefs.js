/* exported init, buildPrefsWidget, UiBuilder */

const { Gtk } = imports.gi;
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

        /** @type {PrefsSource} */
        this._prefsSource = prefsSource;

        /** @type {Gtk.Box} */
        this.settings = uiBuilder.get_object(id);
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
         * The root UI widget to build. Does not bind preferences for write
         * unless {@link bindPrefs()} was called.
         * 
         * @type {Gtk.Box}
         */
        this._widget = this._builder.get_object('content');

        /** @type {Gtk.ToggleButton} */ 
        this._actorChoose = this._builder.get_object('setting-actor-choose');

        /** @type {Gtk.Popover} */ 
        this._actorChoosePopover = this._builder.get_object('setting-actor-choose-popover');

        /** @type {Gtk.CheckButton} */ 
        this._actorWidthEnable = this._builder.get_object('setting-actor-width-enable');

        /**
         * Doesn't change setting value while is insensitive.
         * 
         * @type {Gtk.SpinButton}
         */ 
        this._actorWidth = this._builder.get_object('setting-actor-width');

        this._prefTabs = [
            undefined,
            new PrefsTab('workspaces-switcher', this._builder, this._prefsSource),
            new PrefsTab('windows-switcher', this._builder, this._prefsSource),
        ];

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
        const aboutBoxContent = this._builder.get_object('about-box-content');
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
            aboutBoxContent.append(new Gtk.Label({
                marginStart: 15,
                marginEnd: 15,
                marginTop: 5,
                marginBottom: 5,
                justify: Gtk.Justification.CENTER,
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
                // Active tab is not null since this setting is visible.
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
        this._widget.connect('unrealize', () => this._dispose());
        this._builder.get_object('tabs').connect('notify::page', () => {
            this._updateTab(this._getActiveTab());
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
        this._prefsSource.highlightPath.value = [];
        this._prefsSource.pickingActorPathAction.value = '';
        this._updateActorChooser();

        if (tab === undefined) {
            return;
        }

        const settingsBox = this._builder.get_object('settings-box');
        settingsBox.unparent();
        tab.settings.append(settingsBox);
        this._actorWidthEnable.active = tab.actorWidth.value >= 0;

        // Required if `_actorWidthEnable` not changed and no callback called.
        this._actorWidth.sensitive = tab.actorWidth.value >= 0;
        this._actorWidth.value = tab.actorWidthValueOrDefault ?? 0;

        switch (tab.actorAlign.value) {
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

        switch (tab.horizontalMultiplier.value) {
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

        switch (tab.verticalMultiplier.value) {
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

        this._timeout.value = tab.timeout.value || 0;
        this._cycle.active = tab.cycle.value || false;
        this._visualize.active = tab.visualize.value || false;
    }

    /**
     * Setup the widget for demonstration.
     *
     * @returns {Gtk.Box} - Prefs widget in demo variant.
     */
    bindDemo() {
        this._prefsSource.useDefaults();
        this._actorChoosePopover.autohide = true;

        this._actorChoose.connect('toggled', button => {
            if (button.active) {
                this._actorChoosePopover.set_pointing_to(this._actorChoose.get_allocation());
                this._actorChoosePopover.popup();
            } else {
                this._actorChoosePopover.popdown();
            }
        });
        this._actorChoosePopover.connect('closed', () => {
            this._actorChoose.active = false;
        });

        this._widget.connect('realize', () => {
            this._widget.page = this._prefTabs.findIndex(
                tab => tab !== undefined
            );
        });

        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        box.append(new imports.gi.Adw.HeaderBar());
        box.append(this._widget);
        return box;
    }

    /**
     * Setup the widget for extension.
     *
     * @returns {Gtk.Box} - Prefs widget with extension bindings.
     */
    bindPrefs() {
        this._prefsChangeDisposers = [
            this._prefsSource.trackChanges(),
            this._prefsSource.highlightPath.onChange(
                () => this._updateActorChooser()
            ),
            this._prefsSource.pickingActorPathAction.onChange(
                () => this._updateActorChooser()
            ),
        ];

        this._builder.get_object('reset-settings').connect('clicked', () => {
            this._prefsSource.reset();
        });

        this._actorChoose.connect('toggled', button => {
            const pickingActorPathAction = this._prefsSource.pickingActorPathAction;
            if (button.active) {
                // active tab setting-related since button is visible
                pickingActorPathAction.value = this._getActiveTab().id;
                this._actorChoosePopover.set_pointing_to(this._actorChoose.get_allocation());
                this._actorChoosePopover.popup();
            } else {
                // this branch can only called if extension is disabled
                // TODO: show "extension disabled, companion unavailable" popup
                pickingActorPathAction.value = '';
                this._actorChoosePopover.popdown();
            }
        });

        this._widget.connect('realize', () => {
            // TODO: add scrolling for Gnome <42?
            //if (this._widget.parent instanceof Gtk.Box) {
            //this._scrollBox.vscrollbar_policy = Gtk.PolicyType.NEVER;
            //}
        });

        return this._widget;
    }

    _updateActorChooser() {
        const tab = this._getActiveTab();
        const actor = this._builder.get_object('setting-actor');
        if (this._prefsSource.pickingActorPathAction.value) {
            actor.text = this._prefsSource.highlightPath.value.join(' > ');
            this._actorChoose.active = true;
        } else if (tab) {
            actor.text = tab.actorPath.value.join(' > ');
            this._actorChoose.active = false;
            this._actorChoosePopover.popdown();
        }
    }

    /**
     * @returns {PrefsTab|undefined} - Current active tab.
     */
    _getActiveTab() {
        return this._prefTabs[this._builder.get_object('tabs').page];
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
        this._updateTab();
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
