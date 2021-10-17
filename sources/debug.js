/* exported module */
// noinspection JSUnfilteredForInLoop
// This module is for debug purposes only and may use some hacks. It's content
// is expected to be erased from release build and should be used only inside
// try-catch blocks or with null coalescing operators.

const Me = imports.misc.extensionUtils.getCurrentExtension();

/**
 * Debug class module.
 */
var module = new class DebugModule {
    /**
     * Log verbose message.
     *
     * @param {string} message - Message to log.
     */
    logDebug(message) {
        log(`[${Me.metadata.uuid}][DBG] ${message}`);
    }

    /**
     * Add verbose step-in/step-out log messages to each method of module.
     *
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
         *
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
            try {
                const moduleInstance = modules[moduleName];
                for (const symbolName in moduleInstance) {
                    switch (typeof moduleInstance[symbolName]) {
                    case 'function':
                        this.injectConstructorTraceLogs(modules, moduleName, symbolName);
                        break;
                    case 'object':
                        this.injectObjectTraceLogs(moduleInstance[symbolName], moduleName, symbolName);
                        break;
                    }
                }
            } catch (e) {
                log(`[${Me.metadata.uuid}][STP] Loading module '${moduleName}' problem:\n${e}`);
            }
        }
    }

    /**
     * Wrap object constructor (`modules`[`moduleName`][`symbolName`]) way to
     * add verbose step-in/step-out log messages to each method of object
     * instance creating.
     *
     * @param {object} modules - Modules accessor.
     * @param {string} moduleName - Module name.
     * @param {string} symbolName - Object name.
     */
    injectConstructorTraceLogs(modules, moduleName, symbolName) {
        const constructor = modules[moduleName][symbolName];
        if (typeof constructor !== 'function' || constructor.objectTraceLogger) {
            return;
        }
        const debug = this;
        log(`[${Me.metadata.uuid}][STP] Symbol '${symbolName}' found in module '${moduleName}', patching constructor...`);
        modules[moduleName][symbolName] = function (...args) {
            if (new.target) {
                const instance = new constructor(...args);
                debug.injectObjectTraceLogs(instance, moduleName, symbolName);
                return instance;
            } else {
                // Plain functions are considered simple helpers.
                return constructor(...args);
            }
        };
        modules[moduleName][symbolName].objectTraceLogger = this;
    }

    /**
     * Add verbose step-in/step-out log messages to each method of object
     * instance.
     *
     * @param {object} instance - Object to add methods tracing to.
     * @param {string} moduleName - Module name.
     * @param {string} symbolName - Object name.
     */
    injectObjectTraceLogs(instance, moduleName, symbolName) {
        log(`[${Me.metadata.uuid}][STP] Instance of class '${symbolName}' from module '${moduleName}' spawned, patching...`);
        if (instance === this) {
            return;
        }
        const memberNames = Object.getOwnPropertyNames(
            Object.getPrototypeOf(instance)
        );
        for (const memberName of memberNames) {
            const member = instance[memberName];
            if (typeof member !== 'function' || member.objectTraceLogger) {
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
            instance[memberName].objectTraceLogger = this;
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
