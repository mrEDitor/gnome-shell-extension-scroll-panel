Scroll Panel
=====


Gnome Shell Extension
-----
Scroll above an application's title to switch between windows on the active
workspace, and above the clock to switch between virtual workspaces.

Note: to use the touchpad, you probably have to configure its sensitivity in
the extension settings.

Get it from [extensions.gnome.org](https://extensions.gnome.org/extension/932/).



License and contributors
-----
This software is distributing under MIT (X11) license, provided "as is" and
without warranty of any kind. You can take a look at [LICENSE](LICENSE) file.



Build
-----
1. Clone source code from GitHub:

		git clone https://github.com/mrEDitor/gnome-shell-extension-scroll-panel
		cd gnome-shell-extension-scroll-panel
	
2. Build it with Makefile:

		make
	
3. Install extension into your Gnome Shell:

		make install

4. Enable and configure extension with

		gnome-shell-extension-prefs



How to localize
-----
Localization files are located inside
[```locale```](./scroll-panel@mreditor.github.com/locale) directory.
There you can see `messages.pot`, an template file to generate .po-translations.
You should open it, e.g. with GTranslator or POEdit, translate text and save
resulting .po-file in the same directory with corresponding to its locale name,
like `en_US.po`. Then go back to project root and build whole project with
`make` and perhaps install it with `make install`. Then, if you are going to
commit your changes don't forget to `make clean` generated binaries.

And feel free to submit translations to upstream on GitHub, I'll appreciate it!

Bug reports and features requests
-----
- <https://github.com/mrEDitor/gnome-shell-extension-scroll-panel/>
