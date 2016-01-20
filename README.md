# Gnome Scroll Panel
##### Gnome Shell extension (3.14 - 3.18 versions are supported)

Scroll above an application's title to switch between windows on the active workspace, and above the clock to switch between virtual workspaces.



#### Get the extension

* Git repository: <https://github.com/mrEDitor/gnome-scroll-panel/>
* Gnome Extension Store: <https://extensions.gnome.org/extension/932/scroll-panel/>



#### Apache 2.0 License

	Copyright 2016 Edward Minasyan <mrEDitor@mail.ru>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at
	
		http://www.apache.org/licenses/LICENSE-2.0
		
	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.

Also the full text of the License is available in ./LICENSE file.



#### Installation from Gnome Extension Store

Visit <https://extensions.gnome.org/extension/932/scroll-panel/> via [Mozilla Firefox](<https://www.mozilla.org/ru/firefox/>) or another browser with Gnome Shell integration plugin.



#### Manual installation

0. Get source code:
	* Download and unpack archive with [latest release](https://github.com/mreditor/gnome-scroll-panel/releases/latest/);
	* Or clone repository with git: `git clone https://github.com/mreditor/gnome-scroll-panel.git`.
 
1. Open received directory: `cd gnome-scroll-panel`.

2. Copy subdirectory `scroll-panel@mreditor.github.com` to 
	* `~/.local/share/gnome-shell/extensions/` to install for current user only;
	* `/usr/share/gnome-shell/extensions/` to install for all users in system.

	E.g. `cp -r gnome-scroll-panel@mreditor.github.com ~/.local/share/gnome-shell/extensions/`;

3. Enable extension: `gnome-shell-extension-tool -e scroll-panel@mreditor.github.com`.



##### Last change: 20 Jan 2016
##### Copyright © 2016 Edward Minasyan <mrEDitor@mail.ru>
