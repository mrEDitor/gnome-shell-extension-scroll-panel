/**
 * Gnome Scroll Panel (Gnome Shell extension)
 * Copycenter (C) 2015 Edward Minasyan <mrEDitor@mail.ru>
 * https://github.com/mrEDitor/gnome-scroll-panel
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;

let actors = [];
let handles = [];

function enable() {
    let i, j, list;
    list = Main.panel._leftBox.get_children();
    for (i = 0; i < list.length; i++)
        handles[i] = (actors[i] = list[i].get_first_child()).connect("scroll-event",
            function (actor, event) {
                let active = [-1, -1, -1];
                let windows = global.display.get_tab_list(Meta.TabList.NORMAL, global.screen.get_active_workspace());
                for (j = 0; j < windows.length; j++)
                    if (windows[j].has_focus())
                        active[0] = windows[j].get_stable_sequence();
                switch (event.get_scroll_direction()) {
                case Clutter.ScrollDirection.UP:
                    for (j = 0; j < windows.length; j++)
                        if (active[0] < windows[j].get_stable_sequence() && (active[1] > windows[j].get_stable_sequence() || active[1] == -1)) {
                            active[1] = windows[j].get_stable_sequence();
                            active[2] = j;
                        }
                    break;
                case Clutter.ScrollDirection.DOWN:
                    for (j = 0; j < windows.length; j++)
                        if (active[0] > windows[j].get_stable_sequence() && (active[1] < windows[j].get_stable_sequence() || active[1] == -1)) {
                            active[1] = windows[j].get_stable_sequence();
                            active[2] = j;
                        }
                    break;
                }
                if (active[2] != -1)
                    windows[active[2]].activate(global.get_current_time());
            });
    list = Main.panel._centerBox.get_children();
    for (j = 0; j < list.length; j++)
        handles[i + j] = (actors[i + j] = list[j].get_first_child()).connect("scroll-event",
            function (actor, event) {
                let index = global.screen.get_active_workspace_index();
                switch (event.get_scroll_direction()) {
                case Clutter.ScrollDirection.UP:
                    if (index > 0)
                        global.screen.get_workspace_by_index(index - 1).activate(global.get_current_time());
                    break;
                case Clutter.ScrollDirection.DOWN:
                    if (index + 1 < global.screen.n_workspaces)
                        global.screen.get_workspace_by_index(index + 1).activate(global.get_current_time());
                    break;
                }
            });
}

function disable() {
    for (let i = 0; i < handles.length; i++) {
        actors[i].disconnect(handles[i]);
    }
    handles = [];
}
