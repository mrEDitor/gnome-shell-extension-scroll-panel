PREFIX ?=
MAKE ?= make
CLEAN ?= rm -f

all:
	PREFIX=$(PREFIX)/schemas $(MAKE) -C schemas all
	PREFIX=$(PREFIX)/ui $(MAKE) -C ui all

clean:
	PREFIX=$(PREFIX)/schemas $(MAKE) -C schemas clean
	PREFIX=$(PREFIX)/ui $(MAKE) -C ui clean

install:
	mkdir $(PREFIX) ;\
	cp *.js $(PREFIX) ;\
	cp *.json $(PREFIX) ;\
	PREFIX=$(PREFIX)/schemas $(MAKE) -C schemas install
	PREFIX=$(PREFIX)/ui $(MAKE) -C ui install
