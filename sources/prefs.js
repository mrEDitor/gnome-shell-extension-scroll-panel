/* exported init, buildPrefsView, buildPrefsWidget */

const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext;

/**
 * Prefs module of the extension.
 */
var module = new class PrefsModule {
    /**
     * Get extension object. It CAN NOT be imported as const since
     * it will break buildPrefsView() call for development environment.
     * @returns {object} - Current extension accessor.
     */
    _me() {
        return imports.misc.extensionUtils.getCurrentExtension();
    }

    /**
     * Build and bind prefs UI widget.
     * @returns {Gtk.Box} - Prefs widget.
     */
    buildPrefsWidget() {
        const [ui, uiBuilder] = this.buildPrefsView(`${this._me().dir.get_path()}/prefs.ui`);
        const aboutBox = uiBuilder.get_object('about-box');

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
            aboutBox.append(new Gtk.Label({
                marginStart: 15,
                marginEnd: 15,
                marginTop: 5,
                marginBottom: 5,
                label: aboutMarkup,
                useMarkup: true,
                wrap: true,
            }));
        }

        this._bindActorHighlight(uiBuilder);
        return ui;
    }

    /**
     * Build prefs UI view.
     * @param {string?} uiFile - Path to UI widget source.
     * @returns {[ Gtk.Box, Gtk.Builder ]} - The view actor and it's builder.
     */
    buildPrefsView(uiFile) {
        const uiBuilder = Gtk.Builder.new_from_file(uiFile);
        const widget = uiBuilder.get_object('content');

        widget.connect(
            'realize',
            () => widget.get_root().set_titlebar(uiBuilder.get_object('titlebar'))
        );

        uiBuilder.get_object('workspaces-switcher').connect(
            'toggled',
            () => this._updateLayout(uiBuilder)
        );
        uiBuilder.get_object('windows-switcher').connect(
            'toggled',
            () => this._updateLayout(uiBuilder)
        );
        uiBuilder.get_object('windows-dragger').connect(
            'toggled',
            () => this._updateLayout(uiBuilder)
        );

        this._updateLayout(uiBuilder);
        return [widget, uiBuilder];
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

    /**
     * Bind actor highlight effect to mouse enter event of setting-actor
     * and unhighlight to mouse leave and widget destroy events.
     * @param {Gtk.Builder} uiBuilder - Prefs widget actor builder.
     */
    _bindActorHighlight(uiBuilder) {
        /** @type {PrefsSourceModule} */
        const PrefsSource = this._me().imports.prefsSource.module;

        const motionController = new Gtk.EventControllerMotion();
        motionController.connect(
            'enter',
            () => {
                const action = this._getAction(uiBuilder);
                PrefsSource.highlightPath.setValue(
                    action
                        ? PrefsSource.getStringArray(`${action}-path`)
                        : []
                );
            }
        );
        motionController.connect(
            'leave',
            () => PrefsSource.highlightPath.setValue([])
        );
        uiBuilder.get_object('setting-actor').add_controller(motionController);

        uiBuilder.get_object('setting-actor').connect(
            'clicked',
            () => {
                const action = this._getAction(uiBuilder);
                PrefsSource.pickPathKey.setValue(action ? `${action}-path` : '');
            }
        );

        const widget = uiBuilder.get_object('content');
        widget.connect(
            'unrealize',
            () => {
                PrefsSource.highlightPath.setValue([]);
                PrefsSource.pickPathKey.setValue('');
            }
        );
    }

    /**
     * Update UI according to chosen action.
     * @param {Gtk.Builder} uiBuilder - UI builder.
     */
    _updateLayout(uiBuilder) {
        const isWorkspacesSwitcher = uiBuilder.get_object('workspaces-switcher').active;
        const isWindowsSwitcher = uiBuilder.get_object('windows-switcher').active;
        const isWindowsDragger = uiBuilder.get_object('windows-dragger').active;
        const isAbout = !(isWorkspacesSwitcher || isWindowsSwitcher || isWindowsDragger);
        const activeRule = uiBuilder.get_object('rule-list').get_selected_row();

        uiBuilder.get_object('action-chooser-hint').revealed = isAbout;
        uiBuilder.get_object('rule-chooser-hint').revealed = activeRule === null;
        uiBuilder.get_object('setting-actor').sensitive = isWorkspacesSwitcher || isWindowsSwitcher;
        uiBuilder.get_object('about-box').visible = isAbout;
        uiBuilder.get_object('settings-box').visible = !isAbout;
        uiBuilder.get_object('rule-box').sensitive = activeRule !== null;
    }

    /**
     * Process rule row activation, precisely:
     * - if the activated row's id is 'rule-add', construct and add to the rule list
     *   a rule row (widget builder file is {@param uiFile} with .rule.ui extension).
     * @param {Gtk.Builder} uiBuilder - Prefs widget builder.
     * @param {string} uiFile - Prefs widget .ui file path.
     */
    _addRuleRow(uiBuilder, uiFile) {
        const uiRuleBuilder = Gtk.Builder.new_from_file(uiFile.replace(/\.ui$/, '.rule.ui'));
        // uiRuleBuilder.get_object('rule-title').label = gesture.get_device().get_associated_device().name;
        const ruleList = uiBuilder.get_object('rule-list');
        const ruleAddRow = uiBuilder.get_object('rule-add');
        const newRow = uiRuleBuilder.get_object('rule-chooser');
        ruleList.insert(newRow, ruleAddRow.get_index());
        ruleList.select_row(newRow);
    }

    /**
     * Get action identifier (matches action chooser actor identifier in prefs
     * widget).
     * @param {Gtk.Builder} uiBuilder - Prefs widget builder.
     * @returns {string|undefined} - Action identifier.
     */
    _getAction(uiBuilder) {
        for (const actionId of ['workspaces-switcher', 'windows-switcher']) {
            if (uiBuilder.get_object(actionId).active) {
                return actionId;
            }
        }

        return undefined;
    }

    /**
     function build() {
        const wide_left = ui_builder.get_object('setting-wide-left');
        wide_left.active = Settings.is('wide-left');
        wide_left.connect('toggled', () => { Settings.settings.set_boolean('wide-left', wide_left.active); });

        const wide_center = ui_builder.get_object('setting-wide-center');
        wide_center.active = Settings.is('wide-center');
        wide_center.connect('toggled', () => { Settings.settings.set_boolean('wide-center', wide_center.active); });

        const devices_list = ui_builder.get_object('devices-list');
        for (let name in devices) {
            if (name != Settings.unlistedDevice)
            {
                const iter = devices_list.insert(0);
                devices_list.set_value(iter, DEVICE.NAME, name);
                devices_list.set_value(iter, DEVICE.DELETABLE, true);
            }
        }
        const devices_sel = ui_builder.get_object('devices').get_selection();
        const targets_sel = ui_builder.get_object('targets').get_selection();
        const selection_changed_listener = Lang.bind(null, _on_selection_changed, devices_sel, targets_sel, ui_builder);
        devices_sel.set_mode(Gtk.SelectionMode.MULTIPLE);
        targets_sel.set_mode(Gtk.SelectionMode.MULTIPLE);
        devices_sel.connect('changed', selection_changed_listener);
        targets_sel.connect('changed', selection_changed_listener);
        _on_affecting_configs_changed(0, ui_builder);

        const ui_controller = new Gtk.GestureClick();
        ui_controller.connect('pressed', Lang.bind(null, _add_or_find_device, ui_builder));
        ui_builder.get_object('device-this').add_controller(ui_controller);
        ui_builder.get_object('device-remove').connect('toggled', Lang.bind(null, _remove_device, ui_builder));

        const settings_changed_listener = Lang.bind(null, _on_settings_changed, ui_builder);
        ui_builder.get_object('setting-enable').connect('toggled', settings_changed_listener);
        ui_builder.get_object('setting-invert').connect('toggled', settings_changed_listener);
        ui_builder.get_object('setting-cyclic').connect('toggled', settings_changed_listener);
        ui_builder.get_object('setting-switcher').connect('toggled', settings_changed_listener);
        ui_builder.get_object('setting-pressure').connect('value-changed', settings_changed_listener);
    }

     /**
     * Selection change callback.
     *
     function _on_selection_changed(source, devices_sel, targets_sel, ui) {
        _on_affecting_configs_changed(devices_sel.count_selected_rows() * targets_sel.count_selected_rows(), ui);
    }

     /**
     * Device remove callback.
     *
     function _remove_device(source, path, ui) {
        let [ok, iter] = ui.get_object('devices').get_model().get_iter(Gtk.TreePath.new_from_string(path));
        const devices_list = ui.get_object('devices-list');
        delete devices[devices_list.get_value(iter, DEVICE.NAME)];
        devices_list.remove(iter);
    }

     /**
     * On config change callback.
     *
     function _on_affecting_configs_changed(count, ui) {
        ui.get_object('settings').sensitive = (count != 0);
        ui.get_object('info-empty-selection').visible = (count == 0);

        if (count != 0) {
            _foreach_selected((config) => {
                filllock = true;
                ui.get_object('setting-enable').active = config['setting-enable'];
                ui.get_object('setting-invert').active = config['setting-invert'];
                ui.get_object('setting-cyclic').active = config['setting-cyclic'];
                ui.get_object('setting-switcher').active = config['setting-switcher'];
                ui.get_object('setting-pressure').value = config['setting-pressure'];
                filllock = false;
            }, ui);
        }
    }

     /**
     * Adding device callback.
     *
     function _add_or_find_device(source, count, x, y, ui) {
        const device = source.get_device();
        const list = ui.get_object('devices-list');
        const selection = ui.get_object('devices').get_selection()
        list.foreach(
            (model, path, iter) => {
                if (list.get_value(iter, DEVICE.DELETABLE) == false) {
                    iter = list.insert(0);
                    list.set_value(iter, DEVICE.NAME, device.name);
                    list.set_value(iter, DEVICE.DELETABLE, true);
                    devices[device.name] = { ...devices[Settings.unlistedDevice] };
                } else if (list.get_value(iter, DEVICE.NAME) != device.name) {
                    return false;
                }
                selection.unselect_all();
                selection.select_iter(iter);
                return true;
            }
        );
        source.reset();
    }

     /**
     * Foreach callback executor.
     *
     function _foreach_selected(callback, ui) {
        let [devices_pathes, devices_model] =
            ui.get_object('devices').get_selection().get_selected_rows();
        let [targets_pathes, targets_model] =
            ui.get_object('targets').get_selection().get_selected_rows();
        devices_pathes.forEach((device_path) => {
            const [device_ok, device_iter] = devices_model.get_iter(device_path);
            const device_id = devices_model.get_value(device_iter, DEVICE.DELETABLE)
                ? devices_model.get_value(device_iter, DEVICE.NAME)
                : Settings.unlistedDevice;
            if (devices[device_id] == undefined) {
                devices[device_id] = {
                    'switching-workspaces': {},
                    'switching-windows': {},
                };
            }
            const targets = devices[device_id];
            targets_pathes.forEach((target_path) => {
                const [target_ok, target_iter] = targets_model.get_iter(target_path);
                const target_id = targets_model.get_value(target_iter, TARGET.ID);
                if (targets[target_id] == undefined) {
                    targets[target_id] = {
                        'setting-enable': true,
                        'setting-invert': false,
                        'setting-cyclic': false,
                        'setting-switcher': false,
                        'setting-pressure': 1,
                    };
                }
                callback(targets[target_id]);
            });
        });
    }

     /**
     * Settings change callback.
     *
     function _on_settings_changed(source, ui) {
        if (!filllock) {
            _foreach_selected((config) => {
                config['setting-enable'] = ui.get_object('setting-enable').active;
                config['setting-invert'] = ui.get_object('setting-invert').active;
                config['setting-cyclic'] = ui.get_object('setting-cyclic').active;
                config['setting-switcher'] = ui.get_object('setting-switcher').active;
                config['setting-pressure'] = ui.get_object('setting-pressure').value;
            }, ui);
            Settings.settings.set_string('devices', JSON.stringify(devices));
        }
    }
     ***/
}();

/**
 * Initialize preferences submodule.
 */
function init() {
    try {
        /** @type {DebugModule} */
        const Debug = module._me().imports.debug.module;
        Debug.logDebug('Initializing prefs widget...');
        Debug.injectModulesTraceLogs(module._me().imports);
    } catch {
        // Debug module is optional.
    }
    const Config = imports.misc.config;
    Gettext.bindtextdomain(module._me().metadata['gettext-domain'], Config.LOCALEDIR);
}

/**
 * @inheritDoc {Prefs.buildPrefsWidget}
 */
function buildPrefsWidget() {
    return module.buildPrefsWidget();
}
