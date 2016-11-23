/*global QUnit, test, ok, strictEqual, throws, expect, Backbone, fauxServer:true */

(function () {
    "use strict";

    // Helpers
    var isFunction = function (f) {
            return Object.prototype.toString.call(f) === "[object Function]";
        };

    var __fauxServer;

    //
    QUnit.module("routes", {
        setup: function () {
            Backbone.$ = undefined;
            Backbone.ajax = function () { throw "Unexpected call to DOM-library ajax"; };
            __fauxServer = fauxServer.create(Backbone);
        },
        teardown: function () {
            __fauxServer.destroy();
        }
    });

    test("Routes are acquired by name", function () {
        var h1 = function () {},
            h2 = function () {},
            route1, route2;

        __fauxServer.addRoute("testRoute1", "", "*", h1);
        __fauxServer.addRoute("testRoute2", "", "*", h2);

        route1 = __fauxServer.getRoute("testRoute1");
        route2 = __fauxServer.getRoute("testRoute2");

        ok(route1, "first route acquired by name");
        strictEqual(route1.handler, h1, "first acquired route has expected handler");

        ok(route2, "second route acquired by name");
        strictEqual(route2.handler, h2, "second acquired route has expected handler");
    });

    test("Routes acquired by name are a copy", function () {
        var h = function () {},
            route1;

        __fauxServer.addRoute("testRoute1", "", "*", h);

        route1 = __fauxServer.getRoute("testRoute1");
        route1.handler = function () {};

        route1 = __fauxServer.getRoute("testRoute1");

        strictEqual(route1.handler, h);
    });

    test("Routes are acquired by index", function () {
        var h1 = function () {},
            h2 = function () {},
            route1, route2;

        __fauxServer.addRoute("", "*", h1);
        __fauxServer.addRoute("", "*", h2);

        route1 = __fauxServer.getRouteAt(0);
        route2 = __fauxServer.getRouteAt(1);

        ok(route1, "first route acquired by name");
        strictEqual(route1.handler, h1, "first acquired route has expected handler");

        ok(route2, "second route acquired by name");
        strictEqual(route2.handler, h2, "second acquired route has expected handler");
    });

    test("Routes acquired by index are a copy", function () {
        var h = function () {},
            route1;

        __fauxServer.addRoute("", "*", h);

        route1 = __fauxServer.getRouteAt(0);
        route1.handler = function () {};

        route1 = __fauxServer.getRouteAt(0);

        strictEqual(route1.handler, h);
    });

    test("Routes are added and removed", function () {
        var h = function () {}; // No-op

        __fauxServer.addRoute("testRoute1", "", "*", h);
        ok(__fauxServer.getRoute("testRoute1"), "_addRoute_ adds route");

        __fauxServer.addRoutes({
            "testRoute2": { urlExp: "", httpMethod: "*", handler: h },
            "testRoute3": { urlExp: "", httpMethod: "*", handler: h }
        });
        ok(__fauxServer.getRoute("testRoute2") && __fauxServer.getRoute("testRoute3"), "_addRoutes_ ({}) adds routes");

        __fauxServer.addRoutes([
            { name: "testRoute4", urlExp: "", httpMethod: "*", handler: h },
            { name: "testRoute5", urlExp: "", httpMethod: "*", handler: h }
        ]);
        ok(__fauxServer.getRoute("testRoute4") && __fauxServer.getRoute("testRoute5"), "_addRoutes_ ([]) adds routes");

        __fauxServer.addRoute("testRoute1", "override", "*", h);
        strictEqual(__fauxServer.getRoute("testRoute1").urlExp.toString(), "/^override$/", "Adding route of same name overrides previous");

        __fauxServer.removeRoute("testRoute1");
        ok(!__fauxServer.getRoute("testRoute1"), "_removeRoute_ removes route");

        __fauxServer.removeRoutes();

        ok(!__fauxServer.getRoute("testRoute2") &&
           !__fauxServer.getRoute("testRoute3") &&
           !__fauxServer.getRoute("testRoute4") &&
           !__fauxServer.getRoute("testRoute5"), "_removeRoutes_ removes routes");
    });

    test("Route name may be omitted", function () {
        var h = function () {}, // No-op
            url = "some/url",
            matchingRoute = null;

        __fauxServer.addRoute(url, "*", h);
        matchingRoute = __fauxServer.getMatchingRoute(url, "*");
        ok(matchingRoute, "unnamed *-route is added");

        __fauxServer.removeRoute(matchingRoute.name);

        __fauxServer.addRoute(url, "GET", h);
        matchingRoute = __fauxServer.getMatchingRoute(url, "GET");
        ok(matchingRoute, "unnamed GET-route is added");
    });

    test("Route handler may be omitted", function () {
        var url = "some/url",
            matchingRoute = null;

        __fauxServer.addRoute("route", url, "*");
        matchingRoute = __fauxServer.getRoute("route");
        ok(matchingRoute && matchingRoute.httpMethod === "*", "no-handler *-route is added");
        ok(isFunction(matchingRoute.handler), "route is assigned a default handler");

        __fauxServer.removeRoute("route");

        __fauxServer.addRoute("route", url, "GET");
        matchingRoute = __fauxServer.getRoute("route");
        ok(matchingRoute && matchingRoute.httpMethod === "GET", "no-handler GET-route is added");
        ok(isFunction(matchingRoute.handler), "route is assigned a default handler");
    });

    test("Route method may be omitted", function () {
        var h = function () {}, // No-op
            url = "some/url",
            matchingRoute = null;

        __fauxServer.addRoute("route", url, h);
        matchingRoute = __fauxServer.getRoute("route");
        ok(matchingRoute, "no-method route is added");
        strictEqual(matchingRoute.httpMethod, "*", "route is assigned the '*' method");
    });

    test("Route name & method may both be omitted", function () {
        var h = function () {}, // No-op
            url = "some/url",
            matchingRoute = null;

        __fauxServer.addRoute(url, h);
        matchingRoute = __fauxServer.getMatchingRoute(url, "*");
        ok(matchingRoute, "unnamed, no-method route is added and assigned the '*' method");
    });

    test("Route name & handler may both be omitted", function () {
        var url = "some/url",
            matchingRoute = null;

        __fauxServer.addRoute(url, "*");
        matchingRoute = __fauxServer.getMatchingRoute(url, "*");
        ok(matchingRoute, "unnamed, no-handler *-route is added");
        ok(isFunction(matchingRoute.handler), "route is assigned a default handler");

        __fauxServer.removeRoute(matchingRoute.name);

        __fauxServer.addRoute(url, "GET");
        matchingRoute = __fauxServer.getMatchingRoute(url, "GET");
        ok(matchingRoute, "unnamed, no-handler GET-route is added");
        ok(isFunction(matchingRoute.handler), "route is assigned a default handler");
    });

    test("Route method & handler may both be omitted", function () {
        var url = "some/url",
            matchingRoute = null;

        __fauxServer.addRoute("route", url);
        matchingRoute = __fauxServer.getRoute("route");
        ok(matchingRoute, "no-handler no-method route is added");
        ok(isFunction(matchingRoute.handler), "route is assigned a default handler");
        strictEqual(matchingRoute.httpMethod, "*", "route is assigned the '*' method");
    });

    test("Route name, method & handler may all be omitted", function () {
        var url = "some/url",
            matchingRoute = null;

        __fauxServer.addRoute(url);
        matchingRoute = __fauxServer.getMatchingRoute(url, "*");
        ok(matchingRoute, "unnamed, no-method, no-handler route is added and assigned the '*' method");
        ok(isFunction(matchingRoute.handler), "route is assigned a default handler");
    });

    test("addRoute throws when 'urlExp' is omitted", function () {
        throws(function () { __fauxServer.addRoute(); }, "throws");
    });

    test("addRoutes with no given routes is a no-op", function () {
        __fauxServer.addRoutes();
        ok(!__fauxServer.getRouteAt(0), "no route added");
    });

    test("removeRoute with invalid or no given route name is a no-op", function () {
        expect(0);

        __fauxServer.removeRoute();
        __fauxServer.removeRoute("dummy");
    });

    test("Later routes take precedence over earlier routes (but not when they're a weaker match)", function () {
        var earlierHandler = function () {},
            laterHandler = function () {},
            weaklyMatchedHandler = function () {};

        __fauxServer.addRoute("testRoute1", /some\/url/, "POST", earlierHandler);
        __fauxServer.addRoute("testRoute2", /some\/(other\/)?url/, "POST", laterHandler);
        strictEqual(__fauxServer.getMatchingRoute("some/url", "POST").handler, laterHandler, "Later route takes precendence");

        // Test a later-but-weaker route
        __fauxServer.addRoute("testRoute3", /some\/(other\/)?url/, "*", weaklyMatchedHandler);
        strictEqual(__fauxServer.getMatchingRoute("some/url", "POST").handler, laterHandler, "But not when a weaker match");
    });

    test("Routes may be added with get, post, put, patch, del", function () {
        var url = "some/url",
            routeName = null,
            routeMethod = null,
            matchingRoute = null,
            methods = ["get", "post", "put", "patch", "del"],
            handler = function () {},
            i = 0, l = methods.length;

        for (; i < l; ++i) {
            routeName = "route_" + methods[i];
            routeMethod = methods[i] === "del" ? "DELETE" : methods[i].toUpperCase();

            // Add named route (no handler)
            __fauxServer[methods[i]](routeName, url);
            matchingRoute = __fauxServer.getRoute(routeName);
            ok(matchingRoute, methods[i] + " adds named route (when no handler given)");
            strictEqual(matchingRoute.httpMethod, routeMethod, "added route is assigned the " + routeMethod + " method");

            __fauxServer.removeRoute(routeName);

            // Add named route (with handler)
            __fauxServer[methods[i]](routeName, url, handler);
            matchingRoute = __fauxServer.getRoute(routeName);
            ok(matchingRoute, methods[i] + " adds named route (when handler given)");
            strictEqual(matchingRoute.httpMethod, routeMethod, "added route is assigned the " + routeMethod + " method");

            __fauxServer.removeRoute(routeName);

            // Add unnamed route (no handler)
            __fauxServer[methods[i]](url);
            matchingRoute = __fauxServer.getMatchingRoute(url, routeMethod);
            ok(matchingRoute, methods[i] + " adds unnamed " + routeMethod + "-route (when no handler given)");

            __fauxServer.removeRoute(matchingRoute.name);

            // Add unnamed route (with handler)
            __fauxServer[methods[i]](url, handler);
            matchingRoute = __fauxServer.getMatchingRoute(url, routeMethod);
            ok(matchingRoute, methods[i] + " adds unnamed " + routeMethod + "-route (when handler given)");

            __fauxServer.removeRoute(matchingRoute.name);
        }
    });

    test("get, post, put, patch, del throw when 'urlExp' is omitted", function () {
        throws(function () { __fauxServer.get();   }, "get throws");
        throws(function () { __fauxServer.post();  }, "post throws");
        throws(function () { __fauxServer.put();   }, "put throws");
        throws(function () { __fauxServer.patch(); }, "patch throws");
        throws(function () { __fauxServer.del();   }, "del throws");
    });
}());
