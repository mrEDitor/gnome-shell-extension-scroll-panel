SOURCE_FILES := $(wildcard *.js)
BUILD_METADATA ?= git-`git rev-parse --short HEAD`

.PHONY: build install
.PHONY: $(BUILD_DIR)/metadata.json $(BUILD_DIR)/debug.js

build : $(BUILD_DIR)/metadata.json $(addprefix $(BUILD_DIR)/, $(SOURCE_FILES))

$(BUILD_DIR)/debug.js :
ifeq ($(DEBUG),)
	echo > '$@'
else
	cp debug.js '$@'
endif

install : $(INSTALL_DIR)/metadata.json $(addprefix $(INSTALL_DIR)/, $(SOURCE_FILES))

$(BUILD_DIR)/metadata.json : metadata.json
	mkdir -p '$(BUILD_DIR)'
	jq ".[\"semantic-version\"] = .[\"semantic-version\"] + \"+$(BUILD_METADATA)\"" metadata.json > '$@'

$(BUILD_DIR)/%.js : %.js
	mkdir -p '$(BUILD_DIR)'
	cp '$*.js' '$@'

$(INSTALL_DIR)/metadata.json : $(BUILD_DIR)/metadata.json
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'

$(INSTALL_DIR)/%.js : $(BUILD_DIR)/%.js
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'
