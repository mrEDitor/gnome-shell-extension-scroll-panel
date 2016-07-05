DOMAIN ?=
PREFIX ?=
MSGFMT ?= msgfmt
MSGMERGE ?= msgmerge
XGETTEXT ?= xgettext
MAKE ?= make
CLEAN ?= rm -f

PO_FILES = $(wildcard *.po)
MO_FILES = $(PO_FILES:.po=.mo)
SUBDIRS = $(PO_FILES:.po=)

all: $(MO_FILES)

clean:
	-rm -r ./*/

template:
	$(XGETTEXT) --keyword=_ ../*.js ../ui/*.ui --output=diff.pot
	$(MSGMERGE) --update messages.pot diff.pot
	rm diff.pot

%.po: template
	$(MSGMERGE) --update $@ messages.pot

%.mo: %.po
	mkdir -p ./$*/LC_MESSAGES/
	$(MSGFMT) $< -o ./$*/LC_MESSAGES/$(DOMAIN).mo

install: all
	mkdir $(PREFIX)
	cp -r $(SUBDIRS) $(PREFIX)
