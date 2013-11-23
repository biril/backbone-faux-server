/*global QUnit, test, ok, strictEqual, deepEqual, throws, start, stop, expect, Backbone, fauxServer:true */
(function () {
    "use strict";

    // Helpers
    var dumpArray = function (array) {
            var i, l, d = [];
            for (i = 0, l = array.length; i < l; ++i) {
                d.push(array[i] === undefined ? "_undefined_" : array[i]);
            }
            return d.join(", ");
        };

    //
    QUnit.module("chaining", {
        setup: function () {
            Backbone.$ = undefined;
        },
        teardown: function () {
            fauxServer.removeRoutes();
        }
    });

    test("addRoute is chainable", function () {
        strictEqual(fauxServer.addRoute("dummy"), fauxServer, "returns faux-server");
    });

    test("addRoutes is chainable", function () {
        strictEqual(fauxServer.addRoutes(), fauxServer, "returns faux-server");
    });

    test("removeAllRoutes is chainable", function () {
        strictEqual(fauxServer.removeRoutes(), fauxServer, "returns faux-server");
    });

    test("setDefaultHandler is chainable", function () {
        strictEqual(fauxServer.setDefaultHandler(), fauxServer, "returns faux-server");
    });

    test("setLatency is chainable", function () {
        strictEqual(fauxServer.setLatency(0), fauxServer, "returns faux-server");
    });

    test("enable is chainable", function () {
        strictEqual(fauxServer.enable(), fauxServer, "returns faux-server");
    });

    test("get, post, put, patch, del are chainable", function () {
        var methods = ["get", "post", "put", "patch", "del"],
            i = 0, l = methods.length;

        for (; i < l; ++i) {
            strictEqual(fauxServer[methods[i]]("dummy"), fauxServer, methods[i] + " returns faux-server");
        }
    });
}());