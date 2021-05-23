.PHONY : build install
COMPILE_SCHEMAS ?= glib-compile-schemas --strict

build : $(BUILD_DIR)/gschemas.compiled
install : $(INSTALL_DIR)/gschemas.compiled

$(BUILD_DIR)/gschemas.compiled : $(wildcard *.gschema.xml)
	mkdir -p '$(BUILD_DIR)'
	$(COMPILE_SCHEMAS) --targetdir='$(BUILD_DIR)' .

$(INSTALL_DIR)/gschemas.compiled : $(BUILD_DIR)/gschemas.compiled
	test -n '$(BUILD_DIR)'
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'
