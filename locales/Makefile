LOCALE_NAMES := $(basename $(wildcard *.po))
LOCALE_FILES := $(addsuffix /LC_MESSAGES/$(DOMAIN).mo, $(LOCALE_NAMES))

.PHONY : build install

ifneq ($(LOCALE_NAMES),)
build : messages.pot $(addprefix $(BUILD_DIR)/, $(LOCALE_FILES))
install : $(addprefix $(INSTALL_DIR)/, $(LOCALE_FILES))
endif

messages.pot : $(wildcard ../sources/*.js) $(wildcard ../sources/*.json) $(wildcard ../ui/*.ui)
	$(eval TEMP_POT := $(shell mktemp "XXXXXXX.diff.pot"))
	xgettext --language=JavaScript ../sources/*.json --join-existing --output='$(TEMP_POT)'
	xgettext --language=JavaScript --keyword=gettext  ../sources/*.js --join-existing --output='$(TEMP_POT)'
	xgettext --language=Glade ../ui/*.ui --join-existing --output='$(TEMP_POT)'
	for po in *.po; do echo msgmerge --update --previous $$po messages.pot; done
	rm '$(TEMP_POT)'

%.po : messages.pot
	msgmerge --update '$@' messages.pot

$(BUILD_DIR)/%/LC_MESSAGES/$(DOMAIN).mo : %.po
	test -n '$(DOMAIN)'
	test -n '$(BUILD_DIR)' && mkdir -p '$(BUILD_DIR)/$*/LC_MESSAGES/'
	msgfmt -o '$@' '$^'

$(INSTALL_DIR)/%/LC_MESSAGES/$(DOMAIN).mo : $(BUILD_DIR)/%/LC_MESSAGES/$(DOMAIN).mo
	test -n '$(DOMAIN)'install
	test -n '$(BUILD_DIR)'
	test -n '$(INSTALL_DIR)' && mkdir -p '$(INSTALL_DIR)/$*/LC_MESSAGES/'
	cp '$^' '$@'
