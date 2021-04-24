.PHONY : build install

build : $(BUILD_DIR)/gschemas.compiled
install : $(INSTALL_DIR)/gschemas.compiled

$(BUILD_DIR)/gschemas.compiled : $(wildcard *.gschema.xml)
	mkdir -p '$(BUILD_DIR)'
	glib-compile-schemas --strict --targetdir='$(BUILD_DIR)' .

$(INSTALL_DIR)/gschemas.compiled : $(BUILD_DIR)/gschemas.compiled
	test -n '$(BUILD_DIR)'
	mkdir -p '$(INSTALL_DIR)'
	cp '$^' '$@'
