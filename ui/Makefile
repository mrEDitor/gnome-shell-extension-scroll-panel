UI_FILES := $(wildcard *.ui)

.PHONY: build install lint preview

ifneq ($(UI_FILES),)
build : $(addprefix $(BUILD_DIR)/, $(UI_FILES))
install : $(addprefix $(INSTALL_DIR)/, $(UI_FILES))
endif

lint :
	$(foreach UI_FILE, $(UI_FILES), \
		gtk4-builder-tool validate '$(UI_FILE)' ;\
	)

preview :
	test -n '$(UI)'
	gjs --include-path ../sources/ --module previewUi.js

$(BUILD_DIR)/%.ui : %.ui
	mkdir -p '$(BUILD_DIR)'
	cp '$*.ui' '$@'

$(INSTALL_DIR)/%.ui : $(BUILD_DIR)/%.ui
	test -n '$(BUILD_DIR)'
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'
