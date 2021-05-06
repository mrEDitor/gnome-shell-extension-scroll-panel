SOURCE_FILES := $(filter-out debug.js, $(wildcard *.js))

.PHONY: build debug install $(BUILD_DIR)/metadata.json

build : $(BUILD_DIR)/metadata.json $(addprefix $(BUILD_DIR)/, $(SOURCE_FILES))
	-rm '$(BUILD_DIR)/debug.js'

debug : $(BUILD_DIR)/debug.js

install : $(INSTALL_DIR)/metadata.json $(addprefix $(INSTALL_DIR)/, $(SOURCE_FILES))
	-cp '$(BUILD_DIR)/debug.js' '$(INSTALL_DIR)'

$(BUILD_DIR)/metadata.json : metadata.json
	mkdir -p '$(BUILD_DIR)'
	jq ".semanticVersion = .semanticVersion + \"+git-`git rev-parse --short HEAD`\"" metadata.json > '$@'

$(BUILD_DIR)/%.js : %.js
	mkdir -p '$(BUILD_DIR)'
	cp '$*.js' '$@'

$(INSTALL_DIR)/metadata.json : $(BUILD_DIR)/metadata.json
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'

$(INSTALL_DIR)/%.js : $(BUILD_DIR)/%.js
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'
