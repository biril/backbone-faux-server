/*global QUnit, Backbone, fauxServer, test, ok, deepEqual */

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
    QUnit.module("URL-exp matching", {
        setup: function () {
            Backbone.$ = undefined;
        },
        teardown: function () {
            fauxServer.removeRoutes();
        }
    });

    test("URL-expressions match (regular expressions)", function () {
        var matchingRoute = null, i, numOfTests,
            tests = [{
                urlExp: /\/?this\/is\/an?\/([^\/]+)\/([^\/]+)\/?/,
                url: "is/this/is/a/regular/expression/?",
                params: ["regular", "expression"]
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
            deepEqual(matchingRoute.handlerParams, tests[i].params, "with _handerParams_: " + dumpArray(tests[i].params));
        }
    });

    test("URL-expressions match (named params & splats)", function () {
        var matchingRoute = null, i, numOfTests,
            tests = [{
                urlExp: "some/url",
                url: "some/url",
                params: []
            }, {
                urlExp: "1/2/:param1/:param2/3/4",
                url: "1/2/hello/world/3/4",
                params: ["hello", "world"]
            }, {
                urlExp: "1/2/*param",
                url: "1/2/hello/world/3/4",
                params: ["hello/world/3/4"]
            }, {
                urlExp: "1/2/*param/3/4",
                url: "1/2/hello/world/3/4",
                params: ["hello/world"]
            }, {
                urlExp: "1/2/:param1/:param2/*param",
                url: "1/2/hello/world/3/4",
                params: ["hello", "world", "3/4"]
            }, {
                urlExp: "1/2/*param1/:param2",
                url: "1/2/hello/world/3/4",
                params: ["hello/world/3", "4"]
            }, {
                urlExp: "book-:title/page-:number",
                url: "book-do androids dream of electric sheep/page-303",
                params: ["do androids dream of electric sheep", "303"]
            }, {
                urlExp: "book::title/page::number",
                url: "book:do androids dream of electric sheep/page:303",
                params: ["do androids dream of electric sheep", "303"]
            }, {
                urlExp: "search/:query/p:page",
                url: "search/obama/p2",
                params: ["obama", "2"]
            }, {
                urlExp: "file/*path",
                url: "file/nested/folder/file.txt",
                params: ["nested/folder/file.txt"]
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
            deepEqual(matchingRoute.handlerParams, tests[i].params, "with _handerParams_: " + dumpArray(tests[i].params));
        }
    });

    test("URL-expressions match (optional parts)", function () {
        var matchingRoute = null, i, numOfTests,
            tests = [{
                urlExp: "docs/:section(/:subsection)",
                url: "docs/faq",
                params: ["faq", undefined]
            }, {
                urlExp: "docs/:section(/:subsection)",
                url: "docs/faq/installing",
                params: ["faq", "installing"]
            }, {
                urlExp: "docs/:section(/:subsection)(/:subsubsection)",
                url: "docs/faq",
                params: ["faq", undefined, undefined]
            }, {
                urlExp: "docs/:section(/:subsection)(/:subsubsection)",
                url: "docs/faq/installing",
                params: ["faq", "installing", undefined]
            }, {
                urlExp: "docs/:section(/:subsection)(/:subsubsection)",
                url: "docs/faq/installing/macos",
                params: ["faq", "installing", "macos"]
            }, {
                urlExp: "docs/(maybe/):id",
                url: "docs/1",
                params: ["1"]
            }, {
                urlExp: "docs/(maybe/):id",
                url: "docs/maybe/1",
                params: ["1"]
            }, {
                urlExp: "#/##/###/(something/)else",
                url: "#/##/###/else",
                params: []
            }, {
                urlExp: "#/##/###/(something/)else",
                url: "#/##/###/something/else",
                params: []
            }, {
                urlExp: "#/##/###/(:something/)else",
                url: "#/##/###/else",
                params: [undefined]
            }, {
                urlExp: "#/##/###/(:something/)else",
                url: "#/##/###/anything/else",
                params: ["anything"]
            }, {
                urlExp: "#/##/###/(###:something/)else",
                url: "#/##/###/else",
                params: [undefined]
            }, {
                urlExp: "#/##/###/(###:something/)else",
                url: "#/##/###/###anything/else",
                params: ["anything"]
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
            deepEqual(matchingRoute.handlerParams, tests[i].params, "with _handerParams_: " + dumpArray(tests[i].params));
        }
    });

    test("':param' identifiers are interpreted as param parts iff they begin with letter / underscore", function () {
        var matchingRoute = null, i, numOfTests,
            tests = [{
                urlExp: "example.com/:section",
                url: "example.com/some-section",
                params: ["some-section"]
            }, {
                urlExp: "example.com:section",
                url: "example.comsome-section",
                params: ["some-section"]
            }, {
                urlExp: "example.com/(:section)",
                url: "example.com/some-section",
                params: ["some-section"]
            }, {
                urlExp: "example.com(/:section)",
                url: "example.com/some-section",
                params: ["some-section"]
            }, {
                urlExp: "example.com(:section)",
                url: "example.comsome-section",
                params: ["some-section"]
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            fauxServer.removeRoute("testRoute");

            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
        }

        // Change ':section' token into ':5ection'. No routes should match now
        for (i = 0, numOfTests; i < numOfTests; ++i) {
            tests[i].urlExp = tests[i].urlExp.replace(":section", ":5ection");
        }

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            fauxServer.removeRoute("testRoute");

            ok(!matchingRoute, tests[i].urlExp + " does not match " + tests[i].url);
        }

        // However changing ':section' to ':s3ction' should keep routes matching
        for (i = 0, numOfTests; i < numOfTests; ++i) {
            tests[i].urlExp = tests[i].urlExp.replace(":5ection", ":s3ction");
        }

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            fauxServer.removeRoute("testRoute");

            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
        }
    });

    test("Protocols & port numbers are not interpreted as param parts", function () {
        var matchingRoute = null, i, numOfTests,
            tests = [{
                urlExp: "example.com:8080",
                url: "example.com:8080",
                params: []
            },{
                urlExp: "http://example.com:8080",
                url: "http://example.com:8080",
                params: []
            }, {
                urlExp: "example.com:8080/:section",
                url: "example.com:8080/home",
                params: ["home"]
            }, {
                urlExp: "example.com(:8080)",
                url: "example.com",
                params: []
            }, {
                urlExp: "example.com(:8080)/:section",
                url: "example.com/home",
                params: ["home"]
            }, {
                urlExp: "(http://)example.com(:8080)/:section",
                url: "example.com/home",
                params: ["home"]
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            fauxServer.removeRoute("testRoute");

            ok(matchingRoute, tests[i].urlExp + " matches " + tests[i].url);
            deepEqual(matchingRoute.handlerParams, tests[i].params, "with _handerParams_: " + dumpArray(tests[i].params));
        }

        tests = [{
                urlExp: "example.com:8080",
                url: "example.com:8081"
            }, {
                urlExp: "example.com:8080/:section",
                url: "example.com:8081/home"
            }, {
                urlExp: "example.com(:8080)",
                url: "example.com:8081"
            }, {
                urlExp: "example.com(:8080)/:section",
                url: "example.com:8081/home"
            }];

        for (i = 0, numOfTests = tests.length; i < numOfTests; ++i) {
            fauxServer.addRoute("testRoute", tests[i].urlExp);
            matchingRoute = fauxServer.getMatchingRoute(tests[i].url);
            fauxServer.removeRoute("testRoute");

            ok(!matchingRoute, tests[i].urlExp + " does not match " + tests[i].url);
        }
    });
}());
