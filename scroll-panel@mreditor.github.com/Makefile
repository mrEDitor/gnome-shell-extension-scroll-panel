DOMAIN ?=
PREFIX ?=
MAKE ?= make
CLEAN ?= rm -f

all:
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/locale $(MAKE) -C locale all
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/schemas $(MAKE) -C schemas all
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/ui $(MAKE) -C ui all

clean:
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/locale $(MAKE) -C locale clean
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/schemas $(MAKE) -C schemas clean
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/ui $(MAKE) -C ui clean

install:
	mkdir $(PREFIX) ;\
	cp *.js $(PREFIX) ;\
	cp *.json $(PREFIX) ;\
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/locale $(MAKE) -C locale install
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/schemas $(MAKE) -C schemas install
	DOMAIN=$(DOMAIN) PREFIX=$(PREFIX)/ui $(MAKE) -C ui install
