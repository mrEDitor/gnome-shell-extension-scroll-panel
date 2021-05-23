export UI ?=
PREVIEW ?=

export SEED := $(shell cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
UI_FILES := $(wildcard *.ui)

GJS ?= gjs
GTK_VALIDATE ?= gtk4-builder-tool validate
SCREENSHOT ?= import -trim

.PHONY: build install lint pngs preview

ifneq ($(UI_FILES),)
build : $(addprefix $(BUILD_DIR)/, $(UI_FILES))
install : $(addprefix $(INSTALL_DIR)/, $(UI_FILES))
endif

lint :
	$(foreach UI_FILE, $(UI_FILES), \
		$(GTK_VALIDATE) '$(UI_FILE)' ;\
	)

preview : build
	test -n '$(UI)'
	$(GJS) --include-path ../sources/ --module previewUi.js

pngs : $(addsuffix .png, $(UI_FILES))

%.ui.png : %.ui ../sources/%.js ../schemas/$(DOMAIN).gschema.xml
	# Runs `gjs <...>` in background and kills it after last sub-command is done.
	UI_TITLE='$(SEED)' UI='$*' $(GJS) --include-path ../sources/ --module previewUi.js &\
		trap "trap - SIGTERM && kill -- $$!" SIGINT SIGTERM EXIT ;\
		sleep 1.5s ;\
		$(SCREENSHOT) -window '$(SEED)' '$@'

$(BUILD_DIR)/%.ui : %.ui
	mkdir -p '$(BUILD_DIR)'
	cp '$*.ui' '$@'

$(INSTALL_DIR)/%.ui : $(BUILD_DIR)/%.ui
	test -n '$(BUILD_DIR)'
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'
