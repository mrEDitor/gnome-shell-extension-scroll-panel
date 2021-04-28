/* exported init, buildPrefsView, buildPrefsWidget */

const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext;

/**
 * Strongly typed prefs widget builder.
 * @param {string} uiFile - File to build widget from.
 */
class UiBuilder {
    /**
     * Get extension object. It CAN NOT be imported as const since
     * it will break buildPrefsView() call for development environment.
     * @returns {object} - Current extension accessor.
     */
    _me() {
        return imports.misc.extensionUtils.getCurrentExtension();
    }

    constructor(uiFile) {
        this._builder = Gtk.Builder.new_from_file(uiFile);
        this.content = this._builder.get_object('content');

        this._workspacesSwitcher = this._builder.get_object('workspaces-switcher');
        this._windowsSwitcher = this._builder.get_object('windows-switcher');
        this._windowsDragger = this._builder.get_object('windows-dragger');
        this._actionChooserHint = this._builder.get_object('action-chooser-hint');
        this._aboutBox = this._builder.get_object('about-box');

        this._settingActor = this._builder.get_object('setting-actor');
        this._settingActorChoose = this._builder.get_object('setting-actor-choose');
        this._ruleBox = this._builder.get_object('rule-box');
        this._ruleChooserHint = this._builder.get_object('rule-chooser-hint');
        this._ruleList = this._builder.get_object('rule-list');

        this._settingsBox = this._builder.get_object('settings-box');

        this._updateLayout();
        this._workspacesSwitcher.connect('toggled', () => this._updateLayout());
        this._windowsSwitcher.connect('toggled', () => this._updateLayout());
        this._windowsDragger.connect('toggled', () => this._updateLayout());
        this.content.connect('realize', () => {
            this.content.get_root().set_titlebar(this._builder.get_object('titlebar'));
        });
        this.content.connect('unrealize', () => {
            /** @type {PrefsSourceModule} */
            const PrefsSource = this._me().imports.prefsSource.module;
            PrefsSource.highlightPath.setValue([]);
            PrefsSource.pickPathKey.setValue('');
        });
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

    _bindActorHighlight() {
        /** @type {PrefsSourceModule} */
        const PrefsSource = this._me().imports.prefsSource.module;
        PrefsSource.highlightPath.onChange(() => {
            this._fetchSettingActor();
        });

        const motionController = new Gtk.EventControllerMotion();
        motionController.connect('enter', () => {
            const action = this._getTab();
            PrefsSource.highlightPath.setValue(
                action
                    ? PrefsSource.getStringArray(`${action}-path`)
                    : []
            );
        });
        motionController.connect('leave', () => {
            if (!PrefsSource.pickPathKey.value) {
                PrefsSource.highlightPath.setValue([]);
            }
        });
        this._settingActorChoose.add_controller(motionController);

        this._settingActorChoose.connect('toggled', button => {
            const action = button.active && this._getTab();
            PrefsSource.pickPathKey.setValue(action ? `${action}-path` : '');
        });
        PrefsSource.pickPathKey.onChange((key, value) => {
            this._settingActorChoose.active = !!value;
            this._fetchSettingActor();
        });
    }

    _updateLayout() {
        const isWorkspacesSwitcher = this._workspacesSwitcher.active;
        const isWindowsSwitcher = this._windowsSwitcher.active;
        const isWindowsDragger = this._windowsDragger.active;
        const isAbout = !(isWorkspacesSwitcher || isWindowsSwitcher || isWindowsDragger);
        const activeRule = this._ruleList.get_selected_row();

        this._actionChooserHint.revealed = isAbout;
        this._ruleChooserHint.revealed = activeRule === null;
        this._settingActor.sensitive = isWorkspacesSwitcher || isWindowsSwitcher;
        this._aboutBox.visible = isAbout;
        this._settingsBox.visible = !isAbout;
        this._ruleBox.sensitive = activeRule !== null;
        this._fetchSettingActor();
    }

    _fetchSettingActor() {
        /** @type {PrefsSourceModule} */
        const PrefsSource = this._me().imports.prefsSource.module;
        if (PrefsSource.pickPathKey.value) {
            this._settingActor.text = PrefsSource.highlightPath.value.join(' > ');
            return;
        }

        const action = this._getTab();
        if (action) {
            const value = PrefsSource.getStringArray(`${action}-path`);
            this._settingActor.text = value.join(' > ');
        } else {
            this._settingActor.text = '';
        }
    }

    /**
     * Process rule row activation, precisely:
     * - if the activated row's id is 'rule-add', construct and add to the rule list
     *   a rule row (widget builder file is {@param uiFile} with .rule.ui extension).
     * @param {string} uiFile - Prefs widget .ui file path.
     */
    _addRuleRow(uiFile) {
        const uiRuleBuilder = Gtk.Builder.new_from_file(uiFile.replace(/\.ui$/, '.rule.ui'));
        // uiRuleBuilder.get_object('rule-title').label = gesture.get_device().get_associated_device().name;
        const ruleList = this._builder.get_object('rule-list');
        const ruleAddRow = this._builder.get_object('rule-add');
        const newRow = uiRuleBuilder.get_object('rule-chooser');
        ruleList.insert(newRow, ruleAddRow.get_index());
        ruleList.select_row(newRow);
    }

    _getTab() {
        for (const actionId of ['workspaces-switcher', 'windows-switcher']) {
            if (this._builder.get_object(actionId).active) {
                return actionId;
            }
        }

        return undefined;
    }


    /**
     * Build and bind prefs UI widget.
     * @returns {Gtk.Box} - Prefs widget.
     */
    build() {
        for (const aboutMarkup of [
            `<span size="larger">${this._me().metadata.uuid} ${this._me().metadata.semanticVersion}</span>`,
            `<span>${this._gettext('by <a href="%s">Eduard Minasyan</a>', 'https://mrEDitor.github.io/')}</span>`,
            `<span>${this._gettext('Homepage: <a href="%1$s">%s</a>', this._me().metadata.url)}</span>`,
            `<span>${this._gettext(
                // it's expected to be replaced with localizer copyright
                'Seems like you are using unlocalized extension, would you like to <a href="%s">localize it</a>?',
                `${this._me().metadata.url}#localization`
            )}</span>`,
            '',
            `<span>${this._gettext(this._me().metadata.description)}</span>`,
        ]) {
            this._aboutBox.append(new Gtk.Label({
                marginStart: 15,
                marginEnd: 15,
                marginTop: 5,
                marginBottom: 5,
                label: aboutMarkup,
                useMarkup: true,
                wrap: true,
            }));
        }

        this._bindActorHighlight();
        return this.content;
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
        Debug.injectModulesTraceLogs(this._me().imports);
    } catch {
        // Debug module is optional.
    }
    const Config = imports.misc.config;
    Gettext.bindtextdomain(Me.metadata['gettext-domain'], Config.LOCALEDIR);
}

/**
 * @inheritDoc {Prefs.buildPrefsWidget}
 */
function buildPrefsWidget() {
    const Me = imports.misc.extensionUtils.getCurrentExtension();
    const uiBuilder = new UiBuilder(`${Me.dir.get_path()}/prefs.ui`);
    return uiBuilder.build();
}
