/*jshint node:true */
"use strict";
var qunit = require("qunit"),
    absPath = (function () {
        var joinPaths = require("path").join;
        return function (relPath) {
            return joinPaths(__dirname, relPath);
        };
    }());

qunit.options.deps = [{
    path: absPath("../node_modules/underscore/underscore.js"),
    namespace: "_"
}, {
    path: absPath("../node_modules/backbone/backbone.js"),
    namespace: "Backbone"
}];

qunit.options.log = {
    // log assertions overview
    assertions: false,

    // log expected and actual values for failed tests
    errors: true,

    // log tests overview
    tests: true,

    // log summary
    summary: true,

    // log global summary (all files)
    // globalSummary: true,

    // log coverage
    coverage: true,

    // log global coverage (all files)
    // globalCoverage: true,

    // log currently testing code file
    testing: true
};

qunit.options.coverage = { dir: "coverage" };

qunit.run({
    code: { path: absPath("../backbone-faux-server.js"), namespace: "fauxServer" },
    tests: [
        absPath("test-version.js"),
        absPath("test-routes.js"),
        absPath("test-urlexpmatch.js"),
        absPath("test-handlers.js"),
        absPath("test-sync.js"),
        absPath("test-eventscallbacks.js"),
        absPath("test-transportcustom.js"),
        absPath("test-chain.js")
    ]
}, function (error, stats) {
    if (error) {
        console.error(new Error(error));
        process.exit(1);
        return;
    }
    process.exit(stats.failed > 0 ? 1 : 0);
});
