/* exported init, buildPrefsWidget, UiBuilder */

const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext;
// WARNING: No shell or extension imports allowed here since
// it will break buildPrefsView() call for development environment.

/**
 * Prefs widget tabs.
 * @param {string} id - Tab identifier.
 * @param {Gtk.Builder} uiBuilder - UI builder to use.
 * @param {string[]|null} actorPath - Predefined actor path, if any.
 */
class PrefsTab {
    constructor(id, uiBuilder, actorPath) {
        this._id = id;
        this._actorPath = actorPath || null;
        this.title = uiBuilder.get_object(id);
    }

    get actorPath() {
        return this._actorPath || this.actorPathSetting.value;
    }

    get actorPathSetting() {
        /** @type {object} */
        const Me = imports.misc.extensionUtils.getCurrentExtension();
        /** @type {StringArraySetting.prototype.constructor} */
        const PrefsStringArraySetting = Me.imports.prefsSource.StringArraySetting;

        return this._actorPath
            ? null
            : new PrefsStringArraySetting(`${this._id}-path`);
    }

    get devicesSettings() {
        /** @type {object} */
        const Me = imports.misc.extensionUtils.getCurrentExtension();
        /** @type {JsonSetting.prototype.constructor} */
        const PrefsJsonSetting = Me.imports.prefsSource.JsonSetting;

        return new PrefsJsonSetting(`${this._id}-devices`);
    }
}

/**
 * Strongly typed prefs widget builder.
 * @param {string} uiFile - File to build widget from.
 */
class UiBuilder {
    constructor(uiFile) {
        this._uiFile = uiFile;
        this._builder = Gtk.Builder.new_from_file(uiFile);

        /**
         * Ui Widget to build. Does not contains preferences bindings
         * unless {@link bindPrefs()} was called.
         */
        this.widget = this._builder.get_object('content');

        // about widget when to tab is selected
        this._aboutBox = this._builder.get_object('about-box');
        this._tabChooserHint = this._builder.get_object('tab-chooser-hint');

        // settings tabs
        this._settingsBox = this._builder.get_object('settings-box');
        this._workspacesSwitcher = new PrefsTab(
            'workspaces-switcher',
            this._builder
        );
        this._windowsSwitcher = new PrefsTab(
            'windows-switcher',
            this._builder
        );
        this._windowsDragger = new PrefsTab(
            'windows-dragger',
            this._builder,
            ['any window']
        );
        this._tabs = [
            this._workspacesSwitcher,
            this._windowsSwitcher,
            this._windowsDragger,
        ];

        // actor chooser
        this._settingActorChoose = this._builder.get_object('setting-actor-choose');
        this._settingActor = this._builder.get_object('setting-actor');
        this._settingActorBox = this._builder.get_object('setting-actor-box');

        // rules list
        this._ruleList = this._builder.get_object('rule-list');
        this._ruleChooserHint = this._builder.get_object('rule-chooser-hint');
        this._ruleAdd = this._builder.get_object('rule-add');

        // rule settings
        this._ruleBox = this._builder.get_object('rule-box');
        this._ruleMatchHint = this._builder.get_object('rule-match-hint');
        this._ruleName = this._builder.get_object('setting-rule-name');
        this._deviceNameMask = this._builder.get_object('setting-device-name-mask');
        this._deviceNameChooser = this._builder.get_object('setting-device-name-choose');
        this._deviceVendorMask = this._builder.get_object('setting-device-vendor-mask');
        this._deviceVendorChooser = this._builder.get_object('setting-device-vendor-choose');
        this._deviceProductMask = this._builder.get_object('setting-device-product-mask');
        this._deviceProductChooser = this._builder.get_object('setting-device-product-choose');
        this._resistance = this._builder.get_object('setting-resistance');
        this._ruleDelete = this._builder.get_object('rule-delete');

        this.widget.connect('realize', () => {
            this.widget.get_root().set_titlebar(this._builder.get_object('titlebar'));
            // select no tab on start
            this._updateTab();
        });

        for (const tab of this._tabs) {
            tab.title.connect('toggled', () => this._updateTab());
        }
    }

    _updateTab() {
        const tab = this._getActiveTab();
        this._tabChooserHint.revealed = tab === undefined;
        this._aboutBox.visible = tab === undefined;
        this._settingsBox.visible =  tab !== undefined;
        this._settingActorBox.sensitive = !this._windowsDragger.title.active;
    }

    /**
     * Bind preferences to {@link UiBuilder.widget}.
     * @returns {Gtk.Box} - {@link UiBuilder.widget} with bindings.
     */
    bindPrefs() {
        /** @type {object} */
        this.Me = imports.misc.extensionUtils.getCurrentExtension();
        /** @type {PrefsSourceModule} */
        this.PrefsSource = this.Me.imports.prefsSource.module;

        for (const aboutLine of [
            `<span size="larger">${this.Me.metadata.uuid} ${this.Me.metadata.semanticVersion}</span>`,
            `<span>${this._gettext('by <a href="%s">Eduard Minasyan</a>', 'https://mrEDitor.github.io/')}</span>`,
            `<span>${this._gettext('Homepage: <a href="%1$s">%s</a>', this.Me.metadata.url)}</span>`,
            `<span>${this._gettext(
                // it's expected to be replaced with localizer copyright
                'Seems like you are using unlocalized extension, would you like to <a href="%s">localize it</a>?',
                `${this.Me.metadata.url}#localization`
            )}</span>`,
            '',
            `<span>${this._gettext(this.Me.metadata.description)}</span>`,
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

        this._bindTabs();
        this._bindActorChooser();
        this._bindRuleChooser();
        this._bindDeviceSettings();

        // select no rule at start
        this._updateRuleSettings(null);
        this._onUpdateRuleSettings();
        return this.widget;
    }

    _bindTabs() {
        for (const tab of this._tabs) {
            tab.title.connect('toggled', () => this._updateTabSettings());
        }

        // similar to 'no tab is selected now'
        this.widget.connect('unrealize', () => this._updateTabSettings());
    }

    _bindActorChooser() {
        // bind actor highlight on hover
        const motionController = new Gtk.EventControllerMotion();
        motionController.connect('enter', () => {
            if (!this.PrefsSource.pickPathKey.value) {
                // active tab should not be null as long
                // as this._settingActorChoose is visible
                this.PrefsSource.highlightPath.setValue(
                    this._getActiveTab().actorPathSetting.value
                );
            }
        });
        motionController.connect('leave', () => {
            if (!this.PrefsSource.pickPathKey.value) {
                this.PrefsSource.highlightPath.setValue([]);
            }
        });
        this._settingActorChoose.add_controller(motionController);

        // bind actor picker
        this._settingActorChoose.connect('toggled', button => {
            this.PrefsSource.pickPathKey.setValue(
                button.active ? this._getActiveTab().actorPathSetting.key : ''
            );
        });

        // bind actor picker feedback to text field
        this.PrefsSource.highlightPath.onChange(() => this._updateActorSetting());
        this.PrefsSource.pickPathKey.onChange(() => this._updateActorSetting());
    }

    _bindRuleChooser() {
        this._ruleList.connect('row-activated', () => {
            this._onAddRule();
        });
        this._ruleList.connect('row-selected', (box, row) => {
            this._updateRuleSettings(row);
        });
    }

    _bindDeviceSettings() {
        this._ruleName.connect('changed', () => this._onUpdateRuleSettings());
        this._deviceNameMask.connect('changed', () => this._onUpdateRuleSettings());
        this._deviceVendorMask.connect('changed', () => this._onUpdateRuleSettings());
        this._deviceProductMask.connect('changed', () => this._onUpdateRuleSettings());
        this._resistance.connect('value-changed', () => this._onUpdateRuleSettings());
        this._ruleDelete.connect('clicked', () => this._onDeleteRule());
    }

    _updateTabSettings() {
        // update actor settings
        this.PrefsSource.highlightPath.setValue([]);
        this.PrefsSource.pickPathKey.setValue('');
        this._updateActorSetting();

        // remove current rules
        for (
            let child = this._ruleList.get_first_child();
            child !== null;
            child = child.get_next_sibling()
        ) {
            if (child !== this._ruleAdd) {
                this._ruleList.remove(child);
            }
        }

        // restore rules of new tab
        const tab = this._getActiveTab();
        if (tab) {
            const deviceSettings = tab.devicesSettings.value;
            for (let i = 0; i < deviceSettings.length; ++i) {
                this._addRuleTitle(deviceSettings[i].ruleName, i);
            }
        }
    }

    _updateActorSetting() {
        const tab = this._getActiveTab();
        if (this.PrefsSource.pickPathKey.value) {
            const actorPath = this.PrefsSource.highlightPath.value;
            this._settingActor.text = actorPath.join(' > ');
            this._settingActorChoose.active = true;
        } else if (tab) {
            const actorPath = tab.actorPath;
            this._settingActor.text = actorPath.join(' > ');
            this._settingActorChoose.active = false;
        }
    }

    _onAddRule() {
        const deviceSettings = this._getActiveTab().devicesSettings;
        const newRuleName = 'New rule';

        // generate rule settings
        const index = deviceSettings.value.length;
        deviceSettings.value.push(Object.assign(
            { ruleName: newRuleName },
            this.PrefsSource.defaultDeviceSettings
        ));
        deviceSettings.setValue(deviceSettings.value);

        // create and show rule
        this._ruleList.select_row(
            this._addRuleTitle(newRuleName, index)
        );
    }

    /**
     * @param {string} name - Rule name.
     * @param {number} index - Rule index.
     * @returns {Gtk.ListBoxRow} - New rule title.
     */
    _addRuleTitle(name, index) {
        const ruleUiBuilder = Gtk.Builder.new_from_file(
            this._uiFile.replace(/\.[a-zA-Z0-9]+$/, ext => `.rule${ext}`)
        );
        const ruleTitleBox = ruleUiBuilder.get_object('rule-title-box');
        const ruleTitle = ruleUiBuilder.get_object('rule-title');

        ruleTitle.label = name;
        const titleBinding = this._ruleName.connect('changed', () => {
            if (this._ruleList.get_selected_row() === ruleTitleBox) {
                ruleTitle.label = this._ruleName.text;
            }
        });
        ruleTitleBox.connect('unrealize', () => {
            this._ruleName.disconnect(titleBinding);
        });

        this._ruleList.insert(ruleTitleBox, index);
        return ruleTitleBox;
    }

    _onUpdateRuleSettings() {
        /** @type {Gtk.ListBoxRow} */
        const tab = this._getActiveTab();
        const ruleRow = this._ruleList.get_selected_row();
        /** @type {DeviceSettings} */
        const newSettings = {
            ruleName: this._ruleName.text,
            deviceNameMask: this._deviceNameMask.text,
            deviceProductMask: this._deviceProductMask.text,
            deviceVendorMask: this._deviceVendorMask.text,
            resistance: this._resistance.value,
        };

        // If a rule is selected, write changed setting back to it's prefsSource.
        // It may re-write just fetched options back, but it will not result in
        // any effective changes, so should not infinite-loop anything.
        if (tab && ruleRow) {
            const deviceSettings = tab.devicesSettings;
            deviceSettings.value[ruleRow.get_index()] = newSettings;
            deviceSettings.setValue(deviceSettings.value);
        }

        // update "matchers conjunction" hint
        const ruleMatchers =
            (newSettings.deviceNameMask?.length > 0) +
            (newSettings.deviceVendorMask?.length > 0) +
            (newSettings.deviceProductMask?.length > 0);
        this._ruleMatchHint.revealed = ruleMatchers > 1;
    }

    _onDeleteRule() {
        /** @type {Gtk.ListBoxRow} */
        const ruleRow = this._ruleList.get_selected_row();

        // remove from prefsSource
        const deviceSettings = this._getActiveTab().devicesSettings;
        deviceSettings.value.splice(ruleRow.get_index(), 1);
        deviceSettings.setValue(deviceSettings.value);

        this._ruleList.remove(ruleRow);
    }

    /**
     * @param {Gtk.ListBoxRow|null} row - New selected row, if any.
     */
    _updateRuleSettings(row) {
        /** @type {DeviceSettings} */
        const settings = row !== null
            ? this._getActiveTab().devicesSettings.value[row.get_index()]
            : this.PrefsSource.defaultDeviceSettings;
        this._ruleBox.sensitive = row !== null;
        this._ruleChooserHint.revealed = row === null;
        this._ruleName.text = settings.ruleName || '';
        this._deviceNameMask.text = settings.deviceNameMask || '';
        this._deviceVendorMask.text = settings.deviceVendorMask || '';
        this._deviceProductMask.text = settings.deviceProductMask || '';
        this._resistance.value = settings.resistance || 1;
    }

    /**
     * @returns {PrefsTab|undefined} - Current active tab.
     */
    _getActiveTab() {
        return this._tabs.find(tab => tab.title.active);
    }

    /**
     * Gettext localization helper with formatting abilities.
     * @param {string} message - Message to localize.
     * @param {string} args - Arguments to replace %s (or %1$s) tokens in message.
     * @return {string} - Localized string.
     */
    _gettext(message, ...args) {
        let iter = 0;
        return Gettext.gettext(message)
            .replaceAll(
                /%(?:%|([1-9][0-9]*\$)?s)/g,
                (q, i) => q === '%%' ? '%' : args[i ? parseInt(i) - 1 : iter++]
            );
    }
}

/**
 * Initialize preferences submodule.
 */
function init() {
    const Me = imports.misc.extensionUtils.getCurrentExtension();
    try {
        /** @type {DebugModule} */
        const Debug = Me.imports.debug.module;
        Debug.logDebug('Initializing prefs widget...');
        Debug.injectModulesTraceLogs(this.Me.imports);
    } catch {
        // Debug module is optional.
    }
    const Config = imports.misc.config;
    Gettext.bindtextdomain(Me.metadata['gettext-domain'], Config.LOCALEDIR);
}

/**
 * Build preferences widget with {@link UiBuilder.bindPrefs()}.
 * @returns {Gtk.Widget} - The preferences widget.
 */
function buildPrefsWidget() {
    const Me = imports.misc.extensionUtils.getCurrentExtension();
    const uiBuilder = new UiBuilder(`${Me.dir.get_path()}/prefs.ui`);
    return uiBuilder.bindPrefs();
}
