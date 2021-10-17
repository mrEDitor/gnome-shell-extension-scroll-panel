SOURCE_FILES := $(wildcard *.js)
BUILD_METADATA ?= $(shell if [[ `git status --porcelain --untracked-files=no` ]]; then echo 'custom'; else echo "git-`git rev-parse --short HEAD`"; fi)

ESLINT ?= eslint
JQ ?= jq
WGET ?= wget

.PHONY: lint build install
.PHONY: $(BUILD_DIR)/metadata.json $(BUILD_DIR)/debug.js

lint : eslintrc-gjs.yml eslintrc-shell.yml
	$(ESLINT) .

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
	$(JQ) '.["semantic-version"] = .["semantic-version"] + "+$(BUILD_METADATA)"' metadata.json > '$@'

$(BUILD_DIR)/%.js : %.js
	mkdir -p '$(BUILD_DIR)'
	cp '$*.js' '$@'

$(INSTALL_DIR)/metadata.json : $(BUILD_DIR)/metadata.json
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'

$(INSTALL_DIR)/%.js : $(BUILD_DIR)/%.js
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'

eslintrc-gjs.yml :
	$(WGET) https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/raw/master/lint/eslintrc-gjs.yml

eslintrc-shell.yml :
	$(WGET) https://gitlab.gnome.org/GNOME/gnome-shell-extensions/-/raw/master/lint/eslintrc-shell.yml
