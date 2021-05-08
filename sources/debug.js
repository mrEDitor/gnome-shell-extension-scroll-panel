/* exported module */
// noinspection JSUnfilteredForInLoop
// This module is for debug purposes only. It is expected to be erased from
// release build and should be used inside try-catch only and may uses some hacks.

const Me = imports.misc.extensionUtils.getCurrentExtension();

/**
 * Debug class module.
 */
var module = new class DebugModule {
    /**
     * Log verbose message (in debug build only).
     * @param {string} message - Message to log.
     */
    logDebug(message) {
        log(`[${Me.metadata.uuid}][DBG] ${message}`);
    }

    /**
     * Add verbose step-in/step-out log messages to each method of module
     * (in debug build only).
     * @param {object} modules - Object to add methods tracing to.
     */
    injectModulesTraceLogs(modules) {
        /**
         * Names of modules to path.
         * <p>
         * We had to shuffle modules before patching (and thus loading) in debug
         * since release build may load them in different order and we should be
         * sure that module loading order is not important.
         * Also Gnome Shell does not support Object.keys() on module list, but
         * supports foreach.
         * </p>
         * @type {string[]}
         */
        const moduleNames = [];
        for (const moduleName in modules) {
            moduleNames.push(moduleName);
        }
        for (let i = moduleNames.length - 1; i > 0; --i) {
            const j = Math.floor(Math.random() * i);
            const temp = moduleNames[i];
            moduleNames[i] = moduleNames[j];
            moduleNames[j] = temp;
        }
        for (const moduleName of moduleNames) {
            for (const symbolName in modules[moduleName]) {
                const moduleSymbol = modules[moduleName][symbolName];
                switch (typeof moduleSymbol) {
                case 'object':
                    this.injectObjectTraceLogs(moduleSymbol, moduleName, symbolName);
                    continue;
                case 'function':
                    log(`[${Me.metadata.uuid}][STP] Symbol '${symbolName}' found in module '${moduleName}', patching constructor...`);
                    modules[moduleName][symbolName] = (...args) => {
                        try {
                            const instance = new moduleSymbol(...args);
                            if (typeof instance === 'object') {
                                this.injectObjectTraceLogs(
                                    instance,
                                    moduleName,
                                    symbolName
                                );
                            }
                            return instance;
                        } catch (e) {
                            // TODO: we may detect error type here to support
                            //       exceptions being thrown by constructor.
                            log(`[${Me.metadata.uuid}][STP] Instance of class '${symbolName}' from module '${moduleName}' patching problem:\n${e}`);
                            return moduleSymbol(...args);
                        }
                    };
                }
            }
        }
    }

    /**
     * Add verbose step-in/step-out log messages to each method of object
     * instance (in debug build only).
     * @param {object} instance - Object to add methods tracing to.
     * @param {string} moduleName - Module name.
     * @param {string} symbolName - Object name.
     */
    injectObjectTraceLogs(instance, moduleName, symbolName) {
        log(`[${Me.metadata.uuid}][STP] Instance of class '${symbolName}' from module '${moduleName}' spawned, patching...`);
        if (instance === this) {
            return;
        }
        const memberNames = Object.getOwnPropertyNames(instance);
        for (const memberName of memberNames) {
            const member = instance[memberName];
            if (typeof member !== 'function') {
                continue;
            }
            const memberFullName = `${moduleName}.${symbolName}.${memberName}`;
            log(`[${Me.metadata.uuid}][STP] Patching '${memberFullName}'...`);
            instance[memberName] = (...args) => {
                const memberCall = `${memberFullName}(${args.map(r => this._toShortString(r))})`;
                log(`[${Me.metadata.uuid}][STP] -> ${memberCall}`);
                const r = member.bind(instance)(...args);
                log(`[${Me.metadata.uuid}][STP] <- ${memberCall}: ${this._toShortString(r)}`);
                return r;
            };
        }
    }

    _toShortString(arg) {
        switch (typeof arg) {
        case 'string':
            return `'${arg}'`;
        case 'function':
            return arg.toString().replaceAll(/{[\s\S]+}/gm, '{/*...*/}');
        default:
            if (Array.isArray(arg)) {
                return `[${arg.map(r => this._toShortString(r))}]`;
            }
            return arg;
        }
    }
}();
