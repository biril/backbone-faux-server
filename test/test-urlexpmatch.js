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
}());