DOMAIN ?=
PREFIX ?=
MAKE ?= make
CLEAN ?= rm -f

all:
	glib-compile-schemas .

clean:
	-rm gschemas.compiled

install:
	mkdir $(PREFIX)
	cp gschemas.compiled $(PREFIX)
