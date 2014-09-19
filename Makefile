test:
	node ./test/testrunner.js

lint:
	jshint --show-non-errors backbone-faux-server.js test/testrunner.js test/test-*.js

.PHONY: test lint
