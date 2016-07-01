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
endef
export HELP

all:
	PREFIX=$(PREFIX)/$(UUID) $(MAKE) -C $(UUID) all

clean:
	PREFIX=$(PREFIX)/$(UUID) $(MAKE) -C $(UUID) clear

install:
	PREFIX=$(PREFIX)/$(UUID) $(MAKE) -C $(UUID) install

help:
	@echo "$$HELP"
