/* exported PrefsCompanion */

const {Clutter, Cogl, GObject, St} = imports.gi;
const {main: Main} = imports.ui;
const Me = imports.misc.extensionUtils.getCurrentExtension();

/**
 * Log prefs warning message.
 *
 * @param {string} message - Message to log.
 */
function _logWarning(message) {
    log(`[${Me.metadata.uuid}][WRN] ${message}`);
}

/**
 * Red border highlight effect for {@link Clutter} actors.
 * Based on Gnome Shell Looking Glass, you can find it at
 * {@link https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/42.0/js/ui/lookingGlass.js}
 *
 * @type {ActorPicker.prototype.constructor}
 */
const ActorPicker = GObject.registerClass(
    class ActorPicker extends Clutter.Effect {
        _init() {
            super._init();

            /** @type {Cogl.Pipeline} */
            this._pipeline = null;

            /** @type {Clutter.Actor|null} */
            this._targetActor = null;
        }

        get targetActor() {
            return this._targetActor;
        }

        set targetActor(actor) {
            if (this._targetActor) {
                this._targetActor.remove_effect(this);
            }

            this._targetActor = actor;

            if (actor) {
                actor.add_effect(this);
                this._pipeline = null;
            }
        }

        vfunc_paint(node, paintContext) {
            const actor = this.get_actor();
            const actorNode = new Clutter.ActorNode(actor, -1);
            node.add_child(actorNode);

            if (!this._pipeline) {
                const framebuffer = paintContext.get_framebuffer();
                const coglContext = framebuffer.get_context();
                const color = new Cogl.Color();
                if (!this._targetActor.reactive) {
                    color.init_from_4ub(0xFF, 0xFF, 0, 0xC4); // yellow
                } else {
                    color.init_from_4ub(0, 0xFF, 0, 0xC4); // green
                }

                this._pipeline = new Cogl.Pipeline(coglContext);
                this._pipeline.set_color(color);
            }

            const width = 2;
            const box = new Clutter.ActorBox();
            const alloc = actor.get_allocation_box();
            const pipelineNode = new Clutter.PipelineNode(this._pipeline);
            pipelineNode.set_name('Scroll Panel Picker Highlight');
            node.add_child(pipelineNode);

            // clockwise order
            box.set_origin(0, 0);
            box.set_size(alloc.get_width(), width);
            pipelineNode.add_rectangle(box);

            box.set_origin(alloc.get_width() - width, width);
            box.set_size(width, alloc.get_height());
            pipelineNode.add_rectangle(box);

            box.set_origin(0, alloc.get_height() - width);
            box.set_size(alloc.get_width() - width, width);
            pipelineNode.add_rectangle(box);

            box.set_origin(0, width);
            box.set_size(width, alloc.get_height() - width);
            pipelineNode.add_rectangle(box);
        }
    }
);

/**
 * Prefs widget shell-space companion.
 * Used for interaction of prefs widget with Gnome Shell scene elements.
 */
var PrefsCompanion = class _PrefsCompanion {
    /**
     * @param {_PrefsSource} prefsSource - Prefs source instance to use.
     */
    constructor(prefsSource) {
        this._prefsSource = prefsSource;
        this._actorPicker = new ActorPicker();

        const seat = Clutter.get_default_backend().get_default_seat();
        this._pointerDevice = seat.get_pointer();

        this._eventHandler = new St.BoxLayout({reactive: true});
        Main.uiGroup.add_actor(this._eventHandler);
        this._eventHandler.connect('button-press-event', () => {
            this._onActorPicked();
        });
        this._eventHandler.connect('motion-event', (source, event) => {
            this._targetActorOrKeepParent(event.get_source());
        });
        this._eventHandler.connect('scroll-event', (source, event) => {
            this._retargetByEvent(event);
        });
    }

    /**
     * Get path for an actor in stage view tree.
     *
     * @param {Clutter.Actor} actor - Actor to get path for.
     * @returns {string[]} - Actor path.
     */
    getActorPath(actor) {
        /** @type {string[]} */
        const path = [];
        while (actor && actor !== global.stage) {
            let name = actor.name;
            if (!name) {
                name = actor.get_parent().get_children().indexOf(actor);
            }
            path.unshift(name.toString());
            actor = actor.get_parent();
        }
        return path;
    }

    /**
     * Find an actor by path in stage view tree. Returns null for empty path.
     *
     * @param {string[]} path - Path of actor to find.
     * @returns {Clutter.Actor|null} - Demanded actor, if found.
     */
    findActor(path) {
        if (!path.length) {
            return null;
        }

        let target = global.stage;
        for (const name of path) {
            const index = parseInt(name);
            if (isNaN(index)) {
                target = target.get_children().find(c => c.name === name);
            } else {
                target = target.get_child_at_index(index);
            }
            if (!target) {
                return null;
            }
        }
        return target;
    }

    /**
     * Run prefs widget shell-space companion.
     *
     * @returns {function()} Companion stop callback.
     */
    run() {
        this._prefsSource.highlightPath.value = [];
        this._prefsSource.pickingActorPathAction.value = '';
        const cancelHighlight = this._prefsSource.highlightPath.onChange(
            this._onHighlightPathChange.bind(this)
        );
        const cancelPicker = this._prefsSource.pickingActorPathAction.onChange(
            this._onPickingActorPathActionChange.bind(this)
        );
        return () => {
            cancelHighlight();
            cancelPicker();
        };
    }


    /**
     * @param {Clutter.Actor} actor - Actor to target.
     */
    _targetActorOrKeepParent(actor) {
        let target = actor;
        while (target && target !== this._actorPicker.targetActor) {
            target = target.get_parent();
        }
        if (!target) {
            this._targetActor(actor);
        }
    }

    /**
     * @param {Clutter.ScrollEvent} event - Event to target by.
     */
    _retargetByEvent(event) {
        /** @type {Clutter.Actor} */
        let newTarget = event.get_source();
        const currentTarget = this._actorPicker.targetActor;
        if (!currentTarget) {
            _logWarning('Actor picker received ScrollEvent, but no target actor set.');
            this._targetActor(newTarget);
            return;
        }

        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
            if (currentTarget.get_parent() !== global.stage) {
                this._targetActor(currentTarget.get_parent());
            }
            return;
        case Clutter.ScrollDirection.DOWN:
            if (newTarget !== currentTarget) {
                while (newTarget && newTarget.get_parent() !== currentTarget) {
                    newTarget = newTarget.get_parent();
                }
                if (newTarget) {
                    this._targetActor(newTarget);
                }
            }
        }
    }

    /**
     * @param {Clutter.Actor} actor - Actor to target.
     */
    _targetActor(actor) {
        // will call `this._onHighlightPath` automatically
        this._prefsSource.highlightPath.value = this.getActorPath(actor);
    }

    /**
     * @param {string} key - Source setting key.
     * @param {string[]} actorPath - Actor path along the view tree.
     */
    _onHighlightPathChange(key, actorPath) {
        this._actorPicker.targetActor = this.findActor(actorPath);
    }

    /**
     * @param {string} key - Source setting key.
     * @param {string} settingToPickPathFor - Key of setting to fill with picked
     * actor path (of type {@link string[]}).
     */
    _onPickingActorPathActionChange(key, settingToPickPathFor) {
        if (settingToPickPathFor) {
            this._startPickingActor();
        } else {
            this._stopPickingActor();
        }
    }

    _startPickingActor() {
        try {
            // Since Gnome 42
            this._grab = global.stage.grab(this._eventHandler);
        } catch {
            this._pointerDevice.grab(this._eventHandler);
        }
    }

    _onActorPicked() {
        const action = this._prefsSource.pickingActorPathAction.value;
        this._prefsSource.switcherActorPath(action).value =
            this.getActorPath(this._actorPicker.targetActor);
        this._prefsSource.pickingActorPathAction.value = '';
    }

    _stopPickingActor() {
        if (this._grab) {
            // since Gnome 42
            this._grab.dismiss();
        } else if (this._pointerDevice.ungrab) {
            this._pointerDevice.ungrab();
        }

        this._prefsSource.highlightPath.value = [];
    }
};
