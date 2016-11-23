/*global QUnit, Backbone, fauxServer, test, strictEqual */

(function () {
    "use strict";

    var __fauxServer;

    //
    QUnit.module("chaining", {
        setup: function () {
            Backbone.$ = undefined;
            Backbone.ajax = function () { throw "Unexpected call to DOM-library ajax"; };
            __fauxServer = fauxServer.create(Backbone);
        },
        teardown: function () {
            __fauxServer.destroy();
        }
    });

    test("addRoute is chainable", function () {
        strictEqual(__fauxServer.addRoute("dummy"), __fauxServer, "returns faux-server");
    });

    test("addRoutes is chainable", function () {
        strictEqual(__fauxServer.addRoutes(), __fauxServer, "returns faux-server");
    });

    test("removeAllRoutes is chainable", function () {
        strictEqual(__fauxServer.removeRoutes(), __fauxServer, "returns faux-server");
    });

    test("setDefaultHandler is chainable", function () {
        strictEqual(__fauxServer.setDefaultHandler(), __fauxServer, "returns faux-server");
    });

    test("setTransportFactory is chainable", function () {
       strictEqual(__fauxServer.setTransportFactory(), __fauxServer, "returns faux-server");
    });

    test("setLatency is chainable", function () {
        strictEqual(__fauxServer.setLatency(0), __fauxServer, "returns faux-server");
    });

    test("enable is chainable", function () {
        strictEqual(__fauxServer.enable(), __fauxServer, "returns faux-server");
    });

    test("get, post, put, patch, del are chainable", function () {
        var methods = ["get", "post", "put", "patch", "del"],
            i = 0, l = methods.length;

        for (; i < l; ++i) {
            strictEqual(__fauxServer[methods[i]]("dummy"),
                __fauxServer, methods[i] + " returns faux-server");
        }
    });
}());
