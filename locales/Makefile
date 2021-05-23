LOCALE_NAMES := $(basename $(wildcard *.po))
LOCALE_FILES := $(addsuffix /LC_MESSAGES/$(DOMAIN).mo, $(LOCALE_NAMES))

MSGFMT ?= msgfmt
XGETTEXT ?= xgettext --join-existing
MSGMERGE ?= msgmerge --update --previous

.PHONY : build install

ifneq ($(LOCALE_NAMES),)
build : messages.pot $(addprefix $(BUILD_DIR)/, $(LOCALE_FILES))
install : $(addprefix $(INSTALL_DIR)/, $(LOCALE_FILES))
endif

messages.pot : $(wildcard ../sources/*.js) $(wildcard ../ui/*.ui)
	$(eval TEMP_POT := $(shell mktemp "XXXXXXX.diff.pot"))
	$(XGETTEXT) --language=JavaScript  ../sources/*.js --output='$(TEMP_POT)'
	$(XGETTEXT) --language=Glade ../ui/*.ui --output='$(TEMP_POT)'
	$(MSGMERGE) messages.pot '$(TEMP_POT)'
	for po in *.po; do $(MSGMERGE) $$po messages.pot; done
	rm '$(TEMP_POT)'

%.po : messages.pot
	$(MSGMERGE) '$@' messages.pot

$(BUILD_DIR)/%/LC_MESSAGES/$(DOMAIN).mo : %.po
	test -n '$(DOMAIN)'
	test -n '$(BUILD_DIR)' && mkdir -p '$(BUILD_DIR)/$*/LC_MESSAGES/'
	$(MSGFMT) -o '$@' '$^'

$(INSTALL_DIR)/%/LC_MESSAGES/$(DOMAIN).mo : $(BUILD_DIR)/%/LC_MESSAGES/$(DOMAIN).mo
	test -n '$(DOMAIN)'install
	test -n '$(BUILD_DIR)'
	test -n '$(INSTALL_DIR)' && mkdir -p '$(INSTALL_DIR)/$*/LC_MESSAGES/'
	cp '$^' '$@'
