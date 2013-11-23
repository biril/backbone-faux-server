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

qunit.run({
    code: { path: absPath("../backbone-faux-server.js"), namespace: "fauxServer" },
    tests: [
        absPath("test-routes.js"),
        absPath("test-urlexpmatch.js"),
        absPath("test-handlers.js"),
        absPath("test-eventscallbacks.js"),
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