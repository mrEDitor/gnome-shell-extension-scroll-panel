#!/usr/bin/env gjs
imports.gi.versions.Gtk = '4.0';
const { Gio, GLib, GObject, Gtk } = imports.gi;

const UiPreview = GObject.registerClass(
class UiPreview extends Gtk.Application {
    vfunc_startup() {
        super.vfunc_startup();
        const dir = Gio.File.new_for_path(GLib.getenv('BUILD_DIR'));
        const [, metadataJSON] = GLib.file_get_contents(
            dir.get_child('metadata.json').get_path()
        );
        const metadata = JSON.parse(metadataJSON);
        const extensionMock = { imports, metadata, dir };
        const uiBuilder = new imports[GLib.getenv('UI')].UiBuilder(extensionMock);
        this.appWindow = new Gtk.ApplicationWindow({
            application: this,
            child: uiBuilder.bindDemo(),
            title: GLib.getenv('UI_TITLE') ?? `${GLib.getenv('UI')}.ui`,
        });
    }

    vfunc_activate() {
        super.vfunc_activate();
        this.appWindow.present();
    }
});

const app = new UiPreview();
app.run([]);
