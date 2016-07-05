DOMAIN ?= scroll-panel
PREFIX ?= ~/.local/share/gnome-shell/extensions
UUID ?= scroll-panel@mreditor.github.com
MAKE ?= make
CLEAN ?= rm -f

define HELP
Usage:
	help - show this message
	all - build the extension
	clean - remove built files
	install - install built files
		uses PREFIX=$(PREFIX)
	uninstall - uninstall old files
		uses PREFIX=$(PREFIX)
endef
export HELP

all:
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/$(UUID) $(MAKE) -C $(UUID) all

clean:
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/$(UUID) $(MAKE) -C $(UUID) clean

install: all uninstall
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/$(UUID) $(MAKE) -C $(UUID) install

uninstall:
	-rm -r $(PREFIX)/$(UUID)

help:
	@echo "$$HELP"
