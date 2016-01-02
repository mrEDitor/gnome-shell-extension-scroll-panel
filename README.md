# Gnome Scroll Panel
### Gnome Shell extension (works since Gnome Shell 3.14)
##### *Source code: <https://github.com/mrEDitor/gnome-scroll-panel/>*
##### *Gnome Extension Store: <https://extensions.gnome.org/extension/932/scroll-panel/>*
*Enables switching workspaces and applications in Gnome Shell just by scrolling a mousewheel above a corresponding title on the top panel.*

Scroll above an application's title to switch between windows on the active workspace, and above the clock to switch between virtual workspaces.

##### GNU GPL v3
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <http://www.gnu.org/licenses/>.


##### Installation
0. Get source code:
   * Download and unpack archive with [latest release](https://github.com/mreditor/gnome-scroll-panel/releases/latest/);
   * Or clone repository `git clone https://github.com/mreditor/gnome-scroll-panel.git`.
1. Open received directory: `cd gnome-scroll-panel`.
2. Copy subdirectory `gnome-scroll-panel@mreditor.github.com` to `~/.local/share/gnome-shell/extensions/`:
   * You can use shell command like `cp -r gnome-scroll-panel@mreditor.github.com ~/.local/share/gnome-shell/extensions/`;
   * You can do it with any file manager;
   * If you want install extension for all users in system, you should copy it to `/usr/share/gnome-shell/extensions/` instead of local directory.
3. Enable extension with one of:
   * GUI `gnome-shell-extension-prefs`;
   * GUI `gnome-tweak-tool`;
   * `gnome-shell-extension-tool -e gnome-scroll-panel@mreditor.github.com`.

##### Last change: 2 Jan 2016
##### Copyright © 2016 Edward Minasyan [<mrEDitor@mail.ru>]
