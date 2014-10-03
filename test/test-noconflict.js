/*global QUnit, Backbone, test, strictEqual */

// To be run in browser - prior to _any_ invocation of `fauxServer.noConflict` [ :( ]
/*jshint browser:true */

(function () {
    "use strict";

    var theFauxServer = window.fauxServer;

    //
    QUnit.module("no conflict", {
        setup: function () {
            theFauxServer.noConflict();
        },
        teardown: function () {
            window.fauxServer = theFauxServer;
        }
    });

    test("Sets global fauxServer to previous value", 2, function () {
        strictEqual(window.fauxServer, undefined, "after first invocation ..");

        theFauxServer.noConflict();
        strictEqual(window.fauxServer, undefined, ".. and also after second invocation");
    });

    test("Returns fauxServer", 2, function () {
        var fs;

        fs = theFauxServer.noConflict();
        strictEqual(fs, theFauxServer, "after first invocation ..");

        fs = theFauxServer.noConflict();
        strictEqual(fs, theFauxServer, ".. and also after second invocation");
    });

}());
