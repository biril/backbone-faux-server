/*global QUnit, Backbone, test, strictEqual */

// To be run in browser - before first invocation of `fauxServer.noConflict`
/*jshint browser:true */

(function () {
    "use strict";

    var originalNoConflict = window.fauxServer.noConflict,
        theFauxServer = window.fauxServer;

    //
    QUnit.module("no conflict", {
        setup: function () {
            theFauxServer = originalNoConflict.call(theFauxServer);
        },
        teardown: function () {
            window.fauxServer = theFauxServer;
        }
    });

    test("Sets global fauxServer to previous value", 2, function () {
        originalNoConflict.call(theFauxServer);
        strictEqual(window.fauxServer, undefined, "after first invocation ..");

        theFauxServer.noConflict();
        strictEqual(window.fauxServer, undefined, ".. and also after second invocation");
    });

    test("Returns fauxServer", 2, function () {
        var fs;

        fs = originalNoConflict.call(theFauxServer);
        strictEqual(fs, theFauxServer, "after first invocation ..");

        fs = theFauxServer.noConflict();
        strictEqual(fs, theFauxServer, ".. and also after second invocation");
    });

}());
