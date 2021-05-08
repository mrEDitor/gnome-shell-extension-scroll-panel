export DOMAIN ?= io.github.mreditor.gnome-shell-extensions.scroll-panel
BUILD_DIR ?= build
INSTALL_DIR ?= $(HOME)/.local/share/gnome-shell/extensions

BUILD_DIR := $(abspath $(BUILD_DIR))
INSTALL_DIR := $(abspath $(INSTALL_DIR))

define HELP
Usage (with `: dependencies` according to make syntax):
	help :
		- Show this message.
	all : lint build zip
		- Build every artifact of the extension inside `BUILD_DIR`; does NOT run
		`install` or `uninstall` targets.
	build :
		- Build the extension inside `BUILD_DIR`.
	lint : eslintrc-gjs.yml eslintrc-shell.yml
		- Run linter on project files. Required config files will be downloaded
		from https://gitlab.gnome.org/GNOME/gnome-shell-extensions/ if missed.
	install : build uninstall
		- Install the built extension from `BUILD_DIR` to `INSTALL_DIR`. Since
		dependency on `build`, set `DEBUG=1` if debug version is required.
	uninstall : build
		- Delete files from `INSTALL_DIR`, if they are similar to built ones. If
		you want to remove files despite are they similar to built ones or not,
		pass the `FORCE=1` flag.
	zip : build
		- Pack the extension to a ZIP archive (in `BUILD_DIR`) which is expected
		for publishing at https://extensions.gnome.org.

Variables:
	DOMAIN = $(DOMAIN)
		- Extension unique namespace.
	BUILD_DIR = $(BUILD_DIR)
		- Target directory for all targets.
	INSTALL_DIR = $(INSTALL_DIR)
		- Gnome Shell extensions directory to use during `install` and
		`uninstall`. To install extension globally, you can use
		`/usr/share/gnome-shell/extensions` on most systems.
	FORCE = $(FORCE)
		- If set, `uninstall` target will delete non-similar files keeping diff
		in standard output. Intended to be used for uninstalling or upgrading
		extension when not having source code of installed version.
	DEBUG = $(DEBUG)
		- If set, `build` target will include the debug module.
endef
export HELP

.PHONY : help all build lint install uninstall zip

help :
	@echo "$$HELP"

all : clean build lint zip

clean :
	rm -rf '$(BUILD_DIR)'
	mkdir -p '$(BUILD_DIR)'

build :
	test -n '$(DOMAIN)'
	mkdir -p '$(BUILD_DIR)'
	$(MAKE) -C sources build BUILD_DIR='$(BUILD_DIR)'
	$(MAKE) -C locales build BUILD_DIR='$(BUILD_DIR)/locale'
	$(MAKE) -C schemas build BUILD_DIR='$(BUILD_DIR)/schemas'
	$(MAKE) -C ui build BUILD_DIR='$(BUILD_DIR)'

lint : eslintrc-gjs.yml eslintrc-shell.yml
	eslint --ignore-pattern '$(BUILD_DIR)' .
	$(MAKE) -C ui lint BUILD_DIR='$(BUILD_DIR)'

install : build uninstall
	test -n '$(BUILD_DIR)'
	mkdir -p '$(INSTALL_DIR)'
	$(MAKE) -C sources install BUILD_DIR='$(BUILD_DIR)' INSTALL_DIR='$(INSTALL_DIR)/$(DOMAIN)'
	$(MAKE) -C locales install BUILD_DIR='$(BUILD_DIR)/locale' INSTALL_DIR='$(INSTALL_DIR)/$(DOMAIN)/locale'
	$(MAKE) -C schemas install BUILD_DIR='$(BUILD_DIR)/schemas' INSTALL_DIR='$(INSTALL_DIR)/$(DOMAIN)/schemas'
	$(MAKE) -C ui install BUILD_DIR='$(BUILD_DIR)' INSTALL_DIR='$(INSTALL_DIR)/$(DOMAIN)'

uninstall :
	test -n '$(DOMAIN)'
	test -n '$(BUILD_DIR)'
	test -n '$(INSTALL_DIR)'
ifneq ($(wildcard $(INSTALL_DIR)/$(DOMAIN)/),)
	$(eval TEMP_DIR := $(shell mktemp -d))
	$(MAKE) install BUILD_DIR='$(TEMP_DIR)' INSTALL_DIR='$(TEMP_DIR)/INSTALL_DIR'
ifeq ($(FORCE),)
	# Marking changed files as out-of-package:
	cd '$(INSTALL_DIR)/$(DOMAIN)' && find . -type f -exec sh -c '\
		cmp "$(INSTALL_DIR)/$(DOMAIN)/$$1" "$(TEMP_DIR)/INSTALL_DIR/$(DOMAIN)/$$1" && \
		rm "$(INSTALL_DIR)/$(DOMAIN)/$$1" || true ; \
		' sh {} \;
else
	# Generating changed files diff before deletion:
	cd '$(INSTALL_DIR)/$(DOMAIN)' && find . -type f -exec sh -c '\
		diff -uN "$(INSTALL_DIR)/$(DOMAIN)/$$1" "$(TEMP_DIR)/INSTALL_DIR/$(DOMAIN)/$$1" ; \
		rm "$(INSTALL_DIR)/$(DOMAIN)/$$1" || true ; \
		' sh {} \;
endif
	find '$(INSTALL_DIR)/$(DOMAIN)' -type d -empty -delete
	test -d '$(INSTALL_DIR)/$(DOMAIN)' \
		&& echo 'Protected and out-of-package files left untouched:' 1>&2 \
		&& tree '$(INSTALL_DIR)/$(DOMAIN)' 1>&2 \
		|| true
	rm -r '$(TEMP_DIR)'
endif

zip : $(BUILD_DIR)/$(DOMAIN).zip

eslintrc-gjs.yml :
	wget https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/raw/master/lint/eslintrc-gjs.yml

eslintrc-shell.yml :
	wget https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/raw/master/lint/eslintrc-shell.yml

$(BUILD_DIR)/$(DOMAIN).zip : build
	test -n '$(DOMAIN)'
	test -n '$(BUILD_DIR)'
	$(eval TEMP_DIR := $(shell mktemp -d))
	$(MAKE) install BUILD_DIR='$(BUILD_DIR)' INSTALL_DIR='$(TEMP_DIR)'
	cd '$(TEMP_DIR)/$(DOMAIN)' && zip -r '$(BUILD_DIR)/$(DOMAIN).zip' *
	rm -r '$(TEMP_DIR)'
