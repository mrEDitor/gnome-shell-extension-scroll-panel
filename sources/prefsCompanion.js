/* exported module */

const { Clutter, Cogl, GObject, St } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();

/** @type {PrefsSourceModule} */
const PrefsSource = Me.imports.prefsSource.module;

function _logWarning(message) {
    log(`[${Me.metadata.uuid}][WRN] ${message}`);
}

/**
 * Red border highlight effect for {@link Clutter} actors.
 * Based on Gnome Shell Looking Glass, you can find it at
 * {@link https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/master/js/ui/lookingGlass.js}
 * @type {ActorPicker.prototype.constructor}
 * @param {function(Clutter.Actor)} onPicked - Callback for pick completion.
 * Receives resulting actor as argument.
 */
const ActorPicker = GObject.registerClass(
    class ActorPicker extends Clutter.Effect {
        _init(onPicked) {
            super._init();
            try {
                /** @type {DebugModule} */
                const Debug = Me.imports.debug.module;
                Debug.injectObjectTraceLogs(this, 'prefsCompanion', 'ActorPicker');
            } catch {
                // Debug module is optional.
            }

            /** @type {function(Clutter.Actor)} */
            this._onPicked = onPicked;

            /** @type {Cogl.Pipeline} */
            this._pipeline = null;

            /** @type {Clutter.Actor|null} */
            this._targetActor = null;

            const seat = Clutter.get_default_backend().get_default_seat();
            this._pointerDevice = seat.get_pointer();

            this._eventHandler = new St.BoxLayout({ reactive: true });
            this._eventHandler.connect(
                'button-press-event',
                () => this._onPicked(this._targetActor)
            );
            this._eventHandler.connect(
                'motion-event',
                (source, event) => this._targetActorOrKeepParent(event.get_source())
            );
            this._eventHandler.connect(
                'scroll-event',
                (source, event) => this._retargetByEvent(event)
            );
        }

        /**
         * Target the actor or keep current one if it's parent of new one.
         * @param {Clutter.Actor} actor - Actor to target.
         */
        _targetActorOrKeepParent(actor) {
            let target = actor;
            while (target && target !== this._targetActor) {
                target = target.get_parent();
            }
            if (target !== this._targetActor) {
                this.targetActor(actor);
            }
        }

        /**
         * @param {Clutter.ScrollEvent} event - Event to target by.
         */
        _retargetByEvent(event) {
            let target = event.get_source();
            if (!this._targetActor) {
                _logWarning('Actor picker received ScrollEvent, but no target actor set.');
                this.targetActor(target);
                return;
            }

            switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
                if (this._targetActor.get_parent()) {
                    this.targetActor(this._targetActor.get_parent());
                }
                return;
            case Clutter.ScrollDirection.DOWN:
                if (target !== this._targetActor) {
                    while (target && target.get_parent() !== this._targetActor) {
                        target = target.get_parent();
                    }
                    this.targetActor(target);
                }
            }
        }

        /**
         * Highlight new target actor.
         * @param {Clutter.Actor} actor - Actor to highlight.
         */
        targetActor(actor) {
            if (this._targetActor) {
                this._targetActor.remove_effect(this);
            }

            this._targetActor = actor;

            if (actor) {
                actor.add_effect(this);
            }
        }

        /**
         * Pick actor with mouse.
         */
        startPickingActor() {
            this._pointerDevice.grab(this._eventHandler);
        }

        /**
         * Pick actor with mouse.
         */
        cancelPickingActor() {
            this._pointerDevice.ungrab();
            this.targetActor(null);
        }

        vfunc_paint(node, paintContext) {
            let actor = this.get_actor();

            const actorNode = new Clutter.ActorNode(actor, -1);
            node.add_child(actorNode);

            if (!this._pipeline) {
                const framebuffer = paintContext.get_framebuffer();
                const coglContext = framebuffer.get_context();

                let color = new Cogl.Color();
                color.init_from_4ub(0xff, 0, 0, 0xc4);

                this._pipeline = new Cogl.Pipeline(coglContext);
                this._pipeline.set_color(color);
            }

            let alloc = actor.get_allocation_box();
            let width = 2;

            const pipelineNode = new Clutter.PipelineNode(this._pipeline);
            pipelineNode.set_name('Red Border');
            node.add_child(pipelineNode);

            const box = new Clutter.ActorBox();

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
 * @type {PrefsCompanionModule}
 */
var module = new class PrefsCompanionModule {
    constructor() {
        this._actorPicker = new ActorPicker(this._onActorPicked.bind(this));
    }

    /**
     * Get path for an actor in stage view tree.
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
     * @returns {function()} Companion stop callback.
     */
    run() {
        const cancelHighlight = PrefsSource.highlightPath.onChange(
            this._onHighlightPath.bind(this)
        );
        const cancelPicker = PrefsSource.pickPathKey.onChange(
            this._onPickPathKey.bind(this)
        );
        return () => {
            cancelHighlight();
            cancelPicker();
        };
    }

    _onHighlightPath(key, actorPath) {
        if (!PrefsSource.pickPathKey.value.length) {
            this._actorPicker.targetActor(this.findActor(actorPath));
        }
    }

    _onPickPathKey(key, settingToPickPathFor) {
        if (settingToPickPathFor) {
            this._actorPicker.startPickingActor();
        } else {
            this._actorPicker.cancelPickingActor();
        }
    }

    _onActorPicked(actor) {
        PrefsSource.setStringArray(
            PrefsSource.pickPathKey.value,
            this.getActorPath(actor)
        );
        PrefsSource.pickPathKey.setValue('');
        this._actorPicker.cancelPickingActor();
    }
}();
